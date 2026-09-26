import { useState, type FormEvent } from "react";
import { Check, Eye, Link2, Minus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/contexts/AuthContext";
import { PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS, permissionsFor, type Permission } from "@/lib/permissions";
import { PLANS, formatLimit } from "@/lib/plans";
import { TOUR_MEMBERS, type TourDeal } from "./data";
import { useDemoScript } from "./hooks";
import { Avatar, Card, LiveStatus, SceneHeader, Segmented } from "./ui";

const ROLES: AppRole[] = ["admin", "manager", "rep"];

/** A readable subset of the permission matrix, in a sensible order. */
const SHOWN: Permission[] = [
  "records.view_all",
  "deals.reassign",
  "pipelines.manage",
  "team.view_reports",
  "team.invite",
  "team.manage_roles",
  "workspace.billing",
];

/** The member whose view is previewed for each role. */
const VIEWER: Record<AppRole, string> = { admin: "u1", manager: "u2", rep: "u3" };

export function TeamScene({ deals, demo, animate }: { deals: TourDeal[]; demo: boolean; animate: boolean }) {
  const [role, setRole] = useState<AppRole>("admin");
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("rep");
  const [pending, setPending] = useState<{ email: string; role: AppRole }[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useDemoScript(demo, [
    [1600, () => setRole("manager")],
    [2000, () => setRole("rep")],
    [2400, () => setRole("admin")],
  ]);

  const viewerId = VIEWER[role];
  const visibleDeals = role === "rep" ? deals.filter((d) => d.ownerId === viewerId) : deals;
  const granted = new Set(permissionsFor(role));
  const inviteRoles: AppRole[] = ROLES;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setStatus("Enter a valid email address.");
      return;
    }
    setPending((p) => [...p, { email: value, role: inviteRole }]);
    setStatus(`Invitation link created for ${value} as ${ROLE_LABELS[inviteRole]}.`);
    setEmail("");
    setInviting(false);
  };

  const seats = TOUR_MEMBERS.length + pending.length;

  return (
    <div className="flex h-full flex-col">
      <SceneHeader title="Team & roles" subtitle={`${seats} seats used · Growth plan includes ${formatLimit(PLANS.growth.limits.seats)}`}>
        <button
          type="button"
          onClick={() => setInviting((v) => !v)}
          aria-expanded={inviting}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Invite
        </button>
      </SceneHeader>

      {inviting && (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-b border-border bg-secondary/40 px-4 py-3 sm:px-5">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-medium text-muted-foreground">
            Email
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
            Role
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AppRole)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {inviteRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">
            Create link
          </button>
        </form>
      )}

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-5 md:grid-cols-[1fr_1.1fr]">
        <div className="min-w-0 space-y-3">
          <Card className="divide-y divide-border">
            {TOUR_MEMBERS.map((m) => (
              <div key={m.id} className={cn("flex items-center gap-2.5 px-3 py-2", m.id === viewerId && "bg-secondary/50")}>
                <Avatar initials={m.initials} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{m.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{m.email}</p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">{ROLE_LABELS[m.role]}</span>
              </div>
            ))}
            {pending.map((p) => (
              <div
                key={p.email}
                className={cn("flex items-center gap-2.5 px-3 py-2", animate && "animate-in fade-in-0 slide-in-from-top-1 duration-200")}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border">
                  <Link2 className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{p.email}</p>
                  <p className="text-[11px] text-muted-foreground">Invitation pending</p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">{ROLE_LABELS[p.role]}</span>
              </div>
            ))}
          </Card>
          <LiveStatus message={status} />
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Preview as
            </span>
            <Segmented<AppRole>
              label="Preview role"
              value={role}
              onChange={setRole}
              options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />
          </div>
          <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>

          <Card className="p-3">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold">Deals visible</p>
              <p className="text-xs tabular-nums">
                <span className="text-base font-semibold">{visibleDeals.length}</span>
                <span className="text-muted-foreground"> of {deals.length}</span>
              </p>
            </div>
            <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              {deals.map((d) => (
                <span
                  key={d.id}
                  className={cn(
                    "flex-1 transition-colors duration-200",
                    visibleDeals.includes(d) ? "bg-foreground" : "bg-secondary",
                  )}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {role === "rep" ? "Reps see the deals they own or created." : "Admins and managers see every deal in the workspace."}
            </p>
          </Card>

          <ul className="space-y-1.5">
            {SHOWN.map((p) => {
              const ok = granted.has(p);
              return (
                <li key={p} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                      ok ? "bg-foreground text-background" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {ok ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : <Minus className="h-2.5 w-2.5" aria-hidden="true" />}
                  </span>
                  <span className={ok ? "" : "text-muted-foreground"}>{PERMISSION_LABELS[p]}</span>
                  <span className="sr-only">{ok ? "allowed" : "not allowed"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
