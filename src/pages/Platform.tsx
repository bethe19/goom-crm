import { useSearchParams } from "react-router-dom";
import { BarChart3, Building2, Inbox, MessageSquare, ShieldCheck, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageBanner } from "@/components/PageBanner";
import { PlatformOverview } from "@/components/platform/PlatformOverview";
import { WorkspacesTable } from "@/components/platform/WorkspacesTable";
import { UsersTable } from "@/components/platform/UsersTable";
import { FeedbackList } from "@/components/platform/FeedbackList";
import { ContactRequestsList } from "@/components/platform/ContactRequestsList";

const TABS = [
  { value: "overview", label: "Overview", icon: BarChart3, Component: PlatformOverview },
  { value: "workspaces", label: "Workspaces", icon: Building2, Component: WorkspacesTable },
  { value: "users", label: "Users", icon: Users, Component: UsersTable },
  { value: "feedback", label: "Feedback", icon: MessageSquare, Component: FeedbackList },
  { value: "requests", label: "Contact requests", icon: Inbox, Component: ContactRequestsList },
] as const;

type TabValue = (typeof TABS)[number]["value"];
const DEFAULT_TAB: TabValue = "overview";

function resolveTab(raw: string | null): TabValue {
  return (TABS.some((t) => t.value === raw) ? raw : DEFAULT_TAB) as TabValue;
}

/** Platform owner console (SaaS super-admin). Route-guarded by `RequirePlatformAdmin`. */
export default function Platform() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveTab(searchParams.get("tab"));

  const onTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === DEFAULT_TAB) next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageBanner title="Platform" description="Operate the Goom installation: workspaces, users and product feedback." className="mb-0" />

      <div role="note" className="flex items-start gap-3 rounded-xl border border-info/20 bg-info/10 px-4 py-3 text-sm text-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
        <p>
          <span className="font-medium">Operator view</span>
          <span className="text-muted-foreground">
            {" "}
            — shows platform metadata and counts only. Workspace records (deals, contacts, notes) are never visible here.
          </span>
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="min-w-0">
        <TabsList
          aria-label="Platform sections"
          className="-mx-4 flex h-auto w-[calc(100%+2rem)] justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent px-4 pb-2 pt-0 sm:mx-0 sm:w-full sm:px-0"
        >
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="shrink-0 gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ value, Component }) => (
          <TabsContent key={value} value={value} className="mt-6 min-w-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <Component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
