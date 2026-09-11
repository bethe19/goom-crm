import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getDemoDeals, getDemoTasks } from "@/lib/demoData";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckSquare, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

interface ClosingSoonProps {
  since?: string | null;
  onSelectDeal?: (dealId: string) => void;
}

export function ClosingSoon({ since, onSelectDeal }: ClosingSoonProps) {
  const { isDemoMode } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());

  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ["deals-closing-soon", since, isDemoMode],
    queryFn: async () => {
      if (isDemoMode) {
        return getDemoDeals().slice(0, 4).map((d) => ({
          id: d.id,
          title: d.title,
          value: d.value,
          close_date: d.close_date,
          priority: d.priority,
          companies: { name: d.company_name },
        }));
      }

      const now = new Date().toISOString().split("T")[0];
      const monthFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      let q = supabase
        .from("deals")
        .select("id, title, value, close_date, companies(name)")
        .gte("close_date", now)
        .lte("close_date", monthFromNow)
        .order("close_date")
        .limit(4);
      if (since) q = q.gte("created_at", since);
      const { data } = await q;

      if (!data || data.length === 0) {
        return [];
      }

      return data;
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks-due-soon", isDemoMode],
    queryFn: async () => {
      if (isDemoMode) {
        return getDemoTasks().slice(0, 3).map((t) => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          priority: t.priority,
          contacts: { first_name: t.contact_name?.split(" ")[0] || "", last_name: t.contact_name?.split(" ")[1] || "" },
        }));
      }

      const now = new Date().toISOString();
      const monthFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("tasks")
        .select("id, title, due_date, priority, contacts(first_name, last_name)")
        .eq("completed", false)
        .gte("due_date", now)
        .lte("due_date", monthFromNow)
        .order("due_date")
        .limit(3);

      if (!data || data.length === 0) {
        return [];
      }

      return data;
    },
  });

  const handleToggleTask = (taskId: string, title: string) => {
    setCompletedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
        toast({ title: "Task reopened", description: `Reopened "${title}"` });
      } else {
        next.add(taskId);
        toast({ title: "Task completed! 🎉", description: `Marked "${title}" as completed.` });
      }
      return next;
    });
  };

  const isLoading = dealsLoading || tasksLoading;

  return (
    <Card className="border border-border/80 bg-card shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-foreground">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">
              Action Radar & Closing Soon
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">High-impact deals and pending tasks</p>
          </div>
        </div>

        <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
          <Link to="/pipeline">
            <span>Pipeline</span>
            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : (
          <>
            {/* Deals Closing Soon */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground" /> Priority Deals
                </span>
                <span className="text-[10px] text-muted-foreground">Next 30 days</span>
              </div>

              {deals && deals.length > 0 ? (
                deals.map((d: any) => (
                  <div
                    key={d.id}
                    onClick={() => onSelectDeal && onSelectDeal(d.id)}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5 transition-all hover:border-foreground/30 hover:bg-secondary/40 cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs font-semibold text-foreground hover:underline">
                        {d.title}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {d.companies?.name || "Enterprise Lead"} • Due {formatDate(d.close_date)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {formatCurrency(Number(d.value))}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-2">No deals scheduled to close soon.</p>
              )}
            </div>

            {/* Tasks Due Soon */}
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CheckSquare className="h-3 w-3 text-foreground" /> Key Follow-ups
                </span>
                <Button asChild variant="ghost" size="sm" className="h-5 px-1 text-[10px] text-muted-foreground">
                  <Link to="/tasks">View all</Link>
                </Button>
              </div>

              {tasks && tasks.length > 0 ? (
                tasks.map((t: any) => {
                  const isDone = completedTaskIds.has(t.id);
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between rounded-lg border p-2.5 transition-all ${
                        isDone
                          ? "border-border/40 bg-secondary/20 opacity-60"
                          : "border-border bg-card hover:border-foreground/30 hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <Checkbox
                          checked={isDone}
                          onCheckedChange={() => handleToggleTask(t.id, t.title)}
                          className="h-4 w-4 rounded-md"
                        />
                        <div className="min-w-0">
                          <p className={`truncate text-xs font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {t.title}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {t.contacts?.first_name ? `${t.contacts.first_name} ${t.contacts.last_name || ""} • ` : ""}
                            Due {formatDate(t.due_date)}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[9px] font-semibold uppercase border-border ${
                          isDone
                            ? "text-muted-foreground bg-secondary"
                            : "text-foreground bg-secondary/60"
                        }`}
                      >
                        {isDone ? "Done" : t.priority || "routine"}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground py-2">No pending follow-ups.</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
