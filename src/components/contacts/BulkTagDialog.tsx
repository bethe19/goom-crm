import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface BulkTagDialogProps {
  mode: "add" | "remove" | null;
  count: number;
  suggestions: string[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (tag: string) => void;
}

/** Asks for a tag to add to / remove from the selected contacts. */
export function BulkTagDialog({ mode, count, suggestions, pending, onOpenChange, onSubmit }: BulkTagDialogProps) {
  const [tag, setTag] = useState("");
  useEffect(() => {
    if (mode) setTag("");
  }, [mode]);

  const t = tag.trim();
  const noun = count === 1 ? "contact" : "contacts";
  const visible = suggestions.filter((s) => !t || s.toLowerCase().includes(t.toLowerCase())).slice(0, 12);

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "remove" ? "Remove tag" : "Add tag"}</DialogTitle>
          <DialogDescription>
            {mode === "remove" ? `Remove a tag from ${count} selected ${noun}.` : `Add a tag to ${count} selected ${noun}.`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (t && t.length <= 50 && !pending) onSubmit(t);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="bulk-tag-input">Tag</Label>
            <Input id="bulk-tag-input" autoFocus value={tag} maxLength={50} onChange={(e) => setTag(e.target.value)} placeholder="e.g. newsletter" />
          </div>
          {visible.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Existing tags">
              {visible.map((s) => (
                <button key={s} type="button" onClick={() => setTag(s)} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Badge variant={s === t ? "default" : "secondary"} className="cursor-pointer font-normal">
                    {s}
                  </Badge>
                </button>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!t || pending} variant={mode === "remove" ? "destructive" : "default"}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {pending ? "Saving…" : mode === "remove" ? "Remove tag" : "Add tag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
