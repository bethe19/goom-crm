import { useSearchParams } from "react-router-dom";
import { Bell, Building2, Gauge, KeyRound, Kanban, Mail, Plug, ShieldCheck, User, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageBanner } from "@/components/PageBanner";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { WorkspaceSettings } from "@/components/settings/WorkspaceSettings";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { PipelineSettings } from "@/components/settings/PipelineSettings";
import { EmailTemplateSettings } from "@/components/settings/EmailTemplateSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { RolesSettings } from "@/components/settings/RolesSettings";
import { BillingSettings } from "@/components/settings/BillingSettings";

const TABS = [
  { value: "profile", label: "Profile", icon: User, Component: ProfileSettings },
  { value: "account", label: "Account", icon: ShieldCheck, Component: AccountSettings },
  { value: "workspace", label: "Workspace", icon: Building2, Component: WorkspaceSettings },
  { value: "team", label: "Team", icon: Users, Component: TeamSettings },
  { value: "roles", label: "Roles & permissions", icon: KeyRound, Component: RolesSettings },
  { value: "billing", label: "Plan & usage", icon: Gauge, Component: BillingSettings },
  { value: "pipeline", label: "Pipeline", icon: Kanban, Component: PipelineSettings },
  { value: "templates", label: "Email templates", icon: Mail, Component: EmailTemplateSettings },
  { value: "notifications", label: "Notifications", icon: Bell, Component: NotificationSettings },
  { value: "integrations", label: "Integrations", icon: Plug, Component: IntegrationsSettings },
] as const;

type TabValue = (typeof TABS)[number]["value"];

/** Old links (?tab=connectors) keep working. */
const ALIASES: Record<string, TabValue> = {
  connectors: "integrations",
  members: "team",
  stages: "pipeline",
  plan: "billing",
  usage: "billing",
  permissions: "roles",
};

function resolveTab(raw: string | null): TabValue {
  if (!raw) return "profile";
  const value = ALIASES[raw] ?? raw;
  return (TABS.some((t) => t.value === value) ? value : "profile") as TabValue;
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveTab(searchParams.get("tab"));

  const onTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "profile") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageBanner title="Settings" description="Your profile, account, workspace, team and plan." />

      <Tabs value={tab} onValueChange={onTabChange} orientation="vertical" className="gap-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
        <TabsList
          aria-label="Settings sections"
          className="-mx-4 mb-6 flex h-auto w-[calc(100%+2rem)] justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent px-4 pb-2 pt-0 lg:sticky lg:top-20 lg:mx-0 lg:mb-0 lg:w-full lg:flex-col lg:items-stretch lg:self-start lg:border-b-0 lg:p-0"
        >
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="shrink-0 justify-start gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none hover:text-foreground"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-w-0">
          {TABS.map(({ value, Component }) => (
            <TabsContent key={value} value={value} className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
              <div className={value === "billing" || value === "roles" ? "max-w-5xl" : "max-w-3xl"}>
                <Component />
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
