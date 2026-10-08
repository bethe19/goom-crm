import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface LostReasonDialogProps {
  open: boolean;
  dealTitle?: string;
  stageName?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const QUICK_REASONS = ["Price", "Chose a competitor", "No budget", "No decision", "Timing", "Went silent"];

/** Asks for an optional reason when a deal is moved into a lost stage. */
export function LostReasonDialog({ open, dealTitle, stageName = "Lost", pending, onCancel, onConfirm }: LostReasonDialogProps) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  // Enter and the submit button both land here: never confirm twice (while saving or while closing).
  const submit = () => {
    if (pending || !open) return;
    onConfirm(reason);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as {stageName.toLowerCase()}</DialogTitle>
          <DialogDescription>{dealTitle ? `Why was “${dealTitle}” lost? ` : ""}A reason is optional but helps spot patterns.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-wrap gap-1.5" aria-label="Common reasons">
            {QUICK_REASONS.map((r) => (
              <Button key={r} type="button" variant={reason === r ? "default" : "secondary"} size="sm" className="h-7 px-2.5 text-xs" onClick={() => setReason(r)}>
                {r}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lost-reason">Reason</Label>
            <Textarea
              id="lost-reason"
              autoFocus
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Optional"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
                </>
              ) : (
                "Mark as lost"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
