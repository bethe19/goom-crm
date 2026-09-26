import { describe, it, expect } from "vitest";
import {
  autoMapColumns,
  missingRequiredFields,
  parseAmount,
  parseProbability,
  parseDateInput,
  normalizeWebsite,
  splitTags,
  validateRow,
  validateRows,
  dedupeKey,
  matchStage,
  failedRowsCsv,
  contactExportRow,
  IMPORT_TEMPLATES,
  type ContactImportValues,
  type DealImportValues,
  type CompanyImportValues,
} from "@/lib/dataTransfer";
import { applyTagChange } from "@/hooks/useContacts";
import { chunk, escapeLike } from "@/lib/fetchAll";
import { parseCsvObjects } from "@/lib/csv";

describe("autoMapColumns", () => {
  it("maps case/space/punctuation variants and synonyms for contacts", () => {
    const m = autoMapColumns(["First Name", "SURNAME", "E-mail", "Company Name", "Mobile", "Job Title", "Labels"], "contacts");
    expect(m).toMatchObject({
      first_name: "First Name",
      last_name: "SURNAME",
      email: "E-mail",
      company: "Company Name",
      phone: "Mobile",
      position: "Job Title",
      tags: "Labels",
      full_name: "",
    });
  });

  it("uses each header once and prefers exact key matches", () => {
    const m = autoMapColumns(["Name", "Title", "Amount", "Email"], "deals");
    expect(m.title).toBe("Title");
    expect(m.value).toBe("Amount");
    expect(m.contact_email).toBe("Email");
    // "Name" is a synonym for title, but Title already claimed the field.
    expect(Object.values(m).filter((h) => h === "Name").length).toBeLessThanOrEqual(1);
  });

  it("maps a single Name column to full_name for contacts and name for companies", () => {
    expect(autoMapColumns(["Name", "Email"], "contacts").full_name).toBe("Name");
    expect(autoMapColumns(["Company", "Sector", "URL"], "companies")).toEqual({ name: "Company", industry: "Sector", website: "URL" });
  });

  it("round-trips the downloadable templates", () => {
    for (const entity of ["contacts", "companies", "deals"] as const) {
      const m = autoMapColumns(IMPORT_TEMPLATES[entity].headers, entity);
      expect(missingRequiredFields(entity, m)).toEqual([]);
      for (const h of IMPORT_TEMPLATES[entity].headers) expect(Object.values(m)).toContain(h);
    }
  });
});

describe("missingRequiredFields", () => {
  it("accepts full_name in place of first_name for contacts", () => {
    expect(missingRequiredFields("contacts", { first_name: "", full_name: "Name" })).toEqual([]);
    expect(missingRequiredFields("contacts", { first_name: "" }).map((f) => f.key)).toEqual(["first_name"]);
    expect(missingRequiredFields("deals", { title: "" }).map((f) => f.key)).toEqual(["title"]);
  });
});

describe("value parsing", () => {
  it("parses amounts in common formats", () => {
    expect(parseAmount("$1,200.50")).toEqual({ ok: true, value: 1200.5 });
    expect(parseAmount("85k")).toEqual({ ok: true, value: 85000 });
    expect(parseAmount("1.2M")).toEqual({ ok: true, value: 1200000 });
    expect(parseAmount("1.234,56 EUR")).toEqual({ ok: true, value: 1234.56 });
    expect(parseAmount("1 000")).toEqual({ ok: true, value: 1000 });
    expect(parseAmount("")).toEqual({ ok: true, value: null });
    expect(parseAmount("abc").ok).toBe(false);
    expect(parseAmount("-5").ok).toBe(false);
  });

  it("parses probabilities", () => {
    expect(parseProbability("60")).toEqual({ ok: true, value: 60 });
    expect(parseProbability("75%")).toEqual({ ok: true, value: 75 });
    expect(parseProbability("0.4")).toEqual({ ok: true, value: 40 });
    expect(parseProbability("")).toEqual({ ok: true, value: null });
    expect(parseProbability("120").ok).toBe(false);
    expect(parseProbability("high").ok).toBe(false);
  });

  it("parses dates to YYYY-MM-DD", () => {
    expect(parseDateInput("2026-04-15")).toEqual({ ok: true, value: "2026-04-15" });
    expect(parseDateInput("2026-04-15T10:00:00Z")).toEqual({ ok: true, value: "2026-04-15" });
    expect(parseDateInput("2026/4/5")).toEqual({ ok: true, value: "2026-04-05" });
    expect(parseDateInput("04/15/2026")).toEqual({ ok: true, value: "2026-04-15" });
    expect(parseDateInput("15/04/2026")).toEqual({ ok: true, value: "2026-04-15" });
    expect(parseDateInput("05.04.2026")).toEqual({ ok: true, value: "2026-04-05" });
    expect(parseDateInput("Apr 15, 2026")).toEqual({ ok: true, value: "2026-04-15" });
    expect(parseDateInput("")).toEqual({ ok: true, value: null });
    expect(parseDateInput("2026-02-30").ok).toBe(false);
    expect(parseDateInput("next week").ok).toBe(false);
  });

  it("normalizes websites and rejects unsafe schemes", () => {
    expect(normalizeWebsite("example.com")).toEqual({ ok: true, value: "https://example.com" });
    expect(normalizeWebsite("http://example.org/about")).toEqual({ ok: true, value: "http://example.org/about" });
    expect(normalizeWebsite("javascript:alert(1)").ok).toBe(false);
    expect(normalizeWebsite("not a site").ok).toBe(false);
  });

  it("splits tags on ; , | and dedupes case-insensitively", () => {
    expect(splitTags("vip; Partner, vip | lead")).toEqual(["vip", "Partner", "lead"]);
    expect(splitTags("")).toEqual([]);
  });
});

describe("validateRow", () => {
  it("validates contacts, splitting full names and lowercasing email", () => {
    const r = validateRow("contacts", { Name: "Ada King Lovelace", Mail: "ADA@Example.com" }, { full_name: "Name", email: "Mail" });
    expect(r.errors).toEqual([]);
    expect(r.values as ContactImportValues).toMatchObject({ first_name: "Ada", last_name: "King Lovelace", email: "ada@example.com" });
  });

  it("reports missing first name and bad email", () => {
    const r = validateRow("contacts", { F: "", E: "nope" }, { first_name: "F", email: "E" }, 4);
    expect(r.rowNumber).toBe(6);
    expect(r.errors).toEqual(["First name is required", '"nope" isn\'t a valid email']);
  });

  it("validates deals with numbers and dates", () => {
    const mapping = { title: "T", value: "V", probability: "P", close_date: "D", stage: "S" };
    const ok = validateRow("deals", { T: "Deal", V: "$5,000", P: "50%", D: "2026-01-02", S: "Won" }, mapping);
    expect(ok.errors).toEqual([]);
    expect(ok.values as DealImportValues).toMatchObject({ title: "Deal", value: 5000, probability: 50, close_date: "2026-01-02", stage: "Won" });
    const bad = validateRow("deals", { T: "", V: "lots", P: "", D: "someday", S: "" }, mapping);
    expect(bad.errors).toHaveLength(3);
  });

  it("validates companies", () => {
    const r = validateRow("companies", { N: "Acme", W: "acme.io" }, { name: "N", website: "W" });
    expect(r.errors).toEqual([]);
    expect(r.values as CompanyImportValues).toEqual({ name: "Acme", industry: null, website: "https://acme.io" });
  });

  it("works end-to-end with parseCsvObjects (quoted commas, CRLF)", () => {
    const { headers, rows } = parseCsvObjects('Company Name,Industry\r\n"Acme, Inc.",Software\r\n,Retail\r\n');
    const results = validateRows("companies", rows, autoMapColumns(headers, "companies"));
    expect(results[0].values).toMatchObject({ name: "Acme, Inc.", industry: "Software" });
    expect(results[1].errors).toEqual(["Name is required"]);
  });
});

describe("helpers", () => {
  it("dedupe keys", () => {
    expect(dedupeKey("contacts", { email: "a@b.co" } as ContactImportValues)).toBe("a@b.co");
    expect(dedupeKey("contacts", { email: null } as ContactImportValues)).toBeNull();
    expect(dedupeKey("companies", { name: " Acme " } as CompanyImportValues)).toBe("acme");
    expect(dedupeKey("deals", {} as DealImportValues)).toBeNull();
  });

  it("matches stages by name, else first by position", () => {
    const stages = [
      { id: "b", name: "Proposal", position: 1 },
      { id: "a", name: "Lead", position: 0 },
    ];
    expect(matchStage(stages, "  proposal ")?.id).toBe("b");
    expect(matchStage(stages, "Unknown")?.id).toBe("a");
    expect(matchStage(stages, null)?.id).toBe("a");
    expect(matchStage([], "x")).toBeUndefined();
  });

  it("builds a failed-rows CSV sorted by row", () => {
    const out = failedRowsCsv(["a", "b"], [
      { rowNumber: 5, raw: { a: "2", b: "y" }, reason: "Bad" },
      { rowNumber: 3, raw: { a: "1" }, reason: "Missing" },
    ]);
    expect(out.headers).toEqual(["Row", "Reason", "a", "b"]);
    expect(out.rows).toEqual([
      ["3", "Missing", "1", ""],
      ["5", "Bad", "2", "y"],
    ]);
  });

  it("applies tag changes case-insensitively", () => {
    expect(applyTagChange(["VIP"], "vip", "add")).toEqual(["VIP"]);
    expect(applyTagChange(null, "lead", "add")).toEqual(["lead"]);
    expect(applyTagChange(["VIP", "lead"], "vip", "remove")).toEqual(["lead"]);
  });

  it("chunks and escapes like patterns", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(escapeLike("a_b%c\\")).toBe("a\\_b\\%c\\\\");
  });

  it("exports contacts in a re-importable shape", () => {
    const row = contactExportRow({
      first_name: "Ada",
      last_name: "L",
      email: "ada@x.io",
      phone: null,
      position: null,
      tags: ["a", "b"],
      created_at: "2026-01-02T00:00:00Z",
      companies: { name: "Acme" },
    });
    expect(row).toEqual(["Ada", "L", "ada@x.io", "", "", "Acme", "a; b", "2026-01-02"]);
  });
});
