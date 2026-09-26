import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  AiNotConfiguredError,
  AiRateLimitError,
  aiErrorFromStatus,
  buildAssistantSystemPrompt,
  normalizeAiMarkdown,
  trimHistory,
} from "@/lib/ai";
import { daysUntil, summarizeWorkspace, type WorkspaceSnapshot } from "@/lib/aiContext";

describe("aiErrorFromStatus", () => {
  it("maps 503 and 429 to typed errors", () => {
    expect(aiErrorFromStatus(503)).toBeInstanceOf(AiNotConfiguredError);
    expect(aiErrorFromStatus(429)).toBeInstanceOf(AiRateLimitError);
    expect(aiErrorFromStatus(500).message).toMatch(/couldn't answer/i);
  });
});

describe("normalizeAiMarkdown", () => {
  it("converts headings, alternative bullets and fences to the supported subset", () => {
    const out = normalizeAiMarkdown("### Summary\n* one\n• two\n  - nested\n```\ncode\n```\n---\n\n\n\nend");
    expect(out).toBe("**Summary**\n- one\n- two\n- nested\n\ncode\n\nend");
  });
});

describe("trimHistory", () => {
  it("keeps recent turns and starts with a user turn", () => {
    const h = [
      { role: "user" as const, content: "a" },
      { role: "assistant" as const, content: "b" },
      { role: "user" as const, content: "c" },
    ];
    expect(trimHistory(h, 2).map((m) => m.content)).toEqual(["c"]);
    expect(trimHistory(h, 8).map((m) => m.content)).toEqual(["a", "b", "c"]);
  });
});

describe("buildAssistantSystemPrompt", () => {
  it("includes workspace data and never a hardcoded company", () => {
    const p = buildAssistantSystemPrompt({ currency: "EUR", today: "2026-01-01", workspaceSummary: "DATA" });
    expect(p).toContain("DATA");
    expect(p).toContain("EUR");
    expect(p).not.toMatch(/goom construction/i);
  });
});

describe("summarizeWorkspace", () => {
  const today = new Date(2026, 8, 26);
  const snap: WorkspaceSnapshot = {
    pipelines: [{ id: "p1", name: "Sales" }],
    stages: [
      { id: "s1", name: "Lead", pipeline_id: "p1", position: 0 },
      { id: "s2", name: "Won", pipeline_id: "p1", position: 1, is_won: true },
      { id: "s3", name: "Closed Lost", pipeline_id: "p1", position: 2 },
    ],
    deals: [
      { id: "d1", title: "Big", value: 1000, probability: null, close_date: "2026-09-20", stage_id: "s1", pipeline_id: "p1", notes: null, updated_at: "2026-09-25T10:00:00Z" },
      { id: "d2", title: "Stale", value: 500, probability: 20, close_date: "2026-12-01", stage_id: "s1", pipeline_id: "p1", notes: null, updated_at: "2026-08-01T10:00:00Z" },
      { id: "d3", title: "Done", value: 700, probability: null, close_date: null, stage_id: "s2", pipeline_id: "p1", notes: null, updated_at: "2026-09-01T10:00:00Z" },
      { id: "d4", title: "Gone", value: 300, probability: null, close_date: null, stage_id: "s3", pipeline_id: "p1", notes: null, updated_at: "2026-09-01T10:00:00Z" },
    ],
    dealCount: 4,
    tasks: [
      { id: "t1", title: "Call", due_date: "2026-09-24", priority: "high", completed: false },
      { id: "t2", title: "Send deck", due_date: "2026-09-28", priority: null, completed: false },
    ],
    activities: [],
  };

  it("separates open/won/lost and flags real risk signals", () => {
    const s = summarizeWorkspace(snap, "USD", today);
    expect(s.openDealCount).toBe(2);
    expect(s.openValue).toBe(1500);
    expect(s.atRisk.map((r) => r.id)).toEqual(["d1", "d2"]);
    expect(s.overdueTaskCount).toBe(1);
    expect(s.followUpDeal?.id).toBe("d1");
    expect(s.text).toContain("1 won");
    expect(s.text).toContain("1 lost");
    expect(s.isEmpty).toBe(false);
  });

  it("computes day offsets at local midnight", () => {
    expect(daysUntil("2026-09-27", today)).toBe(1);
    expect(daysUntil("2026-09-20", today)).toBe(-6);
  });
});
