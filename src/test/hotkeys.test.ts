import { describe, expect, it } from "vitest";
import { isTypingTarget, resolveShortcut, SEQUENCE_TIMEOUT_MS } from "@/hooks/useHotkeys";

const idle = { pendingSince: null, now: 10_000, typing: false };

describe("resolveShortcut", () => {
  it("opens the palette with Ctrl+K or ⌘K, even while typing", () => {
    expect(resolveShortcut({ key: "k", ctrlKey: true }, idle).action).toEqual({ type: "palette" });
    expect(resolveShortcut({ key: "K", metaKey: true }, { ...idle, typing: true }).action).toEqual({ type: "palette" });
  });

  it("navigates with g then a letter inside the timeout", () => {
    const first = resolveShortcut({ key: "g" }, idle);
    expect(first.action).toEqual({ type: "pending" });
    const second = resolveShortcut({ key: "p" }, { pendingSince: first.pendingSince, now: 10_500, typing: false });
    expect(second.action).toEqual({ type: "goto", to: "/pipeline" });
    expect(second.pendingSince).toBeNull();
  });

  it("maps o to companies and s to settings", () => {
    expect(resolveShortcut({ key: "o" }, { ...idle, pendingSince: 10_000 }).action).toEqual({ type: "goto", to: "/companies" });
    expect(resolveShortcut({ key: "s" }, { ...idle, pendingSince: 10_000 }).action).toEqual({ type: "goto", to: "/settings" });
  });

  it("expires the g sequence after the timeout", () => {
    const res = resolveShortcut({ key: "d" }, { pendingSince: 0, now: SEQUENCE_TIMEOUT_MS + 1, typing: false });
    expect(res.action).toBeNull();
  });

  it("ignores single-key shortcuts while typing or with modifiers", () => {
    expect(resolveShortcut({ key: "g" }, { ...idle, typing: true }).action).toBeNull();
    expect(resolveShortcut({ key: "?", shiftKey: true }, { ...idle, typing: true }).action).toBeNull();
    expect(resolveShortcut({ key: "d", ctrlKey: true }, { ...idle, pendingSince: 10_000 }).action).toBeNull();
  });

  it("opens help with ?", () => {
    expect(resolveShortcut({ key: "?", shiftKey: true }, idle).action).toEqual({ type: "help" });
  });

  it("cancels a pending sequence on an unknown key", () => {
    const res = resolveShortcut({ key: "x" }, { ...idle, pendingSince: 10_000 });
    expect(res.action).toBeNull();
    expect(res.pendingSince).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("detects editable elements", () => {
    const input = document.createElement("input");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const textarea = document.createElement("textarea");
    const div = document.createElement("div");
    const editable = document.createElement("div");
    editable.setAttribute("role", "textbox");

    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(checkbox)).toBe(false);
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
