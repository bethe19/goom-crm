import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Briefcase, Building2, ExternalLink, Globe, Loader2, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRecordPermissions } from "@/hooks/useRecordPermissions";
import {
  useCompany,
  useCompanyActivities,
  useCompanyContacts,
  useCompanyDeals,
  useDeleteCompany,
  useDuplicateCompanyName,
  useUpdateCompany,
  type Company,
} from "@/hooks/useCompanies";
import { stageOutcome } from "@/hooks/usePipelineStages";
import { useDebounce } from "@/hooks/useDebounce";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/States";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { CreateContactDialog } from "@/components/contacts/CreateContactDialog";
import { CreateDealDialog } from "@/components/pipeline/CreateDealDialog";
import { ActivityTimeline, RelatedDealsList, SectionHeader } from "@/components/contacts/RelatedSections";
import { RecordAvatar } from "@/components/contacts/list-parts";
import { CompanyFormFields } from "@/components/companies/CompanyFormFields";
import { companyFormSchema, companyToForm, emptyCompanyForm, toCompanyPayload, type CompanyFormValues } from "@/components/companies/companyForm";
import { formatCurrency, formatFriendlyDate } from "@/lib/formatters";
import { sanitizeHref } from "@/lib/sanitize";
import { errorMessage } from "@/components/settings/validation";

interface CompanyDetailSheetProps {
  companyId: string | null;
  initialCompany?: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyDetailSheet({ companyId, initialCompany, open, onOpenChange }: CompanyDetailSheetProps) {
  const { data: company, isLoading, error, refetch } = useCompany(open ? companyId : null, initialCompany);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {isLoading && !company ? (
          <div className="space-y-4 p-6" aria-busy="true">
            <SheetTitle className="sr-only">Loading company</SheetTitle>
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3.5 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="p-6">
            <SheetTitle className="sr-only">Company</SheetTitle>
            <ErrorState error={error} onRetry={() => refetch()} compact />
          </div>
        ) : !company ? (
          <div className="p-6">
            <SheetTitle className="sr-only">Company not found</SheetTitle>
            <EmptyState compact icon={Building2} title="Company not found" description="It may have been deleted, or you don't have access to it." />
          </div>
        ) : (
          <CompanyDetail company={company} editing={editing} setEditing={setEditing} onClose={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function displayDomain(url: string) {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

function CompanyDetail({ company, editing, setEditing, onClose }: { company: Company; editing: boolean; setEditing: (v: boolean) => void; onClose: () => void }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { organization } = useAuth();
  const deleteCompany = useDeleteCompany();
  const { canDelete } = useRecordPermissions();
  const deletable = canDelete({ created_by: company.created_by });
  const contacts = useCompanyContacts(company.id);
  const deals = useCompanyDeals(company.id);
  const contactIds = useMemo(() => (contacts.data ?? []).map((c) => c.id), [contacts.data]);
  const dealIds = useMemo(() => (deals.data ?? []).map((d) => d.id), [deals.data]);
  const activities = useCompanyActivities(company.id, contactIds, dealIds);
  const [contactOpen, setContactOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);

  const openDeals = (deals.data ?? []).filter((d) => stageOutcome(d.pipeline_stages) === "open");
  const wonDeals = (deals.data ?? []).filter((d) => stageOutcome(d.pipeline_stages) === "won");
  const sum = (list: typeof openDeals) => list.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const website = company.website ? sanitizeHref(company.website) : "#";

  const handleDelete = async () => {
    const n = contacts.data?.length ?? 0;
    const ok = await confirm({
      title: `Delete ${company.name}?`,
      description: `${n > 0 ? `${n} ${n === 1 ? "contact" : "contacts"} and ` : ""}any deals stay in your workspace but will no longer be linked to this company. This can't be undone.`,
      confirmLabel: "Delete company",
    });
    if (!ok) return;
    try {
      await deleteCompany.mutateAsync(company.id);
      toast.success("Company deleted");
      onClose();
    } catch (err) {
      toast.error("Couldn't delete company", { description: errorMessage(err) });
    }
  };

  const stats: { label: string; value: string; hint?: string }[] = [
    { label: "Contacts", value: contacts.isLoading ? "…" : String(contacts.data?.length ?? 0) },
    { label: "Open pipeline", value: deals.isLoading ? "…" : formatCurrency(sum(openDeals), organization?.currency), hint: `${openDeals.length} open` },
    { label: "Won", value: deals.isLoading ? "…" : formatCurrency(sum(wonDeals), organization?.currency), hint: `${wonDeals.length} won` },
  ];

  return (
    <>
      <div className="border-b border-border px-6 pb-4 pt-6">
        <div className="flex items-start gap-3 pr-8">
          <RecordAvatar name={company.name} square className="h-12 w-12 text-sm" />
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-lg font-semibold tracking-tight">{company.name}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-x-2 text-sm">
              <span>{company.industry || "No industry"}</span>
              {company.website && website !== "#" && (
                <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-foreground hover:underline">
                  <Globe className="h-3.5 w-3.5" aria-hidden />
                  {displayDomain(company.website)}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </SheetDescription>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card px-3 py-2">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="truncate text-sm font-semibold tabular-nums">{s.value}</dd>
              {s.hint && <dd className="text-xs text-muted-foreground tabular-nums">{s.hint}</dd>}
            </div>
          ))}
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setContactOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden /> Add contact
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDealOpen(true)}>
            <Briefcase className="h-4 w-4" aria-hidden /> Add deal
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-6 px-6 py-5">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Details</h3>
            {!editing && (
              <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </Button>
            )}
          </div>
          {editing ? (
            <CompanyEditForm company={company} onDone={() => setEditing(false)} />
          ) : (
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Industry</dt>
              <dd>{company.industry || <span className="text-muted-foreground">—</span>}</dd>
              <dt className="text-muted-foreground">Website</dt>
              <dd className="truncate">
                {company.website && website !== "#" ? (
                  <a href={website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {displayDomain(company.website)}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Added</dt>
              <dd className="text-muted-foreground">{formatFriendlyDate(company.created_at)}</dd>
            </dl>
          )}
        </section>

        <Separator />

        <section>
          <SectionHeader
            title="People"
            count={contacts.data?.length}
            action={
              <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setContactOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add
              </Button>
            }
          />
          {contacts.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : contacts.error ? (
            <ErrorState compact error={contacts.error} onRetry={() => contacts.refetch()} />
          ) : !contacts.data?.length ? (
            <p className="text-sm text-muted-foreground">No contacts at this company yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {contacts.data.map((c) => {
                const name = `${c.first_name} ${c.last_name}`.trim();
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/contacts?open=${c.id}`)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <RecordAvatar name={name} className="h-7 w-7" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="truncate text-xs text-muted-foreground">{[c.position, c.email].filter(Boolean).join(" · ") || "—"}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Separator />

        <section>
          <SectionHeader
            title="Deals"
            count={deals.data?.length}
            action={
              <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setDealOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add
              </Button>
            }
          />
          <RelatedDealsList query={deals} emptyText="No deals with this company yet." />
        </section>

        <Separator />

        <section>
          <SectionHeader title="Recent activity" />
          {contactIds.length + dealIds.length === 0 && !contacts.isLoading && !deals.isLoading ? (
            <p className="text-sm text-muted-foreground">Activity logged on this company's contacts and deals shows up here.</p>
          ) : (
            <ActivityTimeline query={activities} emptyText="No activity logged yet." showContact />
          )}
        </section>

        <Separator />

        <div className="flex justify-end pb-2">
          {deletable ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
              disabled={deleteCompany.isPending}
            >
              {deleteCompany.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              {deleteCompany.isPending ? "Deleting…" : "Delete company"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Only the person who added this company, a manager or an admin can delete it.</p>
          )}
        </div>
      </div>

      <CreateContactDialog open={contactOpen} onOpenChange={setContactOpen} defaultCompany={{ id: company.id, name: company.name }} />
      <CreateDealDialog open={dealOpen} onOpenChange={setDealOpen} defaultCompanyId={company.id} />
    </>
  );
}

function CompanyEditForm({ company, onDone }: { company: Company; onDone: () => void }) {
  const navigate = useNavigate();
  const update = useUpdateCompany();
  const form = useForm<CompanyFormValues>({ resolver: zodResolver(companyFormSchema), defaultValues: emptyCompanyForm });
  const { handleSubmit, reset, watch, formState } = form;

  useEffect(() => {
    reset(companyToForm(company));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const name = useDebounce(watch("name") ?? "", 400);
  const changed = name.trim().toLowerCase() !== company.name.toLowerCase() ? name : "";
  const { data: duplicate } = useDuplicateCompanyName(changed, company.id);

  const onSubmit = async (values: CompanyFormValues) => {
    try {
      await update.mutateAsync({ id: company.id, ...toCompanyPayload(values) });
      toast.success("Company updated");
      onDone();
    } catch (err) {
      toast.error("Couldn't save changes", { description: errorMessage(err) });
    }
  };
  const pending = formState.isSubmitting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-border bg-card p-4" noValidate>
      <CompanyFormFields form={form} idPrefix={`edit-company-${company.id}`} autoFocus />
      {duplicate && (
        <p role="status" className="text-xs text-warning">
          Another company is already named “{duplicate.name}”.{" "}
          <button type="button" className="underline" onClick={() => navigate(`/companies?open=${duplicate.id}`)}>
            Open it
          </button>
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending || !formState.isDirty}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
