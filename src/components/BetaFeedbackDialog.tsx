import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { submitDemoFeedback } from "@/lib/demoData";
import { Sparkles, Star, MessageSquare, Send } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface BetaFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BetaFeedbackDialog({ open, onOpenChange }: BetaFeedbackDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState("Usability");
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = ["Usability", "Feature Request", "Bug Report", "AI Copilot", "General"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast({ title: "Please enter your comments", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const feedbackEmail = email.trim() || user?.email || undefined;

    // 1. Local fallback
    submitDemoFeedback({
      rating,
      category,
      comment: comment.trim(),
      email: feedbackEmail,
    });

    // 2. Supabase Live Sync
    try {
      await supabase.from("feedback").insert({
        rating,
        category,
        comment: comment.trim(),
        email: feedbackEmail || null,
        user_id: user?.id || null,
        status: "new",
      });
    } catch (err) {
      console.warn("[BetaFeedback] Supabase insert warning:", err);
    }

    setIsSubmitting(false);
    toast({
      title: "Thank you for testing the Beta! 🎉",
      description: "Your feedback directly shapes our 2026 release roadmap.",
    });
    setComment("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold">
              Beta Product Feedback
            </DialogTitle>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
              v0.9.8 Beta
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Help us refine the 2026 CRM experience before general release.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Rating */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">How is your Beta experience?</Label>
            <div className="flex items-center gap-2 pt-1">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setRating(val)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                    val <= rating
                      ? "border-amber-400 bg-amber-400/10 text-amber-500"
                      : "border-border text-muted-foreground hover:border-border/80"
                  }`}
                >
                  <Star className={`h-4 w-4 ${val <= rating ? "fill-current" : ""}`} />
                </button>
              ))}
              <span className="text-xs font-medium text-muted-foreground ml-2">
                {rating === 5 ? "Loved it!" : rating >= 3 ? "Good" : "Needs polish"}
              </span>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    category === cat
                      ? "bg-foreground text-background"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-1.5">
            <Label htmlFor="comment" className="text-xs font-medium">
              Your feedback & observations
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What feels great? What can we improve about the dashboard or pipeline?"
              rows={3}
              className="text-xs resize-none"
              required
            />
          </div>

          {/* Optional Email */}
          <div className="space-y-1.5">
            <Label htmlFor="fb-email" className="text-xs font-medium text-muted-foreground">
              Contact email (optional, for follow-up)
            </Label>
            <Input
              id="fb-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="text-xs h-9"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Submit Feedback</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
