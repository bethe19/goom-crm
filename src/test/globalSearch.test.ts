import { describe, expect, it } from "vitest";
import { hitHref, matchesCommand, parseSearchResults, pushRecent, recentRecordsKey } from "@/hooks/useGlobalSearch";
import { notificationHref } from "@/hooks/useNotifications";

describe("parseSearchResults", () => {
  it("flattens every section of the RPC payload", () => {
    const hits = parseSearchResults({
      deals: [{ id: "d1", title: "Renewal", value: "1200" }],
      contacts: [{ id: "c1", first_name: "Ada", last_name: "Lovelace", email: "ada@example.com" }, { id: "c2", first_name: "", last_name: "", email: "x@y.z" }],
      companies: [{ id: "co1", name: "Acme", industry: "Retail" }],
      activities: [{ id: "a1", title: "Kickoff call", type: "call" }],
      tasks: [{ id: "t1", title: "Send quote", priority: "high", completed: true }],
    });
    expect(hits.map((h) => `${h.kind}:${h.id}`)).toEqual(["deal:d1", "contact:c1", "contact:c2", "company:co1", "activity:a1", "task:t1"]);
    expect(hits[0].value).toBe(1200);
    expect(hits[1]).toMatchObject({ label: "Ada Lovelace", sub: "ada@example.com" });
    expect(hits[2]).toMatchObject({ label: "x@y.z", sub: null });
    expect(hits[5].sub).toBe("Completed");
  });

  it("tolerates null, junk and missing ids", () => {
    expect(parseSearchResults(null)).toEqual([]);
    expect(parseSearchResults("nope")).toEqual([]);
    expect(parseSearchResults({ deals: [{ title: "no id" }, null], contacts: "bad" })).toEqual([]);
  });
});

describe("palette helpers", () => {
  it("builds ?open= deep links", () => {
    expect(hitHref({ kind: "company", id: "abc" })).toBe("/companies?open=abc");
    expect(notificationHref({ reference_type: "task", reference_id: "t1" })).toBe("/tasks?open=t1");
    expect(notificationHref({ reference_type: "unknown", reference_id: "t1" })).toBeNull();
    expect(notificationHref({ reference_type: null, reference_id: null })).toBeNull();
  });

  it("keeps recents unique, newest first and capped", () => {
    let list = [] as ReturnType<typeof pushRecent>;
    for (let i = 0; i < 8; i++) list = pushRecent(list, { kind: "deal", id: String(i), label: `D${i}` });
    list = pushRecent(list, { kind: "deal", id: "5", label: "D5" });
    expect(list).toHaveLength(6);
    expect(list[0].id).toBe("5");
    expect(list.filter((h) => h.id === "5")).toHaveLength(1);
  });

  it("keys recents per user and workspace", () => {
    expect(recentRecordsKey("u1", "org1")).toBe("goom:recent-records:u1:org1");
    expect(recentRecordsKey("u1", "org2")).not.toBe(recentRecordsKey("u1", "org1"));
    expect(recentRecordsKey("u1", undefined)).toBeNull();
    expect(recentRecordsKey(undefined, "org1")).toBeNull();
  });

  it("matches commands by label or keyword", () => {
    expect(matchesCommand("pipe", "Pipeline")).toBe(true);
    expect(matchesCommand("deal", "Pipeline", ["deals", "kanban"])).toBe(true);
    expect(matchesCommand("zzz", "Pipeline")).toBe(false);
    expect(matchesCommand("  ", "Anything")).toBe(true);
  });
});
