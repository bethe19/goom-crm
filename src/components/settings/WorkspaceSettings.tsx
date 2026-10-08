import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateOrganization } from "@/hooks/useOrganization";
import { useLeaveWorkspace } from "@/hooks/useTeam";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { FieldError, SettingsSection } from "./shared";
import { CURRENCIES, errorMessage, roleLabel } from "./validation";

const schema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(80, "Keep it under 80 characters"),
  currency: z.string().length(3, "Pick a currency"),
  monthly_quota: z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .min(0, "Quota can't be negative")
    .max(1_000_000_000_000, "That's too large"),
});
type Values = z.infer<typeof schema>;

export function WorkspaceSettings() {
  const { organization, can, userRole } = useAuth();
  const isAdmin = can("workspace.settings");
  const update = useUpdateOrganization();

  const { register, handleSubmit, formState, reset, watch, setValue } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: organization?.name ?? "",
      currency: organization?.currency ?? "ETB",
      monthly_quota: organization?.monthly_quota ?? 0,
    },
  });
  const currency = watch("currency");

  // The workspace context reloads after role or plan changes: refresh untouched fields but keep the
  // admin's unsaved edits (and the dirty state that enables "Save changes").
  useEffect(() => {
    if (organization) {
      reset(
        { name: organization.name, currency: organization.currency, monthly_quota: organization.monthly_quota },
        { keepDirtyValues: true, keepDirty: true },
      );
    }
  }, [organization, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ name: values.name, currency: values.currency, monthly_quota: values.monthly_quota });
      toast.success("Workspace updated");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  if (!organization) {
    return (
      <SettingsSection title="Workspace" description="Your workspace couldn't be loaded. Reload the page to try again." />
    );
  }

  if (!isAdmin) {
    const currencyInfo = CURRENCIES.find((c) => c.code === organization.currency);
    return (
      <div className="space-y-6">
        <SettingsSection
          title="Workspace"
          description={`You're ${userRole === "admin" ? "an" : "a"} ${roleLabel(userRole).toLowerCase()} in this workspace. Only admins can change these settings.`}
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Name</dt>
              <dd className="mt-0.5 font-medium">{organization.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Currency</dt>
              <dd className="mt-0.5 font-medium">
                {organization.currency}
                {currencyInfo ? ` — ${currencyInfo.label}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Monthly team quota</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {organization.monthly_quota > 0 ? formatCurrency(organization.monthly_quota, organization.currency) : "Not set"}
              </dd>
            </div>
          </dl>
        </SettingsSection>
        <LeaveWorkspaceSection />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate>
        <SettingsSection
          title="Workspace"
          description="Shared by everyone in this workspace."
          footer={
            <Button type="submit" disabled={formState.isSubmitting || !formState.isDirty}>
              {formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ws-name">
                Workspace name <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Input id="ws-name" aria-invalid={!!formState.errors.name} {...register("name")} />
              <FieldError message={formState.errors.name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-currency">Currency</Label>
              <Select value={currency} onValueChange={(v) => setValue("currency", v, { shouldDirty: true })}>
                <SelectTrigger id="ws-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(CURRENCIES.some((c) => c.code === currency) ? CURRENCIES : [{ code: currency, label: currency }, ...CURRENCIES]).map(
                    (c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} — {c.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Deal values are shown in this currency. Amounts aren't converted.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-quota">Monthly team quota</Label>
              <Input
                id="ws-quota"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="tabular-nums"
                aria-invalid={!!formState.errors.monthly_quota}
                {...register("monthly_quota")}
              />
              <p className="text-xs text-muted-foreground">Used for quota attainment on the dashboard and forecast. 0 hides it.</p>
              <FieldError message={formState.errors.monthly_quota?.message} />
            </div>
          </div>
        </SettingsSection>
      </form>
      <LeaveWorkspaceSection />
    </div>
  );
}

// ---- Leave workspace ---------------------------------------------------------------------------

function LeaveWorkspaceSection() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const leave = useLeaveWorkspace();
  const name = organization?.name ?? "this workspace";

  const onLeave = async () => {
    const ok = await confirm({
      title: `Leave ${name}?`,
      description: "You'll lose access to its deals, contacts and reports immediately. To come back, an admin will have to invite you again.",
      confirmLabel: "Leave workspace",
    });
    if (!ok) return;
    try {
      await leave.mutateAsync();
      toast.success(`You left ${name}`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <SettingsSection
      tone="danger"
      title="Leave workspace"
      description={`Remove yourself from ${name}. If you're its last admin, make someone else an admin first (Settings → Team).`}
    >
      <Button type="button" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={onLeave} disabled={leave.isPending}>
        {leave.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        {leave.isPending ? "Leaving…" : "Leave workspace"}
      </Button>
    </SettingsSection>
  );
}
