import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "./shared";

const PLANNED = [
  { name: "Google Calendar", description: "See meetings next to deals and log them automatically." },
  { name: "Gmail & Outlook", description: "Log emails to contacts and deals." },
  { name: "Slack", description: "Get notified when deals move or close." },
  { name: "Webhooks & API", description: "Send CRM events to your own tools." },
];

/** Honest placeholder: no connector is live yet, so nothing here pretends to connect. */
export function IntegrationsSettings() {
  return (
    <div className="space-y-6">
      <SettingsSection
        title="Integrations are coming soon"
        description="Goom doesn't connect to other apps yet. Until then, you can move data in and out with CSV import and export."
      >
        <Button variant="outline" asChild>
          <Link to="/data">Open import & export</Link>
        </Button>
      </SettingsSection>

      <SettingsSection title="Planned">
        <ul className="divide-y divide-border">
          {PLANNED.map((p) => (
            <li key={p.name} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-muted-foreground">
                Coming soon
              </Badge>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </div>
  );
}
