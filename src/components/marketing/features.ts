import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Command,
  FileSpreadsheet,
  History,
  KanbanSquare,
  LineChart,
  MessageSquareText,
  Sparkles,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { PlanFeature } from "@/lib/plans";

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  points: string[];
  /** Set when the feature is only on some plans (shown as a plan chip). */
  plan?: PlanFeature;
}

/** Only features that exist in the product today. Keep this list honest. */
export const FEATURES: Feature[] = [
  {
    icon: KanbanSquare,
    title: "Pipeline board",
    description: "Drag deals between stages on a kanban board and see the count and value of every stage at a glance.",
    points: ["Custom stages per pipeline", "Won and lost stages", "Stage totals and weighted value"],
  },
  {
    icon: UsersRound,
    title: "Contacts and companies",
    description: "Keep the people you sell to and their companies in one shared list, linked to their deals.",
    points: ["Search, filters and bulk actions", "Linked deals and activity"],
  },
  {
    icon: MessageSquareText,
    title: "Activities",
    description: "Log calls, emails, meetings and notes against deals and contacts so the context is never lost.",
    points: ["Calls, emails, meetings, notes", "Activity timeline"],
  },
  {
    icon: CheckSquare,
    title: "Tasks",
    description: "Turn next steps into tasks with due dates and priorities, and see what's overdue.",
    points: ["Due dates and priorities", "Linked to deals and contacts"],
  },
  {
    icon: CalendarDays,
    title: "Calendar",
    description: "See tasks, activities and expected close dates on a calendar so busy weeks don't sneak up on you.",
    points: ["Month view", "Tasks, activities and close dates"],
  },
  {
    icon: LineChart,
    title: "Forecast",
    description: "Project revenue from the open deals in your pipeline, their values and their expected close dates.",
    points: ["Commit and best case by month", "Progress against your quota"],
    plan: "forecast",
  },
  {
    icon: BarChart3,
    title: "Reports",
    description: "Understand pipeline health, stage conversion and win rates with reports built from your own data.",
    points: ["Win rate, revenue and sales cycle", "Leaderboard and lost reasons on Growth and Enterprise"],
  },
  {
    icon: History,
    title: "Deal change history",
    description: "See every change to a deal — stage, value, owner, close date — and who made it.",
    points: ["Full audit trail per deal", "Useful for reviews and handovers"],
    plan: "audit_history",
  },
  {
    icon: FileSpreadsheet,
    title: "CSV import and export",
    description: "Bring your existing contacts, companies and deals in from a spreadsheet, and export them whenever you like.",
    points: ["Contacts, companies and deals", "Guided column mapping"],
    plan: "csv_import",
  },
  {
    icon: Users,
    title: "Team workspaces",
    description: "Each team gets its own workspace. Invite teammates by link and give them the right role.",
    points: ["Admin, manager and rep roles", "Reps see the deals they own or created", "Invitation links"],
  },
  {
    icon: Sparkles,
    title: "AI assistant",
    description: "Ask questions about your pipeline, find deals that need attention and draft follow-up emails from your real data.",
    points: ["Answers from your workspace data", "Copy-ready email drafts"],
  },
  {
    icon: Command,
    title: "Command palette",
    description: "Press Ctrl+K (⌘K on Mac) to search your records and jump to any page from the keyboard.",
    points: ["Search across records", "Keyboard navigation"],
  },
];
