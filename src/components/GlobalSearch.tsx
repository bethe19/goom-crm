import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare,
  Clock,
  FileSpreadsheet,
  Gauge,
  Kanban,
  Keyboard,
  LayoutDashboard,
  Loader2,
  MessageSquarePlus,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Shield,
  ShieldCheck,
  Sun,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import {
  hitHref,
  matchesCommand,
  MIN_SEARCH_LENGTH,
  pushRecent,
  useGlobalSearch,
  type SearchHit,
  type SearchKind,
} from "@/hooks/useGlobalSearch";
import { GO_TO_SHORTCUTS, modKeyLabel } from "@/hooks/useHotkeys";
import { formatCurrency } from "@/lib/formatters";
import { openAssistant } from "@/lib/ai";
import { sanitizeErrorMessage } from "@/lib/sanitize";

const KIND_META: Record<SearchKind, { icon: LucideIcon; label: string; singular: string }> = {
  deal: { icon: Kanban, label: "Deals", singular: "Deal" },
  contact: { icon: Users, label: "Contacts", singular: "Contact" },
  company: { icon: Building2, label: "Companies", singular: "Company" },
  activity: { icon: Activity, label: "Activities", singular: "Activity" },
  task: { icon: CheckSquare, label: "Tasks", singular: "Task" },
};
const KIND_ORDER: SearchKind[] = ["deal", "contact", "company", "task", "activity"];

interface Command {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
  shortcut?: string;
  run: () => void;
}

/* ------------------------------------------------------------------ recent items (localStorage) */

const recentKey = (userId: string) => `goom:recent-records:${userId}`;

function readRecent(userId: string | undefined): SearchHit[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(recentKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((h) => h && h.id && h.kind in KIND_META) : [];
  } catch {
    return [];
  }
}

function writeRecent(userId: string | undefined, list: SearchHit[]) {
  if (!userId) return;
  try {
    localStorage.setItem(recentKey(userId), JSON.stringify(list));
  } catch {
    /* storage unavailable (private mode) — recents are a convenience only */
  }
}

/* ----------------------------------------------------------------------------- trigger button */

/** Top-bar button that opens the command palette and advertises the shortcut. */
export function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
  const shortcut = modKeyLabel("k");
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onOpen}
      data-tour="command-palette"
      aria-label={`Search and commands (${shortcut})`}
      className="h-8 w-9 justify-center gap-2 px-0 font-normal text-muted-foreground shadow-none sm:w-56 sm:justify-start sm:px-3 lg:w-64"
    >
      <Search className="!size-3.5" />
      <span className="hidden flex-1 text-left sm:inline">Search or jump to…</span>
      <kbd className="pointer-events-none hidden h-5 select-none items-center rounded border bg-muted px-1.5 text-2xs font-medium text-muted-foreground sm:inline-flex">
        {shortcut}
      </kbd>
    </Button>
  );
}

/* ---------------------------------------------------------------------------- command palette */

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts?: () => void;
  onOpenFeedback?: () => void;
}

/** ⌘K command palette: workspace search, create actions, navigation and recent records. */
export function GlobalSearch({ open, onOpenChange, onShowShortcuts, onOpenFeedback }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { user, organization, can, isPlatformAdmin } = useAuth();
  const canAdmin = can("workspace.admin");
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<SearchHit[]>([]);
  const debounced = useDebounce(query, 200);
  const search = useGlobalSearch(debounced);

  useEffect(() => {
    if (open) setRecent(readRecent(user?.id));
    else setQuery("");
  }, [open, user?.id]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const go = useCallback(
    (to: string) => {
      close();
      navigate(to);
    },
    [close, navigate],
  );

  const openHit = (hit: SearchHit) => {
    const next = pushRecent(readRecent(user?.id), hit);
    writeRecent(user?.id, next);
    go(hitHref(hit));
  };

  const createCommands: Command[] = useMemo(
    () => [
      { id: "new-deal", label: "New deal", icon: Plus, keywords: ["create", "add", "opportunity"], run: () => go("/pipeline?new=1") },
      { id: "new-contact", label: "New contact", icon: Plus, keywords: ["create", "add", "person", "lead"], run: () => go("/contacts?new=1") },
      { id: "new-company", label: "New company", icon: Plus, keywords: ["create", "add", "account", "organization"], run: () => go("/companies?new=1") },
      { id: "new-task", label: "New task", icon: Plus, keywords: ["create", "add", "todo", "reminder"], run: () => go("/tasks?new=1") },
      { id: "new-activity", label: "Log activity", icon: Plus, keywords: ["create", "add", "call", "meeting", "email", "note"], run: () => go("/activities?new=1") },
    ],
    [go],
  );

  const navCommands: Command[] = useMemo(() => {
    const icons: Record<string, LucideIcon> = {
      "/dashboard": LayoutDashboard,
      "/pipeline": Kanban,
      "/contacts": Users,
      "/companies": Building2,
      "/tasks": CheckSquare,
      "/activities": Activity,
      "/reports": BarChart3,
      "/settings": Settings,
    };
    const list: Command[] = GO_TO_SHORTCUTS.map((s) => ({
      id: `go-${s.key}`,
      label: s.label,
      icon: icons[s.to] ?? LayoutDashboard,
      shortcut: `G ${s.key.toUpperCase()}`,
      keywords: ["go", "open", "navigate"],
      run: () => go(s.to),
    }));
    list.splice(6, 0,
      { id: "go-calendar", label: "Calendar", icon: CalendarDays, keywords: ["go", "schedule"], run: () => go("/calendar") },
      { id: "go-forecast", label: "Forecast", icon: TrendingUp, keywords: ["go", "quota", "revenue"], run: () => go("/forecast") },
    );
    list.push({ id: "go-data", label: "Data import & export", icon: FileSpreadsheet, keywords: ["csv", "import", "export"], run: () => go("/data") });
    list.push({ id: "go-billing", label: "Plan & usage", icon: Gauge, keywords: ["go", "billing", "plan", "upgrade", "limits"], run: () => go("/settings?tab=billing") });
    list.push({ id: "go-roles", label: "Roles & permissions", icon: Users, keywords: ["go", "rbac", "access", "role"], run: () => go("/settings?tab=roles") });
    if (canAdmin) list.push({ id: "go-admin", label: "Admin", icon: Shield, keywords: ["workspace", "members"], run: () => go("/admin") });
    if (isPlatformAdmin)
      list.push({ id: "go-platform", label: "Go to Platform", icon: ShieldCheck, keywords: ["operator", "console", "owner", "saas"], run: () => go("/platform") });
    return list;
  }, [go, canAdmin, isPlatformAdmin]);

  const generalCommands: Command[] = useMemo(() => {
    const list: Command[] = [
      {
        id: "ask-ai",
        label: "Ask the assistant…",
        icon: Sparkles,
        keywords: ["ai", "copilot", "help", "question"],
        run: () => {
          close();
          openAssistant();
        },
      },
      {
        id: "theme",
        label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        keywords: ["theme", "dark", "light", "appearance", "mode"],
        run: () => {
          setTheme(resolvedTheme === "dark" ? "light" : "dark");
          close();
        },
      },
    ];
    if (onShowShortcuts)
      list.push({ id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, shortcut: "?", keywords: ["help", "keys", "hotkeys"], run: () => { close(); onShowShortcuts(); } });
    if (onOpenFeedback)
      list.push({ id: "feedback", label: "Send feedback", icon: MessageSquarePlus, keywords: ["bug", "idea", "support"], run: () => { close(); onOpenFeedback(); } });
    return list;
  }, [resolvedTheme, setTheme, close, onShowShortcuts, onOpenFeedback]);

  const q = query.trim();
  const searching = q.length >= MIN_SEARCH_LENGTH;
  const settled = searching && debounced.trim() === q && !search.isFetching;
  const hits = searching ? search.data ?? [] : [];

  const filter = (cmds: Command[]) => cmds.filter((c) => matchesCommand(q, c.label, c.keywords));
  const createMatches = filter(createCommands);
  const navMatches = filter(navCommands);
  const generalMatches = filter(generalCommands);
  const noMatches =
    settled && !search.isError && hits.length === 0 && !createMatches.length && !navMatches.length && !generalMatches.length;

  const renderCommand = (c: Command) => (
    <CommandItem key={c.id} value={c.id} onSelect={c.run}>
      <c.icon aria-hidden="true" />
      <span className="truncate">{c.label}</span>
      {c.shortcut && <CommandShortcut>{c.shortcut}</CommandShortcut>}
    </CommandItem>
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search and commands"
      description="Search records in your workspace, create new ones or jump to a page"
    >
      <CommandInput
        placeholder={organization ? `Search ${organization.name}…` : "Search deals, contacts, companies…"}
        value={query}
        onValueChange={setQuery}
        aria-label="Search"
      />
      <CommandList>
        {/* Search results */}
        {searching && (search.isLoading || (search.isFetching && hits.length === 0)) && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching…
          </div>
        )}
        {searching && search.isError && (
          <div className="px-4 py-3 text-sm text-destructive" role="alert">
            Search failed: {sanitizeErrorMessage((search.error as Error)?.message)}
          </div>
        )}
        {searching &&
          KIND_ORDER.map((kind) => {
            const group = hits.filter((h) => h.kind === kind);
            if (!group.length) return null;
            const Icon = KIND_META[kind].icon;
            return (
              <CommandGroup key={kind} heading={KIND_META[kind].label}>
                {group.map((h) => (
                  <CommandItem key={`${h.kind}:${h.id}`} value={`${h.kind}:${h.id}`} onSelect={() => openHit(h)}>
                    <Icon aria-hidden="true" />
                    <span className="min-w-0 truncate">{h.label}</span>
                    {h.kind === "deal" && h.value != null ? (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatCurrency(h.value, organization?.currency)}
                      </span>
                    ) : h.sub ? (
                      <span className="ml-auto max-w-[45%] shrink-0 truncate text-xs capitalize text-muted-foreground">{h.sub}</span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        {q && (
          <CommandGroup heading="Assistant">
            <CommandItem
              value="ask-ai-query"
              onSelect={() => {
                close();
                openAssistant(q);
              }}
            >
              <Sparkles aria-hidden="true" />
              <span className="min-w-0 truncate">Ask the assistant: “{q}”</span>
            </CommandItem>
          </CommandGroup>
        )}
        {noMatches && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground" role="status">
            No results for “{q}”
          </div>
        )}
        {!q && recent.length > 0 && (
          <CommandGroup heading="Recent">
            {recent.map((h) => {
              const Icon = KIND_META[h.kind].icon;
              return (
                <CommandItem key={`recent:${h.kind}:${h.id}`} value={`recent:${h.kind}:${h.id}`} onSelect={() => openHit(h)}>
                  <Clock aria-hidden="true" />
                  <span className="min-w-0 truncate">{h.label}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="!size-3" aria-hidden="true" />
                    {KIND_META[h.kind].singular}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        {q.length > 0 && q.length < MIN_SEARCH_LENGTH && (
          <div className="px-4 pb-1 pt-3 text-xs text-muted-foreground">Type at least {MIN_SEARCH_LENGTH} characters to search records.</div>
        )}
        {createMatches.length > 0 && (
          <>
            {(hits.length > 0 || (!q && recent.length > 0)) && <CommandSeparator />}
            <CommandGroup heading="Create">{createMatches.map(renderCommand)}</CommandGroup>
          </>
        )}
        {navMatches.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Go to">{navMatches.map(renderCommand)}</CommandGroup>
          </>
        )}
        {generalMatches.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="General">{generalMatches.map(renderCommand)}</CommandGroup>
          </>
        )}
      </CommandList>
      <div className="hidden items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground sm:flex">
        <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate</span>
        <span><Kbd>↵</Kbd> to select</span>
        <span><Kbd>Esc</Kbd> to close</span>
      </div>
    </CommandDialog>
  );
}

/* ------------------------------------------------------------------------ shortcuts help dialog */

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 text-2xs font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const mod = modKeyLabel("k");
  const rows: Array<{ keys: string[]; label: string }> = [
    { keys: [mod], label: "Search and commands" },
    { keys: ["?"], label: "Show keyboard shortcuts" },
    { keys: [modKeyLabel("b")], label: "Toggle sidebar" },
    ...GO_TO_SHORTCUTS.map((s) => ({ keys: ["G", s.key.toUpperCase()], label: `Go to ${s.label}` })),
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Single-key shortcuts are ignored while you're typing in a field.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
              <span>{r.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {r.keys.map((k, i) => (
                  <span key={k + i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-xs text-muted-foreground">then</span>}
                    <Kbd>{k}</Kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
