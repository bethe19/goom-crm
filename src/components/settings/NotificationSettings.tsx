import { toast } from "sonner";
import { useMyProfile, useUpdateMyProfile, type NotificationPreferences } from "@/hooks/useMyProfile";
import { ErrorState } from "@/components/common/States";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "./shared";
import { errorMessage } from "./validation";

// Only switches the database triggers actually read (see NotificationPreferences).
const OPTIONS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: "task_reminders", label: "Task assignments", description: "When a teammate assigns a task to you." },
  { key: "deal_stage_changes", label: "Deals won or lost", description: "When a deal you own is marked won or lost." },
];

export function NotificationSettings() {
  const profile = useMyProfile();
  const update = useUpdateMyProfile();
  const prefs = profile.data?.notification_preferences;

  const toggle = (key: keyof NotificationPreferences, value: boolean) => {
    if (!prefs) return;
    const option = OPTIONS.find((o) => o.key === key);
    update.mutate(
      { notification_preferences: { ...prefs, [key]: value } },
      {
        onSuccess: () => toast.success(`${option?.label ?? "Notification"} ${value ? "on" : "off"}`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <SettingsSection title="Notifications" description="Choose what you want to be notified about. Changes save automatically.">
      {profile.isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading preferences">
          {OPTIONS.map((o) => (
            <Skeleton key={o.key} className="h-10 w-full" />
          ))}
        </div>
      ) : profile.isError || !prefs ? (
        <ErrorState compact error={profile.error ?? "Your profile couldn't be found."} title="Couldn't load preferences" onRetry={() => profile.refetch()} />
      ) : (
        <ul className="divide-y divide-border">
          {OPTIONS.map((o) => (
            <li key={o.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <Label htmlFor={`notif-${o.key}`} className="cursor-pointer text-sm font-medium">
                  {o.label}
                </Label>
                <p id={`notif-${o.key}-desc`} className="text-sm text-muted-foreground">
                  {o.description}
                </p>
              </div>
              <Switch
                id={`notif-${o.key}`}
                aria-describedby={`notif-${o.key}-desc`}
                checked={prefs[o.key]}
                onCheckedChange={(v) => toggle(o.key, v)}
              />
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}
