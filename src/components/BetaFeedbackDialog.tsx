import { useEffect, useId, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { isMacPlatform } from "@/hooks/useHotkeys";

interface BetaFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = ["Bug report", "Feature request", "Usability", "General"] as const;
const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
const MIN_COMMENT = 10;
const MAX_COMMENT = 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Send feedback" dialog. Writes a row to `feedback` (visible to workspace admins). */
export function BetaFeedbackDialog({ open, onOpenChange }: BetaFeedbackDialogProps) {
  const { user } = useAuth();
  const ids = useId();
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("General");
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSubmitted(false);
      setEmail((prev) => prev || user?.email || "");
    }
  }, [open, user?.email]);

  const commentError =
    comment.trim().length < MIN_COMMENT
      ? `Please write at least ${MIN_COMMENT} characters.`
      : comment.length > MAX_COMMENT
        ? `Please keep it under ${MAX_COMMENT} characters.`
        : null;
  const emailError = email.trim() && !EMAIL_RE.test(email.trim()) ? "Enter a valid email address, or leave it empty." : null;
  const ratingError = rating === null ? "Choose a rating." : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (commentError || emailError || ratingError || isSubmitting) return;

    setIsSubmitting(true);
    const { error } = await supabase.from("feedback").insert({
      rating: rating!,
      category,
      comment: comment.trim(),
      email: email.trim() || null,
      user_id: user?.id ?? null,
      status: "new",
    });
    setIsSubmitting(false);

    if (error) {
      toast.error("Couldn't send your feedback", { description: sanitizeErrorMessage(error.message) });
      return;
    }
    toast.success("Thanks — your feedback was sent");
    setComment("");
    setRating(null);
    setCategory("General");
    setSubmitted(false);
    onOpenChange(false);
  };

  const showErrors = submitted;

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>Report a problem or tell us what would make Goom work better for you.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              How would you rate Goom so far? <span className="text-destructive" aria-hidden="true">*</span>
            </legend>
            <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Rating" aria-describedby={`${ids}-rating-err`}>
              {[1, 2, 3, 4, 5].map((val) => {
                const active = rating !== null && val <= rating;
                return (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={rating === val}
                    aria-label={`${val} of 5 — ${RATING_LABELS[val]}`}
                    onClick={() => setRating(val)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      active ? "border-warning/40 bg-warning/10 text-warning" : "border-input text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <Star className={cn("h-4 w-4", active && "fill-current")} aria-hidden="true" />
                  </button>
                );
              })}
              <span className="ml-2 text-xs text-muted-foreground" aria-live="polite">
                {rating ? RATING_LABELS[rating] : ""}
              </span>
            </div>
            {showErrors && ratingError && (
              <p id={`${ids}-rating-err`} className="text-xs text-destructive">
                {ratingError}
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Category</legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="radio"
                  aria-checked={category === cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    category === cat
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor={`${ids}-comment`}>
              Your feedback <span className="text-destructive" aria-hidden="true">*</span>
            </Label>
            <Textarea
              id={`${ids}-comment`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What happened, or what would you like to see?"
              rows={4}
              autoFocus
              maxLength={MAX_COMMENT + 100}
              aria-invalid={showErrors && !!commentError}
              aria-describedby={`${ids}-comment-err`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
            />
            {showErrors && commentError ? (
              <p id={`${ids}-comment-err`} className="text-xs text-destructive">
                {commentError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Tip: press {isMacPlatform() ? "⌘" : "Ctrl"}+Enter to send.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${ids}-email`}>Email for follow-up (optional)</Label>
            <Input
              id={`${ids}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              aria-invalid={showErrors && !!emailError}
              aria-describedby={`${ids}-email-err`}
            />
            {showErrors && emailError && (
              <p id={`${ids}-email-err`} className="text-xs text-destructive">
                {emailError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
