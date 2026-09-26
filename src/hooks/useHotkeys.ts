import { useEffect, useRef } from "react";

/** "g then <key>" navigation targets. Shared by the hotkey handler, the palette and the help dialog. */
export const GO_TO_SHORTCUTS: ReadonlyArray<{ key: string; label: string; to: string }> = [
  { key: "d", label: "Dashboard", to: "/dashboard" },
  { key: "p", label: "Pipeline", to: "/pipeline" },
  { key: "c", label: "Contacts", to: "/contacts" },
  { key: "o", label: "Companies", to: "/companies" },
  { key: "t", label: "Tasks", to: "/tasks" },
  { key: "a", label: "Activities", to: "/activities" },
  { key: "r", label: "Reports", to: "/reports" },
  { key: "s", label: "Settings", to: "/settings" },
];

/** How long after pressing `g` the second key is accepted. */
export const SEQUENCE_TIMEOUT_MS = 1200;

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || navigator.platform || navigator.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Label for the command palette shortcut, e.g. "⌘K" on macOS, "Ctrl K" elsewhere. */
export function modKeyLabel(key: string): string {
  return isMacPlatform() ? `⌘${key.toUpperCase()}` : `Ctrl ${key.toUpperCase()}`;
}

/** True when the event target is somewhere the user is typing (so single-key shortcuts must not fire). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== "string") return false;
  const el = target as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag === "input") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(type);
  }
  if (el.isContentEditable) return true;
  const role = el.getAttribute("role");
  return role === "textbox" || role === "combobox" || role === "searchbox";
}

export type ShortcutAction =
  | { type: "palette" }
  | { type: "help" }
  | { type: "goto"; to: string }
  | { type: "pending" }
  | null;

export interface KeyLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/**
 * Pure key-sequence resolver (unit tested). Returns the action for this key press and the new
 * "pending g" timestamp. `typing` = focus is in an editable field.
 */
export function resolveShortcut(
  e: KeyLike,
  state: { pendingSince: number | null; now: number; typing: boolean },
): { action: ShortcutAction; pendingSince: number | null } {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  // ⌘K / Ctrl+K works everywhere, including inside inputs.
  if ((e.metaKey || e.ctrlKey) && !e.altKey && key === "k") {
    return { action: { type: "palette" }, pendingSince: null };
  }
  if (state.typing || e.metaKey || e.ctrlKey || e.altKey) {
    return { action: null, pendingSince: null };
  }

  const pending = state.pendingSince !== null && state.now - state.pendingSince <= SEQUENCE_TIMEOUT_MS;
  if (pending) {
    const target = GO_TO_SHORTCUTS.find((s) => s.key === key);
    if (target) return { action: { type: "goto", to: target.to }, pendingSince: null };
    // Any other key cancels the sequence (and falls through so e.g. "?" still works).
  }

  if (e.key === "?") return { action: { type: "help" }, pendingSince: null };
  if (key === "g" && !e.shiftKey) return { action: { type: "pending" }, pendingSince: state.now };
  return { action: null, pendingSince: null };
}

interface GlobalShortcutHandlers {
  onOpenPalette: () => void;
  onShowHelp: () => void;
  onNavigate: (to: string) => void;
  /** Disable while e.g. onboarding is showing. */
  enabled?: boolean;
}

/** Global keyboard shortcuts: ⌘K/Ctrl+K palette, `?` help, `g` + letter go-to. Ignored while typing. */
export function useGlobalShortcuts({ onOpenPalette, onShowHelp, onNavigate, enabled = true }: GlobalShortcutHandlers) {
  const handlers = useRef({ onOpenPalette, onShowHelp, onNavigate });
  handlers.current = { onOpenPalette, onShowHelp, onNavigate };

  useEffect(() => {
    if (!enabled) return;
    let pendingSince: number | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.repeat) return;
      // Leave single-key shortcuts alone while a dialog/menu has focus, except ⌘K.
      const inOverlay =
        e.target instanceof Element && !!e.target.closest('[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]');
      const result = resolveShortcut(e, {
        pendingSince,
        now: Date.now(),
        typing: isTypingTarget(e.target) || inOverlay,
      });
      pendingSince = result.pendingSince;
      const action = result.action;
      if (!action || action.type === "pending") return;
      e.preventDefault();
      if (action.type === "palette") handlers.current.onOpenPalette();
      else if (action.type === "help") handlers.current.onShowHelp();
      else if (action.type === "goto") handlers.current.onNavigate(action.to);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
