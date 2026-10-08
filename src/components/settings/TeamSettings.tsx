import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Clock, Loader2, MailCheck, RefreshCw, Send, Trash2, UserMinus, Users } from "lucide-react";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import {
  useCreateInvitation,
  useInvitations,
  useMembers,
  useRemoveMember,
  useRevokeInvitation,
  useUpdateMemberRole,
  type CreatedInvitation,
  type Invitation,
  type Member,
} from "@/hooks/useTeam";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate, formatRelativeDate } from "@/lib/formatters";
import { usePlan } from "@/hooks/usePlan";
import { Link } from "react-router-dom";
import { LimitNotice } from "./UpgradePrompt";
import { CopyButton, FieldError, SettingsSection } from "./shared";
import { ROLE_OPTIONS, emailSchema, errorMessage, initials, invitableRoles, inviteLink, roleLabel } from "./validation";

export function TeamSettings() {
  const { can } = useAuth();
  const canInvite = can("team.invite");
  // The most recent invitation, shown with its link under the invite form.
  const [last, setLast] = useState<CreatedInvitation | null>(null);
  // A resend replaces the token: keep the link under the form in sync if it's for the same person.
  const onReinvited = (result: CreatedInvitation) => setLast((prev) => (prev && prev.email === result.email ? result : prev));
  return (
    <div className="space-y-6">
      {canInvite && <InviteSection last={last} onCreated={setLast} />}
      <MembersSection />
      {canInvite && <PendingInvitesSection onReinvited={onReinvited} />}
    </div>
  );
}

// ---- Invite ------------------------------------------------------------------------------------

const inviteSchema = z.object({ email: emailSchema, role: z.enum(["admin", "manager", "rep"]) });

/** True when an invitation is past its expiry date. */
function isExpired(inv: Invitation): boolean {
  return !!inv.expires_at && new Date(inv.expires_at).getTime() < Date.now();
}

function InviteSection({ last, onCreated }: { last: CreatedInvitation | null; onCreated: (result: CreatedInvitation) => void }) {
  const { can } = useAuth();
  const { wouldExceed } = usePlan();
  const create = useCreateInvitation();
  const members = useMembers();
  const invitations = useInvitations();
  const canInviteAnyRole = can("team.invite_any_role");
  const seatsFull = wouldExceed("seats");
  const { register, handleSubmit, formState, setValue, watch, reset, setError } = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "rep" },
  });
  const role = watch("role");
  const typedEmail = (watch("email") ?? "").trim().toLowerCase();
  // Re-inviting someone with a live pending invitation replaces it without using another seat.
  const isReinvite = !!typedEmail && !!invitations.data?.some((inv) => inv.email.toLowerCase() === typedEmail && !isExpired(inv));
  const blockedBySeats = seatsFull && !isReinvite;
  // Mirrors create_invitation: admins invite any role, managers invite reps only.
  const roleOptions = invitableRoles(canInviteAnyRole);

  const onSubmit = handleSubmit(async (values) => {
    const email = values.email.trim().toLowerCase();
    if (members.data?.some((m) => m.email?.toLowerCase() === email)) {
      setError("email", { message: "This person is already a member" });
      return;
    }
    try {
      const result = await create.mutateAsync({ email, role: values.role });
      onCreated(result);
      reset({ email: "", role: values.role });
      toast.success(result.emailSent ? `Invitation emailed to ${email}` : `Invitation created for ${email}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  return (
    <SettingsSection
      title="Invite teammates"
      description={
        canInviteAnyRole
          ? "They'll join this workspace with the role you choose."
          : "Managers can invite sales reps. Ask an admin to invite managers or admins."
      }
    >
      <LimitNotice limit="seats" action="invite anyone else" className="mb-4" />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="teammate@company.com"
              aria-invalid={!!formState.errors.email}
              {...register("email")}
            />
            <FieldError message={formState.errors.email?.message} />
          </div>
          <div className="space-y-1.5 sm:w-40">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(v) => setValue("role", v as AppRole)} disabled={roleOptions.length === 1}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:pt-6">
            <Button type="submit" className="w-full sm:w-auto" disabled={formState.isSubmitting || blockedBySeats}>
              {formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Inviting…
                </>
              ) : (
                "Send invite"
              )}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{ROLE_OPTIONS.find((r) => r.value === role)?.description}.</p>
      </form>

      {last && (
        <div role="status" className="mt-4 space-y-3 rounded-lg border border-border bg-secondary/40 p-4">
          <div className="flex items-start gap-2 text-sm">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              {last.emailSent ? (
                <>
                  We emailed an invitation to <span className="font-medium">{last.email}</span>. You can also share this link:
                </>
              ) : last.emailError ? (
                <>
                  We couldn't email <span className="font-medium">{last.email}</span>: {last.emailError} Share this link with them
                  instead:
                </>
              ) : (
                <>
                  Email delivery isn't set up for this workspace, so no email was sent. Share this link with{" "}
                  <span className="font-medium">{last.email}</span>:
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={last.link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
            <CopyButton value={last.link} />
          </div>
        </div>
      )}
    </SettingsSection>
  );
}

// ---- Members -----------------------------------------------------------------------------------

function MembersSection() {
  const { user, can } = useAuth();
  const isAdmin = can("team.manage_roles");
  const members = useMembers();
  const updateRole = useUpdateMemberRole();
  const remove = useRemoveMember();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  const adminCount = members.data?.filter((m) => m.role === "admin").length ?? 0;

  const changeRole = async (member: Member, role: AppRole) => {
    if (role === member.role) return;
    if (member.user_id === user?.id && member.role === "admin") {
      const ok = await confirm({
        title: "Change your own role?",
        description: "You'll lose admin access to workspace settings and member management.",
        confirmLabel: `Make me ${roleLabel(role).toLowerCase()}`,
      });
      if (!ok) return;
    }
    setBusyId(member.user_id);
    try {
      await updateRole.mutateAsync({ userId: member.user_id, role });
      toast.success(`${member.full_name || member.email} is now ${roleLabel(role).toLowerCase()}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (member: Member) => {
    const name = member.full_name || member.email || "this member";
    const ok = await confirm({
      title: `Remove ${name}?`,
      description:
        "They'll lose access to this workspace immediately. Their deals and open tasks will be reassigned to you; contacts and activities stay in the workspace.",
      confirmLabel: "Remove member",
    });
    if (!ok) return;
    setBusyId(member.user_id);
    try {
      await remove.mutateAsync(member.user_id);
      toast.success(`${name} was removed`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SettingsSection
      title="Members"
      description={members.data ? `${members.data.length} ${members.data.length === 1 ? "person" : "people"} in this workspace.` : undefined}
    >
      {members.isLoading ? (
        <ListSkeleton rows={3} />
      ) : members.isError ? (
        <ErrorState compact error={members.error} title="Couldn't load members" onRetry={() => members.refetch()} />
      ) : !members.data?.length ? (
        <EmptyState compact icon={Users} title="No members yet" description="Invite a teammate to get started." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {members.data.map((m) => {
            const isSelf = m.user_id === user?.id;
            const lastAdmin = m.role === "admin" && adminCount <= 1;
            const busy = busyId === m.user_id;
            return (
              <li key={m.user_id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={m.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="text-xs">{initials(m.full_name, m.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {m.full_name || m.email || "Unnamed member"}
                      {isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[m.job_title, m.email].filter(Boolean).join(" · ")}
                      {m.joined_at && <> · joined {formatRelativeDate(m.joined_at)}</>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-12 sm:pl-0">
                  {isAdmin ? (
                    <Select value={m.role} onValueChange={(v) => changeRole(m, v as AppRole)} disabled={busy || lastAdmin}>
                      <SelectTrigger className="h-8 w-32" aria-label={`Role for ${m.full_name || m.email}`}>
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SelectValue />}
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={m.role === "admin" ? "default" : "secondary"}>{roleLabel(m.role)}</Badge>
                  )}
                  {isAdmin && !isSelf && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${m.full_name || m.email}`}
                            disabled={busy || lastAdmin}
                            onClick={() => removeMember(m)}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{lastAdmin ? "The last admin can't be removed" : "Remove from workspace"}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {isAdmin && adminCount === 1 && (members.data?.length ?? 0) > 1 && (
        <p className="mt-3 text-xs text-muted-foreground">Every workspace needs at least one admin. Promote someone before changing the last admin.</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {isAdmin ? "" : "Only admins can change roles or remove members. "}
        <Link to="/settings?tab=roles" className="font-medium text-foreground underline underline-offset-2">
          What can each role do?
        </Link>
      </p>
    </SettingsSection>
  );
}

// ---- Pending invitations -----------------------------------------------------------------------

function PendingInvitesSection({ onReinvited }: { onReinvited: (result: CreatedInvitation) => void }) {
  const { can } = useAuth();
  const invitations = useInvitations();
  const revoke = useRevokeInvitation();
  const create = useCreateInvitation();
  const confirm = useConfirm();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const roleOptions = invitableRoles(can("team.invite_any_role"));

  // create_invitation replaces the person's pending invitation with a fresh 7-day one (new token)
  // and doesn't use another seat for a live invitation; the new one is then emailed.
  const resendInvite = async (inv: Invitation) => {
    setResendingId(inv.id);
    try {
      const result = await create.mutateAsync({ email: inv.email, role: inv.role });
      onReinvited(result);
      if (result.emailSent) {
        toast.success(`Invitation ${isExpired(inv) ? "renewed and emailed" : "re-sent"} to ${result.email}`);
      } else {
        const why = result.emailError ? `No email was sent: ${result.emailError}` : "Email delivery isn't set up, so no email was sent.";
        toast.success(`New invite link created for ${result.email}`, {
          description: `${why} The previous link no longer works — copy the new one.`,
        });
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setResendingId(null);
    }
  };

  const revokeInvite = async (id: string, email: string) => {
    const ok = await confirm({
      title: `Revoke the invitation for ${email}?`,
      description: "The invite link will stop working. You can invite them again later.",
      confirmLabel: "Revoke",
    });
    if (!ok) return;
    try {
      await revoke.mutateAsync(id);
      toast.success("Invitation revoked");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <SettingsSection title="Pending invitations" description="Invitations that haven't been accepted yet.">
      {invitations.isLoading ? (
        <ListSkeleton rows={2} />
      ) : invitations.isError ? (
        <ErrorState compact error={invitations.error} title="Couldn't load invitations" onRetry={() => invitations.refetch()} />
      ) : !invitations.data?.length ? (
        <p className="text-sm text-muted-foreground">No pending invitations.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {invitations.data.map((inv) => {
            const expired = isExpired(inv);
            const canResend = roleOptions.some((r) => r.value === inv.role);
            const resending = resendingId === inv.id;
            return (
              <li key={inv.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span>{roleLabel(inv.role)}</span>
                    <span aria-hidden>·</span>
                    <span>invited {formatRelativeDate(inv.created_at)}</span>
                    {inv.expires_at && (
                      <>
                        <span aria-hidden>·</span>
                        <span className={expired ? "text-destructive" : undefined}>
                          <Clock className="mr-0.5 inline h-3 w-3" aria-hidden />
                          {expired ? "expired" : "expires"} {formatDate(inv.expires_at)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {canResend && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                          aria-label={`${expired ? "Renew" : "Resend"} invitation for ${inv.email}`}
                          disabled={resendingId !== null}
                          onClick={() => resendInvite(inv)}
                        >
                          {resending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : expired ? (
                            <RefreshCw className="h-4 w-4" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          {expired ? "Renew" : "Resend"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {expired ? "Create a fresh invitation and email it" : "Email a fresh invite link (the current one stops working)"}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {!expired && <CopyButton value={inviteLink(inv.token)} iconOnly label={`Copy invite link for ${inv.email}`} />}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Revoke invitation for ${inv.email}`}
                        disabled={revoke.isPending && revoke.variables === inv.id}
                        onClick={() => revokeInvite(inv.id, inv.email)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{expired ? "Delete" : "Revoke"}</TooltipContent>
                  </Tooltip>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SettingsSection>
  );
}
