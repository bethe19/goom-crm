import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Database, FileUp, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { useMyProfile, useUpdateMyProfile } from "@/hooks/useMyProfile";
import { useCompleteOnboarding } from "@/hooks/useOnboardingStatus";
import { useUpdateOrganization } from "@/hooks/useOrganization";
import { useSetWorkspacePlan } from "@/hooks/usePlan";
import { PLANS } from "@/lib/plans";
import { clearSelectedPlan, readSelectedPlan } from "./selectedPlan";
import { LimitNotice } from "@/components/settings/UpgradePrompt";
import { usePipelines, usePipelineStages } from "@/hooks/usePipelineStages";
import { createInvitation, type CreatedInvitation } from "@/hooks/useTeam";
import { loadSampleData } from "@/lib/sampleData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brand } from "@/components/Brand";
import { CopyButton, FieldError } from "@/components/settings/shared";
import { CURRENCIES, ROLE_OPTIONS, emailSchema, errorMessage, fullNameSchema } from "@/components/settings/validation";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  /** Called once onboarding is persisted (finished or skipped). */
  onComplete: () => void;
}

type StepId = "profile" | "workspace" | "pipeline" | "team" | "start" | "done";

const ADMIN_STEPS: StepId[] = ["profile", "workspace", "pipeline", "team", "start"];
const MEMBER_STEPS: StepId[] = ["profile", "done"];

/** First-run setup. Every exit path (finish or skip) calls `complete_onboarding()` so it never shows again. */
export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { isAdmin, organization } = useAuth();
  const navigate = useNavigate();
  const complete = useCompleteOnboarding();
  const steps = isAdmin ? ADMIN_STEPS : MEMBER_STEPS;
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const step = steps[index];

  const next = () => setIndex((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setIndex((i) => Math.max(i - 1, 0));

  /** Persists completion, then leaves the wizard (optionally to a route). */
  const finish = async (to = "/dashboard") => {
    setFinishing(true);
    try {
      if (isAdmin) await ensurePipeline();
      await complete.mutateAsync();
      onComplete();
      navigate(to, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
      setFinishing(false);
    }
  };

  const titles: Record<StepId, { title: string; description: string }> = {
    profile: { title: "Tell us about you", description: "This is how teammates will see you." },
    workspace: { title: "Name your workspace", description: "Everything your team adds lives here." },
    pipeline: { title: "Your sales pipeline", description: "Deals move through these stages. You can change them anytime." },
    team: { title: "Invite your team", description: "Optional — you can always do this later from Settings → Team." },
    start: { title: "How do you want to start?", description: "Pick one. Nothing here is permanent." },
    done: {
      title: `You're all set${organization ? ` in ${organization.name}` : ""}`,
      description: "Your teammates' deals, contacts and tasks are ready for you.",
    },
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Brand size="sm" />
        {step !== "done" && (
          <Button variant="ghost" size="sm" onClick={() => finish()} disabled={finishing}>
            {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Skip setup
          </Button>
        )}
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-lg space-y-6">
          {steps.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Step {index + 1} of {steps.length}
              </p>
              <div className="flex gap-1.5" aria-hidden>
                {steps.map((s, i) => (
                  <div
                    key={s}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors duration-200",
                      i <= index ? "bg-foreground" : "bg-secondary",
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{titles[step].title}</h1>
            <p className="text-sm text-muted-foreground">{titles[step].description}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            {step === "profile" && <ProfileStep onNext={next} />}
            {step === "workspace" && <WorkspaceStep onBack={back} onNext={next} />}
            {step === "pipeline" && <PipelineStep onBack={back} onNext={next} />}
            {step === "team" && <TeamStep onBack={back} onNext={next} />}
            {step === "start" && <StartStep onBack={back} finishing={finishing} onFinish={finish} />}
            {step === "done" && (
              <div className="space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <Check className="h-5 w-5" aria-hidden />
                </div>
                <p className="text-sm text-muted-foreground">
                  Tip: press <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 text-xs">Ctrl K</kbd> anywhere to
                  search deals, contacts and companies.
                </p>
                <div className="flex justify-end">
                  <Button onClick={() => finish()} disabled={finishing} autoFocus>
                    {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Go to dashboard
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Makes sure the workspace has at least one pipeline (the backend seeds one at signup; this is a safety net). */
async function ensurePipeline(): Promise<void> {
  const { data, error } = await supabase.from("pipelines").select("id").limit(1);
  if (error) throw error;
  if (data && data.length > 0) return;
  const { error: seedError } = await supabase.rpc("seed_default_pipeline");
  if (seedError) throw seedError;
}

function StepFooter({
  onBack,
  primaryLabel = "Continue",
  pending,
  pendingLabel = "Saving…",
  onPrimary,
  secondary,
}: {
  onBack?: () => void;
  primaryLabel?: string;
  pending?: boolean;
  pendingLabel?: string;
  onPrimary?: () => void;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      {onBack ? (
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        {secondary}
        <Button type={onPrimary ? "button" : "submit"} onClick={onPrimary} disabled={pending} className="gap-1.5">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {pendingLabel}
            </>
          ) : (
            <>
              {primaryLabel} <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---- Step 1: profile ---------------------------------------------------------------------------

const profileSchema = z.object({
  full_name: fullNameSchema,
  job_title: z.string().trim().max(100, "Keep it under 100 characters").optional(),
});

function ProfileStep({ onNext }: { onNext: () => void }) {
  const { user } = useAuth();
  const { data: profile, isLoading } = useMyProfile();
  const update = useUpdateMyProfile();
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", job_title: "" },
  });
  const { register, handleSubmit, formState, reset } = form;

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? "",
        job_title: profile.job_title ?? "",
      });
    }
  }, [profile, user, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ full_name: values.full_name.trim(), job_title: values.job_title?.trim() || null });
      onNext();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ob-name">
          Full name <span className="text-destructive" aria-hidden>*</span>
        </Label>
        <Input id="ob-name" autoFocus autoComplete="name" aria-invalid={!!formState.errors.full_name} {...register("full_name")} />
        <FieldError message={formState.errors.full_name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ob-title">Job title</Label>
        <Input id="ob-title" placeholder="e.g. Account Executive" autoComplete="organization-title" {...register("job_title")} />
        <FieldError message={formState.errors.job_title?.message} />
      </div>
      <StepFooter pending={formState.isSubmitting} />
    </form>
  );
}

// ---- Step 2: workspace -------------------------------------------------------------------------

const workspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(80, "Keep it under 80 characters"),
  currency: z.string().length(3),
});

function WorkspaceStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { organization, can } = useAuth();
  const update = useUpdateOrganization();
  const setPlan = useSetWorkspacePlan();
  const { register, handleSubmit, formState, setValue, watch } = useForm<z.infer<typeof workspaceSchema>>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: organization?.name ?? "", currency: organization?.currency ?? "USD" },
  });
  const currency = watch("currency");

  /** Applies the plan picked on the pricing page (if any). Never blocks onboarding. */
  const applySelectedPlan = async () => {
    const selected = readSelectedPlan();
    if (!selected) return;
    clearSelectedPlan();
    if (!can("workspace.billing") || selected === organization?.plan) return;
    try {
      await setPlan.mutateAsync(selected);
      toast.success(`Your workspace is on the ${PLANS[selected].name} plan`);
    } catch (err) {
      toast.error(`Couldn't switch to ${PLANS[selected].name}: ${errorMessage(err)}`, {
        description: "You can change the plan later in Settings → Plan & usage.",
      });
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    await applySelectedPlan();
    const unchanged = values.name.trim() === organization?.name && values.currency === organization?.currency;
    if (unchanged) return onNext();
    try {
      await update.mutateAsync({
        name: values.name,
        currency: values.currency,
        monthly_quota: organization?.monthly_quota ?? 0,
      });
      onNext();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ob-workspace">
          Workspace name <span className="text-destructive" aria-hidden>*</span>
        </Label>
        <Input id="ob-workspace" autoFocus placeholder="e.g. Acme Sales" aria-invalid={!!formState.errors.name} {...register("name")} />
        <p className="text-xs text-muted-foreground">Usually your company or team name.</p>
        <FieldError message={formState.errors.name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ob-currency">Currency</Label>
        <Select value={currency} onValueChange={(v) => setValue("currency", v, { shouldDirty: true })}>
          <SelectTrigger id="ob-currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} — {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Used for deal values, forecasts and reports.</p>
      </div>
      <StepFooter onBack={onBack} pending={formState.isSubmitting} />
    </form>
  );
}

// ---- Step 3: pipeline --------------------------------------------------------------------------

function PipelineStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const queryClient = useQueryClient();
  const pipelinesQuery = usePipelines();
  const pipeline = pipelinesQuery.data?.[0];
  const stagesQuery = usePipelineStages(pipeline?.id);
  const [seedError, setSeedError] = useState<string | null>(null);
  const seeding = useRef(false);

  // No pipeline yet (older accounts): create the default one automatically.
  useEffect(() => {
    if (!pipelinesQuery.isSuccess || pipelinesQuery.data.length > 0 || seeding.current) return;
    seeding.current = true;
    supabase.rpc("seed_default_pipeline").then(({ error }) => {
      if (error) {
        setSeedError(errorMessage(error));
        seeding.current = false;
      } else {
        queryClient.invalidateQueries({ queryKey: ["pipelines"] });
        queryClient.invalidateQueries({ queryKey: ["pipeline_stages"] });
      }
    });
  }, [pipelinesQuery.isSuccess, pipelinesQuery.data, queryClient]);

  const stages = stagesQuery.data ?? [];
  const loading = pipelinesQuery.isLoading || (!!pipeline && stagesQuery.isLoading) || (!pipeline && !seedError);

  return (
    <div className="space-y-4">
      {seedError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          We couldn't create your pipeline: {seedError}{" "}
          <button type="button" className="underline" onClick={() => { setSeedError(null); pipelinesQuery.refetch(); }}>
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading pipeline">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm font-medium">{pipeline?.name}</p>
          <ol className="space-y-1.5">
            {stages.map((stage, i) => (
              <li key={stage.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="w-4 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden />
                <span className="flex-1 truncate">{stage.name}</span>
                {stage.is_won && <span className="text-xs text-muted-foreground">Won</span>}
                {stage.is_lost && <span className="text-xs text-muted-foreground">Lost</span>}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">Rename, recolor or reorder stages later in Settings → Pipeline.</p>
        </>
      )}
      <StepFooter onBack={onBack} onPrimary={onNext} pending={loading && !seedError} pendingLabel="Preparing…" />
    </div>
  );
}

// ---- Step 4: team ------------------------------------------------------------------------------

interface InviteRow {
  key: number;
  email: string;
  role: AppRole;
  error?: string;
}

function TeamStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [rows, setRows] = useState<InviteRow[]>([{ key: 0, email: "", role: "rep" }]);
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState<CreatedInvitation[]>([]);
  const nextKey = useRef(1);

  const updateRow = (key: number, patch: Partial<InviteRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, error: patch.email !== undefined ? undefined : r.error } : r)));

  const send = async () => {
    const filled = rows.filter((r) => r.email.trim());
    if (filled.length === 0) return onNext();

    let hasError = false;
    const validated = rows.map((r) => {
      if (!r.email.trim()) return r;
      const parsed = emailSchema.safeParse(r.email);
      if (!parsed.success) {
        hasError = true;
        return { ...r, error: parsed.error.errors[0]?.message };
      }
      return r;
    });
    setRows(validated);
    if (hasError) return;

    setSending(true);
    const results: CreatedInvitation[] = [];
    const failed: InviteRow[] = [];
    for (const row of filled) {
      try {
        results.push(await createInvitation(row.email, row.role));
      } catch (err) {
        failed.push({ ...row, error: errorMessage(err) });
      }
    }
    setSending(false);
    setCreated((c) => [...c, ...results]);
    setRows(failed.length ? failed : [{ key: nextKey.current++, email: "", role: "rep" }]);
    if (results.length) toast.success(`${results.length} invitation${results.length === 1 ? "" : "s"} created`);
  };

  return (
    <div className="space-y-4">
      {created.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Invitations</p>
          <ul className="space-y-2">
            {created.map((inv) => (
              <li key={inv.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.emailSent ? "Email sent — you can also share the link." : "No email sent — copy the link and share it."}
                  </p>
                </div>
                <CopyButton value={inv.link} iconOnly label={`Copy invite link for ${inv.email}`} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <LimitNotice limit="seats" count={Math.max(1, rows.filter((r) => r.email.trim()).length)} action="invite everyone listed" />
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={row.key} className="space-y-1">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor={`ob-invite-${row.key}`} className="sr-only">
                  Teammate email {i + 1}
                </Label>
                <Input
                  id={`ob-invite-${row.key}`}
                  type="email"
                  placeholder="teammate@company.com"
                  autoFocus={i === 0 && created.length === 0}
                  value={row.email}
                  aria-invalid={!!row.error}
                  onChange={(e) => updateRow(row.key, { email: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
              </div>
              <Select value={row.role} onValueChange={(v) => updateRow(row.key, { role: v as AppRole })}>
                <SelectTrigger className="w-32 shrink-0" aria-label="Role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Remove row"
                  onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <FieldError message={row.error} />
          </div>
        ))}
        {rows.length < 10 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setRows((rs) => [...rs, { key: nextKey.current++, email: "", role: "rep" }])}
          >
            <Plus className="h-4 w-4" /> Add another
          </Button>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        onPrimary={rows.some((r) => r.email.trim()) ? send : onNext}
        primaryLabel={rows.some((r) => r.email.trim()) ? "Create invitations" : created.length ? "Continue" : "Skip for now"}
        pending={sending}
        pendingLabel="Inviting…"
        secondary={
          rows.some((r) => r.email.trim()) ? (
            <Button type="button" variant="ghost" size="sm" onClick={onNext} disabled={sending}>
              Skip
            </Button>
          ) : null
        }
      />
    </div>
  );
}

// ---- Step 5: how to start ----------------------------------------------------------------------

function StartStep({
  onBack,
  finishing,
  onFinish,
}: {
  onBack: () => void;
  finishing: boolean;
  onFinish: (to?: string) => Promise<void>;
}) {
  const [loadingSample, setLoadingSample] = useState(false);

  const loadSample = async () => {
    setLoadingSample(true);
    try {
      const result = await loadSampleData();
      toast.success(`Sample data added: ${result.deals} deals, ${result.contacts} contacts, ${result.companies} companies`);
      await onFinish("/dashboard");
    } catch (err) {
      const msg = err instanceof Error && !("code" in err) && !err.message.includes(":") ? err.message : errorMessage(err);
      toast.error(msg);
    } finally {
      setLoadingSample(false);
    }
  };

  const busy = finishing || loadingSample;
  const options = [
    {
      icon: Sparkles,
      title: "Load sample data",
      description: "Explore with a small set of fictional companies, deals and tasks. Delete it whenever you like.",
      onClick: loadSample,
      pending: loadingSample,
    },
    {
      icon: FileUp,
      title: "Import a CSV",
      description: "Bring contacts, companies or deals from a spreadsheet or another CRM.",
      onClick: () => onFinish("/data"),
      pending: false,
    },
    {
      icon: Database,
      title: "Start empty",
      description: "Add your first deal and contacts by hand.",
      onClick: () => onFinish("/dashboard"),
      pending: false,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {options.map(({ icon: Icon, title, description, onClick, pending }) => (
          <button
            key={title}
            type="button"
            disabled={busy}
            onClick={onClick}
            className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors duration-150 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" aria-hidden />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{pending ? "Adding sample data…" : title}</span>
              <span className="block text-sm text-muted-foreground">{description}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={busy} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    </div>
  );
}
