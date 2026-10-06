import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  CheckSquare,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  Lock,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePipelines, usePipelineStages, defaultProbabilityForStage, type PipelineStage } from "@/hooks/usePipelineStages";
import { CONTACT_SELECT } from "@/hooks/useContacts";
import { PageBanner } from "@/components/PageBanner";
import { EmptyState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { parseCsvObjects, downloadCsv } from "@/lib/csv";
import {
  downloadBrandedExcelTemplate,
  downloadBrandedCsvTemplate,
  parseImportSpreadsheet,
  exportToExcel,
  TEMPLATE_CONFIGS,
} from "@/lib/excelTemplates";
import { chunk, fetchAllRows } from "@/lib/fetchAll";
import { errorMessage, isPlanLimitError } from "@/components/settings/validation";
import { LimitNotice, UpgradePrompt } from "@/components/settings/UpgradePrompt";
import { usePlan } from "@/hooks/usePlan";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  IMPORT_FIELDS,
  IMPORT_TEMPLATES,
  CONTACT_EXPORT_HEADERS,
  COMPANY_EXPORT_HEADERS,
  autoMapColumns,
  companyExportRow,
  contactExportRow,
  dedupeKey,
  failedRowsCsv,
  matchStage,
  missingRequiredFields,
  validateRows,
  type ColumnMapping,
  type CompanyImportValues,
  type ContactImportValues,
  type DealImportValues,
  type FailedRow,
  type ImportEntity,
  type ValidatedRow,
} from "@/lib/dataTransfer";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 25_000;
const BATCH_SIZE = 100;
const NONE = "__none__";

const ENTITIES: { value: ImportEntity; label: string; icon: LucideIcon; description: string }[] = [
  { value: "contacts", label: "Contacts", icon: Users, description: "People, linked to companies by name" },
  { value: "companies", label: "Companies", icon: Building2, description: "Accounts with industry and website" },
  { value: "deals", label: "Deals", icon: Briefcase, description: "Opportunities placed in a pipeline stage" },
];

function RoleNotice({ text }: { text: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="Not available for your role"
      description={text}
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/settings?tab=roles">About roles</Link>
        </Button>
      }
    />
  );
}

export default function DataImportExport() {
  const { can, hasFeature } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "export" ? "export" : "import";
  return (
    <div className="space-y-6">
      <PageBanner title="Import & export" description="Bring records in from a CSV file, or download your workspace data." />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams);
          if (v === "export") next.set("tab", "export");
          else next.delete("tab");
          setSearchParams(next, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="import" className="gap-1.5">
            <Upload className="h-4 w-4" aria-hidden /> Import
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5">
            <Download className="h-4 w-4" aria-hidden /> Export
          </TabsTrigger>
        </TabsList>
        <TabsContent value="import" className="mt-6">
          {!can("data.import") ? (
            <RoleNotice text="Your role doesn't include importing data. Ask a workspace admin if you need to bring records in." />
          ) : hasFeature("csv_import") ? (
            <ImportWizard />
          ) : (
            <UpgradePrompt feature="csv_import" />
          )}
        </TabsContent>
        <TabsContent value="export" className="mt-6">
          {!hasFeature("csv_export") ? (
            <UpgradePrompt feature="csv_export" />
          ) : can("data.export_all") ? (
            <ExportPanel />
          ) : (
            <RoleNotice text="Full workspace exports are for managers and admins. You can still export contacts or companies you select in their lists." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =====================================================================================
// Import wizard
// =====================================================================================

type Step = "upload" | "map" | "preview" | "importing" | "done";

interface ImportResult {
  created: number;
  skipped: number;
  failed: FailedRow[];
  companiesCreated: number;
  stopped: boolean;
}

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Map columns" },
  { key: "preview", label: "Review" },
  { key: "done", label: "Done" },
];

function Stepper({ step }: { step: Step }) {
  const current = step === "importing" ? 2 : STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Import progress">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
              i < current && "border-foreground bg-foreground text-background",
              i === current && "border-foreground text-foreground",
              i > current && "border-border text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
          <span className={cn(i === current ? "font-medium text-foreground" : "text-muted-foreground")}>{s.label}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = Record<string, any>;

function ImportWizard() {
  const { user, organization } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);

  const [step, setStep] = useState<Step>("upload");
  const [entity, setEntity] = useState<ImportEntity>("contacts");
  const templateCfg = TEMPLATE_CONFIGS[entity];
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [createCompanies, setCreateCompanies] = useState(true);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [previewFilter, setPreviewFilter] = useState<"all" | "problems">("all");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: pipelines } = usePipelines({ enabled: entity === "deals" });
  const effectivePipelineId = pipelineId || pipelines?.[0]?.id || "";
  const { data: stages = [] } = usePipelineStages(entity === "deals" ? effectivePipelineId || undefined : undefined);

  const validated = useMemo(() => (step === "preview" || step === "importing" ? validateRows(entity, rows, mapping) : []), [step, entity, rows, mapping]);
  const invalidCount = validated.filter((r) => r.errors.length).length;
  const { wouldExceed } = usePlan();
  const readyCount = validated.length - invalidCount;
  const contactLimitRisk = entity === "contacts" && readyCount > 0 && wouldExceed("contacts", readyCount);
  // With "skip duplicates" on, some rows may not be new, so only warn; otherwise block up front.
  const overContactLimit = contactLimitRisk && !skipDuplicates;
  const missing = missingRequiredFields(entity, mapping);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    setPreviewFilter("all");
    setProgress({ done: 0, total: 0 });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const isSpreadsheet =
      /\.(csv|xlsx|xls)$/i.test(file.name) ||
      file.type === "text/csv" ||
      file.type.includes("spreadsheet") ||
      file.type.includes("excel");

    if (!isSpreadsheet) {
      toast.error("Choose an Excel (.xlsx) or CSV file", {
        description: "Upload your data as .xlsx, .xls, or .csv to continue.",
      });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File is too large", { description: "Files must be 5 MB or smaller. Split it into several files." });
      return;
    }
    setReading(true);
    try {
      const parsed = await parseImportSpreadsheet(file);
      const cleanHeaders = parsed.headers.filter((h, i) => h !== "" && parsed.headers.indexOf(h) === i);
      if (!cleanHeaders.length || !parsed.rows.length) {
        toast.error("Nothing to import", { description: "The file needs a header row and at least one data row." });
        return;
      }
      if (parsed.rows.length > MAX_ROWS) {
        toast.error("Too many rows", { description: `Import up to ${formatNumber(MAX_ROWS)} rows at a time.` });
        return;
      }
      setFileName(file.name);
      setHeaders(cleanHeaders);
      setRows(parsed.rows);
      setMapping(autoMapColumns(cleanHeaders, entity));
      setResult(null);
      setStep("map");
    } catch (err) {
      toast.error("Couldn't read that file", {
        description: err instanceof Error ? err.message : "Make sure it's a valid Excel (.xlsx) or UTF-8 CSV file.",
      });
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownloadExcel = () => {
    downloadBrandedExcelTemplate(entity);
    toast.success(`Downloaded ${TEMPLATE_CONFIGS[entity].title} Excel template (.xlsx)`);
  };

  const handleDownloadCsv = () => {
    downloadBrandedCsvTemplate(entity);
    toast.success(`Downloaded ${TEMPLATE_CONFIGS[entity].title} CSV template (.csv)`);
  };


  const runImport = async () => {
    if (!user) return;
    stopRef.current = false;
    setStep("importing");
    const failed: FailedRow[] = [];
    let created = 0;
    let skipped = 0;
    let companiesCreated = 0;
    const fail = (r: ValidatedRow, reason: string) => failed.push({ rowNumber: r.rowNumber, raw: r.raw, reason });

    const all = validateRows(entity, rows, mapping);
    all.filter((r) => r.errors.length).forEach((r) => fail(r, r.errors.join("; ")));
    const valid = all.filter((r) => !r.errors.length);
    setProgress({ done: 0, total: valid.length });

    try {
      // --- Lookups -------------------------------------------------------------------
      const companyIds = new Map<string, string>();
      const needsCompanies = entity === "companies" ? skipDuplicates : valid.some((r) => (r.values as ContactImportValues | DealImportValues).company);
      if (needsCompanies) {
        const existing = await fetchAllRows<{ id: string; name: string }>((from, to) =>
          supabase.from("companies").select("id, name").order("id").range(from, to),
        );
        existing.forEach((c) => companyIds.set(c.name.trim().toLowerCase(), c.id));
      }
      const contactIds = new Map<string, string>();
      const needsContacts =
        (entity === "contacts" && skipDuplicates) || (entity === "deals" && valid.some((r) => (r.values as DealImportValues).contact_email));
      if (needsContacts) {
        const existing = await fetchAllRows<{ id: string; email: string | null }>((from, to) =>
          supabase.from("contacts").select("id, email").not("email", "is", null).order("id").range(from, to),
        );
        existing.forEach((c) => c.email && contactIds.set(c.email.trim().toLowerCase(), c.id));
      }

      // --- Duplicates ------------------------------------------------------------------
      let toImport = valid;
      if (skipDuplicates && entity !== "deals") {
        const seen = new Set<string>(entity === "companies" ? companyIds.keys() : contactIds.keys());
        toImport = [];
        for (const r of valid) {
          const key = dedupeKey(entity, r.values);
          if (key && seen.has(key)) {
            skipped++;
            continue;
          }
          if (key) seen.add(key);
          toImport.push(r);
        }
      }

      // --- Missing companies (contacts & deals) ---------------------------------------
      if (entity !== "companies" && createCompanies) {
        const missingNames = new Map<string, string>();
        for (const r of toImport) {
          const name = (r.values as ContactImportValues | DealImportValues).company?.trim();
          if (name && !companyIds.has(name.toLowerCase())) missingNames.set(name.toLowerCase(), name);
        }
        for (const part of chunk(Array.from(missingNames.values()), BATCH_SIZE)) {
          const { data, error } = await supabase
            .from("companies")
            .insert(part.map((name) => ({ name, created_by: user.id })) as never)
            .select("id, name");
          if (error) throw error;
          for (const c of (data ?? []) as { id: string; name: string }[]) companyIds.set(c.name.trim().toLowerCase(), c.id);
          companiesCreated += data?.length ?? 0;
        }
      }
      const companyIdFor = (name: string | null) => (name ? (companyIds.get(name.trim().toLowerCase()) ?? null) : null);

      // --- Build payloads ----------------------------------------------------------------
      let table: "contacts" | "companies" | "deals";
      let items: { row: ValidatedRow; payload: Payload }[];
      if (entity === "contacts") {
        table = "contacts";
        items = toImport.map((row) => {
          const v = row.values as ContactImportValues;
          return {
            row,
            payload: {
              first_name: v.first_name,
              last_name: v.last_name,
              email: v.email,
              phone: v.phone,
              position: v.position,
              tags: v.tags,
              company_id: companyIdFor(v.company),
              created_by: user.id,
            },
          };
        });
      } else if (entity === "companies") {
        table = "companies";
        items = toImport.map((row) => {
          const v = row.values as CompanyImportValues;
          return { row, payload: { name: v.name, industry: v.industry, website: v.website, created_by: user.id } };
        });
      } else {
        table = "deals";
        if (!effectivePipelineId || !stages.length) throw new Error("Choose a pipeline that has at least one stage.");
        items = toImport.map((row) => {
          const v = row.values as DealImportValues;
          const stage = matchStage(stages, v.stage) as PipelineStage;
          return {
            row,
            payload: {
              title: v.title,
              value: v.value,
              probability: v.probability ?? defaultProbabilityForStage(stage),
              close_date: v.close_date,
              notes: v.notes,
              pipeline_id: effectivePipelineId,
              stage_id: stage.id,
              company_id: companyIdFor(v.company),
              contact_id: v.contact_email ? (contactIds.get(v.contact_email) ?? null) : null,
              owner_id: user.id,
              created_by: user.id,
            },
          };
        });
      }
      setProgress({ done: skipped, total: valid.length });

      // --- Insert in batches; on a batch error, retry row by row to pinpoint failures ---
      let done = skipped;
      let stopped = false;
      // Once the plan's contact limit is hit, every remaining row would fail the same way.
      let limitMessage: string | null = null;
      for (const batch of chunk(items, BATCH_SIZE)) {
        if (stopRef.current || limitMessage) {
          stopped = true;
          batch.forEach((b) => fail(b.row, limitMessage ?? "Not imported (import stopped)"));
          done += batch.length;
          setProgress({ done, total: valid.length });
          continue;
        }
        const { error } = await supabase.from(table).insert(batch.map((b) => b.payload) as never);
        if (!error) {
          created += batch.length;
        } else {
          for (const b of batch) {
            if (limitMessage) {
              fail(b.row, limitMessage);
              continue;
            }
            const { error: rowError } = await supabase.from(table).insert(b.payload as never);
            if (rowError) {
              if (isPlanLimitError(rowError)) limitMessage = errorMessage(rowError);
              fail(b.row, errorMessage(rowError));
            } else created++;
          }
        }
        done += batch.length;
        setProgress({ done, total: valid.length });
      }

      setResult({ created, skipped, failed, companiesCreated, stopped });
      setStep("done");
      if (created > 0) toast.success(`Imported ${formatNumber(created)} ${entity}`);
      else toast.warning("Nothing was imported", { description: "Check the failed rows report for details." });
    } catch (err) {
      toast.error("Import failed", { description: errorMessage(err) });
      // Rows already written stay; report what happened so far.
      setResult({ created, skipped, failed, companiesCreated, stopped: true });
      setStep("done");
    } finally {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["export-counts"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-usage"] });
    }
  };

  const downloadFailures = () => {
    if (!result?.failed.length) return;
    const { headers: h, rows: r } = failedRowsCsv(headers, result.failed);
    downloadCsv(`${entity}-import-failed-rows.csv`, h, r);
  };

  const fields = IMPORT_FIELDS[entity];
  const previewRows = (previewFilter === "problems" ? validated.filter((r) => r.errors.length) : validated).slice(0, 10);
  const previewColumns = fields.filter(
    (f) => f.key !== "full_name" && (mapping[f.key] || (entity === "contacts" && (f.key === "first_name" || f.key === "last_name") && mapping.full_name)),
  );

  return (
    <div className="space-y-6">
      <Stepper step={step} />

      {step === "upload" && (
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">What are you importing?</legend>
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
              {ENTITIES.map((e) => {
                const active = entity === e.value;
                return (
                  <button
                    key={e.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setEntity(e.value)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-foreground ring-1 ring-foreground" : "border-border hover:bg-secondary/40",
                    )}
                  >
                    <e.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    <div>
                      <p className="text-sm font-medium">{e.label}</p>
                      <p className="text-xs text-muted-foreground">{e.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Official Goom CRM Branded Template Card */}
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold">
                    Goom CRM Official {templateCfg.title} Template
                  </h3>
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                    Brand Template
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {templateCfg.description} Includes a comprehensive <strong>Field Guide & Instructions sheet</strong>, pre-configured headers, auto-filters, and verified sample rows.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
                <Button
                  onClick={handleDownloadExcel}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-medium"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Download Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadCsv}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download CSV (.csv)
                </Button>
              </div>
            </div>

            {/* Quick Field Specification Pills */}
            <div className="mt-4 pt-3.5 border-t border-border/80 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground mr-1">Columns included:</span>
              {templateCfg.fields.map((f) => (
                <span
                  key={f.key}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-mono transition-colors",
                    f.required
                      ? "bg-primary/10 text-primary border border-primary/20 font-semibold"
                      : "bg-secondary text-secondary-foreground border border-border/60"
                  )}
                  title={`${f.label} (${f.type}): ${f.description}`}
                >
                  {f.key}
                  {f.required && <span className="text-destructive font-bold ml-0.5">*</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Drag & Drop Import File Upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors",
              dragging ? "border-foreground bg-secondary/60" : "border-border bg-card/40",
            )}
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
              {reading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />}
            </div>
            <p className="text-sm font-medium">{reading ? "Reading file…" : "Drop an Excel (.xlsx) or CSV file here"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Up to 5 MB. Multi-sheet Excel workbooks and standard CSV files supported.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => fileRef.current?.click()} disabled={reading}>
                <Upload className="mr-1.5 h-4 w-4" aria-hidden /> Choose file
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              tabIndex={-1}
              aria-label="Spreadsheet or CSV file"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        </div>
      )}

      {step === "map" && (
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Map columns</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span> · {formatNumber(rows.length)} rows. We matched what we could — check the {entity} fields below.
            </p>
          </div>
          <div className="divide-y divide-border">
            {fields.map((f) => {
              const header = mapping[f.key];
              const sample = header ? rows.find((r) => r[header])?.[header] : undefined;
              return (
                <div key={f.key} className="grid gap-2 px-5 py-3 sm:grid-cols-[12rem_16rem_1fr] sm:items-center">
                  <div>
                    <Label htmlFor={`map-${f.key}`} className="text-sm">
                      {f.label}
                      {f.required && <span className="text-destructive"> *</span>}
                    </Label>
                    {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                  </div>
                  <Select value={header || NONE} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === NONE ? "" : v }))}>
                    <SelectTrigger id={`map-${f.key}`} className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Don't import</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="truncate text-xs text-muted-foreground">{sample ? <>e.g. “{sample}”</> : header ? "No values in this column" : ""}</p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
            <Button variant="ghost" onClick={reset}>
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> Choose another file
            </Button>
            <div className="flex items-center gap-3">
              {missing.length > 0 && (
                <p className="text-xs text-destructive" role="alert">
                  Map a column to {missing.map((f) => f.label).join(", ")}
                  {entity === "contacts" ? " (or Full name)" : ""}.
                </p>
              )}
              <Button onClick={() => setStep("preview")} disabled={missing.length > 0}>
                Review rows <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </section>
      )}

      {step === "preview" && contactLimitRisk && (
        <LimitNotice
          limit="contacts"
          count={readyCount}
          action={skipDuplicates ? "import every row (existing contacts are skipped, so some may still fit; the import stops at the limit)" : "import all of these contacts"}
        />
      )}
      {(step === "preview" || step === "importing") && (
        <section className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Review</h2>
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatNumber(validated.length)} rows · <span className="text-foreground">{formatNumber(validated.length - invalidCount)} ready</span>
                {invalidCount > 0 && <span className="text-destructive"> · {formatNumber(invalidCount)} with problems (will be skipped)</span>}
              </p>
            </div>
            <ToggleGroup
              type="single"
              size="sm"
              value={previewFilter}
              onValueChange={(v) => v && setPreviewFilter(v as "all" | "problems")}
              aria-label="Rows to preview"
            >
              <ToggleGroupItem value="all" className="text-xs">
                First 10 rows
              </ToggleGroupItem>
              <ToggleGroupItem value="problems" className="text-xs" disabled={!invalidCount}>
                Problems only
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th scope="col" className="h-9 w-14 px-3 text-left text-xs font-medium text-muted-foreground">
                    Row
                  </th>
                  <th scope="col" className="h-9 w-10 px-2 text-left text-xs font-medium text-muted-foreground">
                    <span className="sr-only">Status</span>
                  </th>
                  {previewColumns.map((f) => (
                    <th key={f.key} scope="col" className="h-9 whitespace-nowrap px-3 text-left text-xs font-medium text-muted-foreground">
                      {f.label}
                    </th>
                  ))}
                  {entity === "deals" && (
                    <th scope="col" className="h-9 whitespace-nowrap px-3 text-left text-xs font-medium text-muted-foreground">
                      Imported stage
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.index} className="border-t border-border/70 align-top">
                    <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{r.rowNumber}</td>
                    <td className="px-2 py-2">
                      {r.errors.length ? (
                        <AlertCircle className="h-4 w-4 text-destructive" aria-label="Has problems" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-success" aria-label="Ready" />
                      )}
                    </td>
                    {previewColumns.map((f) => (
                      <td key={f.key} className="max-w-[14rem] truncate px-3 py-2">
                        {renderValue(f.key, (r.values as unknown as Record<string, unknown>)[f.key], organization?.currency)}
                      </td>
                    ))}
                    {entity === "deals" && (
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{matchStage(stages, (r.values as DealImportValues).stage)?.name ?? "—"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {previewRows.some((r) => r.errors.length) && (
              <ul className="space-y-1 border-t border-border px-5 py-3 text-xs text-destructive">
                {previewRows
                  .filter((r) => r.errors.length)
                  .map((r) => (
                    <li key={r.index}>
                      <span className="tabular-nums">Row {r.rowNumber}:</span> {r.errors.join("; ")}
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-border px-5 py-4">
            <h3 className="text-sm font-semibold">Options</h3>
            {entity !== "deals" && (
              <div className="flex items-start gap-2">
                <Checkbox id="opt-skip" checked={skipDuplicates} onCheckedChange={(v) => setSkipDuplicates(v === true)} disabled={step === "importing"} />
                <Label htmlFor="opt-skip" className="text-sm font-normal leading-snug">
                  {entity === "contacts" ? "Skip contacts whose email already exists" : "Skip companies whose name already exists"}
                  <span className="block text-xs text-muted-foreground">Also skips repeats within this file.</span>
                </Label>
              </div>
            )}
            {entity !== "companies" && mapping.company && (
              <div className="flex items-start gap-2">
                <Checkbox id="opt-companies" checked={createCompanies} onCheckedChange={(v) => setCreateCompanies(v === true)} disabled={step === "importing"} />
                <Label htmlFor="opt-companies" className="text-sm font-normal leading-snug">
                  Create companies that don't exist yet
                  <span className="block text-xs text-muted-foreground">Otherwise rows are linked only to companies that already exist.</span>
                </Label>
              </div>
            )}
            {entity === "deals" && (
              <div className="max-w-xs space-y-1.5">
                <Label htmlFor="opt-pipeline">Pipeline</Label>
                <Select value={effectivePipelineId} onValueChange={setPipelineId} disabled={step === "importing"}>
                  <SelectTrigger id="opt-pipeline" className="h-9 text-sm">
                    <SelectValue placeholder="Choose a pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {(pipelines ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Stages are matched by name; unmatched rows go to the first stage.</p>
                {pipelines && !pipelines.length && (
                  <p className="text-xs text-destructive">
                    No pipeline yet. <Link to="/pipeline" className="underline">Set one up first</Link>.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            {step === "importing" ? (
              <div className="flex w-full flex-wrap items-center gap-3">
                <div className="min-w-[12rem] flex-1 space-y-1.5">
                  <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} aria-label="Import progress" />
                  <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                    Importing… {formatNumber(progress.done)} of {formatNumber(progress.total)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => (stopRef.current = true)}>
                  Stop
                </Button>
              </div>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setStep("map")}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> Back to mapping
                </Button>
                <Button
                  onClick={runImport}
                  disabled={
                    validated.length - invalidCount === 0 ||
                    (entity === "deals" && (!effectivePipelineId || !stages.length)) ||
                    overContactLimit
                  }
                >
                  <Upload className="mr-1.5 h-4 w-4" aria-hidden />
                  Import {formatNumber(validated.length - invalidCount)} {entity}
                </Button>
              </>
            )}
          </div>
        </section>
      )}

      {step === "done" && result && (
        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            {result.failed.length === 0 ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 text-warning" aria-hidden />
            )}
            <div>
              <h2 className="text-sm font-semibold">{result.stopped ? "Import stopped" : "Import complete"}</h2>
              <p className="text-sm text-muted-foreground">
                {fileName}
                {result.companiesCreated > 0 &&
                  ` · ${formatNumber(result.companiesCreated)} new ${result.companiesCreated === 1 ? "company" : "companies"} created along the way`}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            {[
              { label: "Created", value: result.created },
              { label: "Skipped (duplicates)", value: result.skipped },
              { label: "Failed", value: result.failed.length },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border px-4 py-3">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className={cn("text-2xl font-semibold tabular-nums", s.label === "Failed" && s.value > 0 && "text-destructive")}>{formatNumber(s.value)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            {result.failed.length > 0 && (
              <Button variant="outline" onClick={downloadFailures}>
                <Download className="mr-1.5 h-4 w-4" aria-hidden /> Download failed rows
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to={entity === "deals" ? "/pipeline" : `/${entity}`}>View {entity}</Link>
            </Button>
            <Button onClick={reset}>Import another file</Button>
          </div>
        </section>
      )}
    </div>
  );
}

function renderValue(key: string, v: unknown, currency?: string): React.ReactNode {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return <span className="text-muted-foreground">—</span>;
  if (Array.isArray(v)) return v.join(", ");
  if (key === "value" && typeof v === "number") return <span className="tabular-nums">{formatCurrency(v, currency)}</span>;
  if (key === "probability" && typeof v === "number") return <span className="tabular-nums">{v}%</span>;
  return String(v);
}

// =====================================================================================
// Export
// =====================================================================================

type ExportEntity = "contacts" | "companies" | "deals" | "activities" | "tasks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const person = (c: { first_name?: string; last_name?: string } | null | undefined) => (c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : "");

const EXPORTS: Record<ExportEntity, { label: string; icon: LucideIcon; select: string; headers: string[]; toRow: (r: Row) => unknown[] }> = {
  contacts: { label: "Contacts", icon: Users, select: CONTACT_SELECT, headers: CONTACT_EXPORT_HEADERS, toRow: (r) => contactExportRow(r) },
  companies: { label: "Companies", icon: Building2, select: "*", headers: COMPANY_EXPORT_HEADERS, toRow: (r) => companyExportRow(r) },
  deals: {
    label: "Deals",
    icon: Briefcase,
    select: "*, companies(name), contacts(first_name, last_name, email), pipeline_stages(name), pipelines(name)",
    headers: ["Title", "Value", "Probability", "Stage", "Pipeline", "Company", "Contact", "Contact email", "Close date", "Notes", "Created"],
    toRow: (d) => [
      d.title,
      d.value ?? 0,
      d.probability ?? "",
      d.pipeline_stages?.name ?? "",
      d.pipelines?.name ?? "",
      d.companies?.name ?? "",
      person(d.contacts),
      d.contacts?.email ?? "",
      d.close_date ?? "",
      d.notes ?? "",
      String(d.created_at).slice(0, 10),
    ],
  },
  activities: {
    label: "Activities",
    icon: History,
    select: "*, contacts(first_name, last_name), deals(title)",
    headers: ["Type", "Title", "Description", "Contact", "Deal", "Created"],
    toRow: (a) => [a.type, a.title, a.description ?? "", person(a.contacts), a.deals?.title ?? "", String(a.created_at).slice(0, 19).replace("T", " ")],
  },
  tasks: {
    label: "Tasks",
    icon: CheckSquare,
    select: "*, contacts(first_name, last_name), deals(title)",
    headers: ["Title", "Description", "Due date", "Priority", "Completed", "Contact", "Deal", "Created"],
    toRow: (t) => [t.title, t.description ?? "", t.due_date ?? "", t.priority ?? "", t.completed ? "Yes" : "No", person(t.contacts), t.deals?.title ?? "", String(t.created_at).slice(0, 10)],
  },
};

function ExportPanel() {
  const counts = useQuery({
    queryKey: ["export-counts"],
    queryFn: async () => {
      const out: Partial<Record<ExportEntity, number>> = {};
      await Promise.all(
        (Object.keys(EXPORTS) as ExportEntity[]).map(async (t) => {
          const { count, error } = await supabase.from(t).select("id", { count: "exact", head: true });
          if (error) throw error;
          out[t] = count ?? 0;
        }),
      );
      return out;
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Exports include every record in this workspace as a UTF-8 CSV file that opens in Excel, Numbers or Google Sheets.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(EXPORTS) as ExportEntity[]).map((t) => (
          <ExportCard key={t} entity={t} count={counts.data?.[t]} loadingCount={counts.isLoading} countError={!!counts.error} />
        ))}
      </div>
    </div>
  );
}

function ExportCard({ entity, count, loadingCount, countError }: { entity: ExportEntity; count?: number; loadingCount: boolean; countError: boolean }) {
  const cfg = EXPORTS[entity];
  const [progress, setProgress] = useState<{ loaded: number; total: number | null } | null>(null);

  const run = async (format: "xlsx" | "csv" = "xlsx") => {
    setProgress({ loaded: 0, total: count ?? null });
    try {
      const rows = await fetchAllRows<Row>(
        (from, to) => (supabase.from(entity).select(cfg.select, { count: "exact" }) as Row).order("id").range(from, to),
        { onProgress: (loaded, total) => setProgress({ loaded, total }) },
      );
      const rowData = rows.map(cfg.toRow);
      const dateStr = new Date().toISOString().slice(0, 10);
      if (format === "xlsx") {
        exportToExcel(`Goom-CRM-${cfg.label}-${dateStr}.xlsx`, cfg.label, cfg.headers, rowData);
      } else {
        downloadCsv(`Goom-CRM-${cfg.label}-${dateStr}.csv`, cfg.headers, rowData);
      }
      toast.success(`Exported ${formatNumber(rows.length)} ${entity} to ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(`Couldn't export ${entity}`, { description: errorMessage(err) });
    } finally {
      setProgress(null);
    }
  };

  const pct = progress?.total ? Math.min(100, (progress.loaded / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <cfg.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-semibold">{cfg.label}</h3>
          <p className="text-xs tabular-nums text-muted-foreground">
            {loadingCount ? "Counting…" : countError || count === undefined ? "—" : `${formatNumber(count)} ${count === 1 ? "record" : "records"}`}
          </p>
        </div>
      </div>
      {progress ? (
        <div className="space-y-1.5">
          <Progress value={pct} aria-label={`Exporting ${entity}`} />
          <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
            Loaded {formatNumber(progress.loaded)}
            {progress.total !== null && ` of ${formatNumber(progress.total)}`}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => run("xlsx")}
            disabled={count === 0}
            className="flex-1 gap-1.5"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => run("csv")}
            disabled={count === 0}
            className="flex-1 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> CSV
          </Button>
        </div>
      )}
    </div>
  );
}
