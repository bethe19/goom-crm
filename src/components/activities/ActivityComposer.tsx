import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ACTIVITY_TYPES, useCreateActivity, type ActivityType } from "@/hooks/useActivities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/components/settings/validation";
import { cn } from "@/lib/utils";
import { ACTIVITY_META } from "./activityUtils";

interface ActivityComposerProps {
  dealId?: string | null;
  contactId?: string | null;
  className?: string;
}

/** Inline "log a call / email / meeting / note" box for detail views. */
export function ActivityComposer({ dealId, contactId, className }: ActivityComposerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createActivity = useCreateActivity();
  const [type, setType] = useState<ActivityType>("call");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const idBase = `composer-${dealId ?? contactId ?? "x"}`;

  const submit = () => {
    if (!title.trim()) {
      setError("Add a short summary");
      return;
    }
    setError(null);
    createActivity.mutate(
      { user_id: user?.id, type, title: title.trim(), description: details.trim() || null, deal_id: dealId ?? null, contact_id: contactId ?? null },
      {
        onSuccess: () => {
          toast({ title: `${ACTIVITY_META[type].label} logged`, variant: "success" });
          setTitle("");
          setDetails("");
        },
        onError: (err) => toast({ title: "Couldn't log activity", description: errorMessage(err), variant: "destructive" }),
      },
    );
  };

  return (
    <form
      className={cn("space-y-2 rounded-xl border bg-card p-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      aria-label="Log activity"
    >
      <ToggleGroup type="single" value={type} onValueChange={(v) => v && setType(v as ActivityType)} className="justify-start gap-1" aria-label="Activity type">
        {ACTIVITY_TYPES.map((t) => {
          const M = ACTIVITY_META[t];
          return (
            <ToggleGroupItem key={t} value={t} size="sm" className="h-8 gap-1.5 px-2.5 text-xs" aria-label={M.label}>
              <M.icon className="h-3.5 w-3.5" aria-hidden />
              {M.label}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      <div>
        <label htmlFor={`${idBase}-title`} className="sr-only">
          Summary
        </label>
        <Input
          id={`${idBase}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`${ACTIVITY_META[type].label} summary`}
          maxLength={200}
          aria-invalid={!!error}
          className="h-9 text-sm"
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      {title.trim() && (
        <div>
          <label htmlFor={`${idBase}-details`} className="sr-only">
            Details
          </label>
          <Textarea id={`${idBase}-details`} value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="Details (optional, Markdown supported)" className="text-sm" />
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={createActivity.isPending}>
          {createActivity.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Logging…
            </>
          ) : (
            "Log activity"
          )}
        </Button>
      </div>
    </form>
  );
}
