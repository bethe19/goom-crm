import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brand } from "@/components/Brand";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ArrowLeft, Building2, Users, Kanban, Check, Plus, X, Sparkles } from "lucide-react";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const defaultStages = [
  { name: "Prospect", color: "#3b82f6" },
  { name: "Qualified", color: "#8b5cf6" },
  { name: "Proposal", color: "#f97316" },
  { name: "Negotiation", color: "#eab308" },
  { name: "Won", color: "#10b981" },
  { name: "Lost", color: "#ef4444" },
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [stages, setStages] = useState(defaultStages);
  const [newStageName, setNewStageName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const teamSizes = ["Solo Founder", "2-5 reps", "6-15 reps", "16-50 reps", "50+ reps"];

  const handleRemoveStage = (idx: number) => {
    if (stages.length <= 2) return;
    setStages(stages.filter((_, i) => i !== idx));
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    const colors = ["#06b6d4", "#ec4899", "#14b8a6", "#f59e0b", "#6366f1", "#84cc16"];
    setStages([...stages, { name: newStageName.trim(), color: colors[stages.length % colors.length] }]);
    setNewStageName("");
  };

  const handleFinish = async () => {
    if (!user) {
      onComplete();
      return;
    }
    setSubmitting(true);

    try {
      if (companyName) {
        await supabase.from("profiles").update({ company: companyName }).eq("user_id", user.id);
      }

      const { data: pipeline, error: pipelineError } = await supabase
        .from("pipelines")
        .insert({ name: "Sales Pipeline", created_by: user.id })
        .select()
        .single();

      if (pipelineError) throw pipelineError;

      const stageInserts = stages.map((s, i) => ({
        pipeline_id: pipeline.id,
        name: s.name,
        color: s.color,
        position: i,
      }));

      const { error: stagesError } = await supabase.from("pipeline_stages").insert(stageInserts);
      if (stagesError) throw stagesError;

      toast({ title: "Welcome to Goom! 🎉", description: "Your workspace is ready. All beta features included free." });
      onComplete();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6 bg-subtle-grid">
      <Card className="w-full max-w-lg border border-border bg-card p-6 sm:p-8 shadow-sm rounded-2xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/70">
          <Brand size="md" />
          <Badge variant="outline" className="text-[10px] font-mono border-border bg-secondary text-foreground">
            <Sparkles className="h-3 w-3 mr-1" />
            Free Public Beta
          </Badge>
        </div>

        <CardHeader className="text-center p-0 pb-4">
          {/* Progress Indicators matching Landing page */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? "w-10 bg-foreground" : s < step ? "w-4 bg-foreground/60" : "w-4 bg-secondary"
                }`}
              />
            ))}
          </div>

          <div className="text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Step {step} of 3
          </div>

          {step === 1 && (
            <>
              <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
                Set up your company workspace
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                All features are 100% free during beta with zero credit card required.
              </CardDescription>
            </>
          )}

          {step === 2 && (
            <>
              <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
                How large is your sales motion?
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Helps us tailor your default forecasting formulas and quota benchmarks.
              </CardDescription>
            </>
          )}

          {step === 3 && (
            <>
              <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
                Review your visual pipeline
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Customize deal stages to match your sales process. You can edit anytime.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="p-0 pt-2 space-y-5">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="company" className="text-xs font-semibold text-foreground">
                  Company / Organization Name
                </Label>
                <Input
                  id="company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Technologies"
                  autoFocus
                  className="h-10 text-xs border-border bg-background"
                />
              </div>

              <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-0.5">Beta Early Adopter Benefit</p>
                <p className="text-[11px] leading-relaxed">
                  Your organization receives unrestricted access to the Goom AI Copilot, unlimited contacts, and real-time stage funnel analytics at no cost.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onComplete}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Skip for now
                </Button>
                <Button
                  size="sm"
                  onClick={() => setStep(2)}
                  className="h-9 px-4 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-xs font-medium gap-1.5 shadow-xs"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  Active Sales Team Size
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {teamSizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setTeamSize(size)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all ${
                        teamSize === size
                          ? "border-foreground bg-foreground text-background font-semibold shadow-xs"
                          : "border-border bg-card text-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <span>{size}</span>
                      {teamSize === size && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                <Button
                  size="sm"
                  onClick={() => setStep(3)}
                  className="h-9 px-4 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-xs font-medium gap-1.5 shadow-xs"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Pipeline Stages</Label>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {stages.map((stage, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg border border-border/70 bg-card text-xs font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                        <span>{stage.name}</span>
                      </div>
                      {stages.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStage(idx)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    placeholder="Add custom stage (e.g. Security Review)..."
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    className="h-8 text-xs border-border"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddStage}
                    className="h-8 text-xs shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(2)}
                  className="text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                <Button
                  size="sm"
                  disabled={submitting}
                  onClick={handleFinish}
                  className="h-9 px-5 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-xs font-semibold gap-1.5 shadow-xs"
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Launch Workspace</span>
                      <Sparkles className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
