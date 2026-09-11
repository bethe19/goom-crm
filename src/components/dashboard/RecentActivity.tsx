import { useState } from "react";
import { useActivities } from "@/hooks/useActivities";
import { ActivityItem } from "@/components/activities/ActivityItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getDemoActivities } from "@/lib/demoData";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, Phone, Mail, Calendar, FileText, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export function RecentActivity({ since }: { since?: string | null }) {
  const { isDemoMode } = useAuth();
  const [filterType, setFilterType] = useState<string>("all");
  const { data: rawActivities, isLoading } = useActivities({ limit: 8, since: since || undefined });

  // Use demo activities only when explicitly in demo mode
  const activities = isDemoMode
    ? getDemoActivities().map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        description: a.description,
        created_at: a.created_at,
        deals: a.deal_title ? { title: a.deal_title } : undefined,
        contacts: a.contact_name
          ? { first_name: a.contact_name.split(" ")[0], last_name: a.contact_name.split(" ")[1] || "" }
          : undefined,
      }))
    : (rawActivities || []);

  const filteredActivities =
    filterType === "all"
      ? activities
      : activities.filter((a: any) => a.type === filterType);

  return (
    <Card className="border border-border/80 bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-foreground">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">
              Live Activity Stream
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Touchpoints, call logs, and customer updates</p>
          </div>
        </div>

        <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
          <Link to="/activities">
            <span>All Logs</span>
            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 pt-1">
        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1 border-b border-border/60 pb-2.5">
          {[
            { id: "all", label: "All Activity" },
            { id: "call", label: "Calls", icon: Phone },
            { id: "email", label: "Emails", icon: Mail },
            { id: "meeting", label: "Meetings", icon: Calendar },
            { id: "note", label: "Notes", icon: FileText },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterType(item.id)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                filterType === item.id
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {item.icon && <item.icon className="h-3 w-3" />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : !filteredActivities || filteredActivities.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No activities recorded in this category.
          </p>
        ) : (
          <div className="space-y-2.5">
            {filteredActivities.slice(0, 5).map((a: any) => (
              <ActivityItem key={a.id} activity={a} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
