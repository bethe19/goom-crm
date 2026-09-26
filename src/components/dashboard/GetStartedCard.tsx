import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Database, Handshake, Loader2, Upload, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceMembers } from "@/hooks/useAnalytics";
import { loadSampleData } from "@/lib/sampleData";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function dismissKey(orgId: string) {
  return `goom:get-started-dismissed:${orgId}`;
}

function readDismissed(orgId: string | undefined): boolean {
  if (!orgId) return false;
  try {
    return localStorage.getItem(dismissKey(orgId)) === "1";
  } catch {
    return false;
  }
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: typeof Handshake;
  done: boolean;
  to?: string;
  onClick?: () => void;
  pending?: boolean;
  pendingLabel?: string;
}

/**
 * Onboarding checklist for new workspaces. Hides itself once every step is done
 * (or when dismissed for this workspace).
 */
export function GetStartedCard({ hasDeals, loading }: { hasDeals: boolean; loading?: boolean }) {
  const { organization, canManage, hasFeature } = useAuth();
  const canImport = hasFeature("csv_import");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orgId = organization?.id;
  const [dismissed, setDismissed] = useState(() => readDismissed(orgId));

  const contacts = useQuery({
    queryKey: ["analytics", "contacts-count", orgId],
    enabled: !!orgId,
    refetchOnMount: "always",
    queryFn: async () => {
      const { count, error } = await supabase.from("contacts").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
  const members = useWorkspaceMembers();

  const sample = useMutation({
    mutationFn: loadSampleData,
    onSuccess: (res) => {
      toast({
        title: "Sample data added",
        description: `${res.deals} deals, ${res.companies} companies, ${res.contacts} contacts, ${res.activities} activities and ${res.tasks} tasks.`,
        variant: "success",
      });
      queryClient.invalidateQueries();
    },
    onError: (err) => {
      toast({ title: "Couldn't load sample data", description: sanitizeErrorMessage((err as Error)?.message), variant: "destructive" });
    },
  });

  if (dismissed || loading || contacts.isLoading) return null;

  const steps: Step[] = [
    {
      id: "deal",
      title: "Create your first deal",
      description: "Add an opportunity you're working on.",
      icon: Handshake,
      done: hasDeals,
      to: "/pipeline?new=1",
    },
    {
      id: "contacts",
      title: canImport ? "Import contacts" : "Add your first contact",
      description: canImport ? "Bring in people from a CSV file." : "Keep track of the people you sell to.",
      icon: canImport ? Upload : UserPlus,
      done: (contacts.data ?? 0) > 0,
      to: canImport ? "/data" : "/contacts?new=1",
    },
  ];
  if (canManage) {
    steps.push({
      id: "team",
      title: "Invite your team",
      description: "Work on deals together.",
      icon: UserPlus,
      done: (members.data?.length ?? 0) > 1,
      to: "/settings?tab=team",
    });
  }
  // Sample data is a workspace-level action: only admins/managers are offered it. Reps see no
  // deals through RLS even in a populated workspace, so "no deals" says nothing about the workspace.
  if (!hasDeals && canManage) {
    steps.push({
      id: "sample",
      title: "Load sample data",
      description: "Explore with fictional companies and deals.",
      icon: Database,
      done: false,
      onClick: () => sample.mutate(),
      pending: sample.isPending,
      pendingLabel: "Loading sample data…",
    });
  }

  const required = steps.filter((s) => s.id !== "sample");
  const doneCount = required.filter((s) => s.done).length;
  if (doneCount === required.length) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      if (orgId) localStorage.setItem(dismissKey(orgId), "1");
    } catch {
      /* storage unavailable: dismissal lasts for this visit */
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby="get-started-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="get-started-title" className="text-sm font-semibold text-foreground">
            Get started
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {doneCount} of {required.length} done
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={dismiss} aria-label="Hide getting started checklist">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Progress value={(doneCount / required.length) * 100} className="mt-3 h-1.5" aria-label="Setup progress" />

      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s) => {
          const Icon = s.icon;
          const content = (
            <>
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                  s.done ? "border-foreground bg-foreground text-background" : "border-border bg-secondary text-foreground",
                )}
              >
                {s.pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : s.done ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-medium", s.done ? "text-muted-foreground line-through" : "text-foreground")}>
                  {s.pending ? s.pendingLabel : s.title}
                </span>
                <span className="block text-xs text-muted-foreground">{s.done ? "Done" : s.description}</span>
              </span>
              {!s.done && !s.pending && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
            </>
          );
          const cls =
            "flex h-full w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors duration-150 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70";
          return (
            <li key={s.id}>
              {s.done ? (
                <div className={cn(cls, "hover:bg-transparent")}>{content}</div>
              ) : s.to ? (
                <Link to={s.to} className={cls}>
                  {content}
                </Link>
              ) : (
                <button type="button" className={cls} onClick={s.onClick} disabled={s.pending} aria-busy={s.pending}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
