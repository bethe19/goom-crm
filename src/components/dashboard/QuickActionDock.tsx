import { Button } from "@/components/ui/button";
import {
  Plus,
  PhoneCall,
  UserPlus,
  CheckSquare,
  Sparkles,
  RotateCcw,
  MessageSquarePlus,
} from "lucide-react";

interface QuickActionDockProps {
  onNewDeal: () => void;
  onNewContact: () => void;
  onLogActivity: () => void;
  onNewTask: () => void;
  onResetData: () => void;
  onOpenFeedback: () => void;
  isDemoMode?: boolean;
}

export function QuickActionDock({
  onNewDeal,
  onNewContact,
  onLogActivity,
  onNewTask,
  onResetData,
  onOpenFeedback,
  isDemoMode,
}: QuickActionDockProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-card/70 p-2.5 shadow-xs backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          onClick={onNewDeal}
          className="h-8 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-xs font-medium gap-1.5 shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Deal</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onNewContact}
          className="h-8 rounded-lg text-xs font-medium gap-1.5 border-border/80 hover:bg-secondary"
        >
          <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Add Contact</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onLogActivity}
          className="h-8 rounded-lg text-xs font-medium gap-1.5 border-border/80 hover:bg-secondary"
        >
          <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Log Activity</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onNewTask}
          className="h-8 rounded-lg text-xs font-medium gap-1.5 border-border/80 hover:bg-secondary"
        >
          <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <span>New Task</span>
        </Button>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {isDemoMode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetData}
            title="Reset Beta sandbox data to default"
            className="h-8 rounded-lg text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">Reset Sandbox</span>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFeedback}
          className="h-8 rounded-lg border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 text-xs font-medium gap-1.5"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          <span>Beta Feedback</span>
        </Button>
      </div>
    </div>
  );
}
