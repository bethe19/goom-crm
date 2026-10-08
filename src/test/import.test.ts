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
  inferDateOrder,
  localeDateOrder,
  resolveStage,
  checkDealStages,
  type ContactImportValues,
  type DealImportValues,
  type CompanyImportValues,
} from "@/lib/dataTransfer";
import { applyTagChange } from "@/hooks/useContacts";
import { chunk, escapeLike } from "@/lib/fetchAll";
import { parseCsv, parseCsvObjects, toCsv } from "@/lib/csv";
import { TEMPLATE_CONFIGS, isTemplateSampleRow, parseImportSpreadsheet } from "@/lib/excelTemplates";

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
      const m = autoMapColumns(TEMPLATE_CONFIGS[entity].headers, entity);
      expect(missingRequiredFields(entity, m)).toEqual([]);
      for (const h of TEMPLATE_CONFIGS[entity].headers) expect(Object.values(m)).toContain(h);
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
    expect(parseDateInput("15/04/2026", "dmy")).toEqual({ ok: true, value: "2026-04-15" });
    expect(parseDateInput("05/04/2026", "dmy")).toEqual({ ok: true, value: "2026-04-05" });
    // No per-row swap: the column's order applies, and an impossible date is an error.
    expect(parseDateInput("15/04/2026").ok).toBe(false);
    expect(parseDateInput("05.04.2026")).toEqual({ ok: true, value: "2026-04-05" });
    expect(parseDateInput("05.04.2026", "mdy")).toEqual({ ok: true, value: "2026-04-05" });
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
      created_at: "2026-01-02T12:00:00Z",
      companies: { name: "Acme" },
    });
    expect(row).toEqual(["Ada", "L", "ada@x.io", "", "", "Acme", "a; b", "2026-01-02"]);
  });

  it("verifies branded template configurations have complete specifications and valid sample rows", async () => {
    const { TEMPLATE_CONFIGS } = await import("@/lib/excelTemplates");
    for (const entity of ["contacts", "companies", "deals"] as const) {
      const cfg = TEMPLATE_CONFIGS[entity];
      expect(cfg.headers.length).toBeGreaterThan(0);
      expect(cfg.fields.length).toBeGreaterThan(0);
      expect(cfg.sampleRows.length).toBeGreaterThan(0);

      // Verify all headers are covered by field specifications
      const fieldKeys = cfg.fields.map((f) => f.key);
      for (const h of cfg.headers) {
        expect(fieldKeys).toContain(h);
      }

      // Verify autoMapColumns maps the template headers without missing required fields
      const mapping = autoMapColumns(cfg.headers, entity);
      expect(missingRequiredFields(entity, mapping)).toEqual([]);

      // Verify each sample row has the same number of columns as headers
      for (const row of cfg.sampleRows) {
        expect(row.length).toBe(cfg.headers.length);
      }
    }
  });
});

describe("CSV dialects", () => {
  it("detects semicolon, tab and Excel sep= files", () => {
    expect(parseCsvObjects("name;industry\r\nAcme, Inc.;Software\r\n")).toEqual({
      headers: ["name", "industry"],
      rows: [{ name: "Acme, Inc.", industry: "Software" }],
    });
    expect(parseCsvObjects("name\tindustry\nAcme\tRetail").rows).toEqual([{ name: "Acme", industry: "Retail" }]);
    expect(parseCsvObjects("sep=;\nname;value\nDeal;1,5").rows).toEqual([{ name: "Deal", value: "1,5" }]);
  });

  it("keeps a stray quote inside a field as text", () => {
    const { rows } = parseCsvObjects('name,height,notes\nAda,5\'10",tall\nBob,6 ft,"said ""hi"", left"\n');
    expect(rows).toEqual([
      { name: "Ada", height: '5\'10"', notes: "tall" },
      { name: "Bob", height: "6 ft", notes: 'said "hi", left' },
    ]);
  });

  it("rejects an unclosed quote instead of swallowing the rest of the file", () => {
    expect(() => parseCsv('name,notes\nAcme,"open\nBeta,ok\n')).toThrow(/Line 2/);
  });
});

describe("date order per column", () => {
  it("reads a DD/MM column the same way for every row", () => {
    const values = ["13/04/2026", "05/04/2026"];
    expect(inferDateOrder(values, "mdy")).toEqual({ order: "dmy", ambiguous: false });
    const rows = values.map((d) => ({ T: "Deal", D: d }));
    const out = validateRows("deals", rows, { title: "T", close_date: "D" }, "dmy");
    expect(out.map((r) => (r.values as DealImportValues).close_date)).toEqual(["2026-04-13", "2026-04-05"]);
  });

  it("flags columns that don't settle the order", () => {
    expect(inferDateOrder(["05/04/2026", "2026-01-01", ""], "dmy")).toEqual({ order: "dmy", ambiguous: true });
    expect(inferDateOrder(["04/13/2026", "05/04/2026"], "dmy")).toEqual({ order: "mdy", ambiguous: false });
    expect(inferDateOrder(["13/04/2026", "04/13/2026"], "mdy").ambiguous).toBe(true);
    expect(inferDateOrder(["2026-04-13", "15.04.2026"], "mdy")).toEqual({ order: "mdy", ambiguous: false });
    expect(localeDateOrder("en-GB")).toBe("dmy");
    expect(localeDateOrder("en-US")).toBe("mdy");
  });
});

describe("amounts with currencies", () => {
  it("accepts ETB and other codes or symbols around the number", () => {
    expect(parseAmount("ETB 45,000.00")).toEqual({ ok: true, value: 45000 });
    expect(parseAmount("45,000 ETB")).toEqual({ ok: true, value: 45000 });
    expect(parseAmount("Br 1,200")).toEqual({ ok: true, value: 1200 });
    expect(parseAmount("ብር 500")).toEqual({ ok: true, value: 500 });
    expect(parseAmount("US$ 2,500")).toEqual({ ok: true, value: 2500 });
    expect(parseAmount("₦12,000")).toEqual({ ok: true, value: 12000 });
    expect(parseAmount("45k ETB")).toEqual({ ok: true, value: 45000 });
    expect(parseAmount("ETB").ok).toBe(false);
    expect(parseAmount("TBD").ok).toBe(false);
  });
});

describe("re-importing exported CSVs", () => {
  it("drops the formula guard the export adds", () => {
    const csv = toCsv(["first_name", "phone", "position"], [["Abebe", "+251911234567", "-"]]);
    expect(csv).toContain("'+251911234567");
    const { headers, rows } = parseCsvObjects(csv);
    const [r] = validateRows("contacts", rows, autoMapColumns(headers, "contacts"));
    expect(r.values as ContactImportValues).toMatchObject({ phone: "+251911234567", position: "-" });
    // An apostrophe that isn't a guard stays.
    const [kept] = validateRows("contacts", [{ F: "O'Neil", P: "'123" }], { first_name: "F", phone: "P" });
    expect(kept.values as ContactImportValues).toMatchObject({ first_name: "O'Neil", phone: "'123" });
  });
});

describe("stage matching", () => {
  const stages = [
    { id: "p", name: "ተስፋ", position: 0 },
    { id: "n", name: "Négociation", position: 1 },
    { id: "w", name: "ተሸጧል", position: 2, is_won: true },
    { id: "l", name: "Perdu", position: 3, is_lost: true },
  ];

  it("matches non-Latin and accented names, and Won/Lost aliases", () => {
    expect(resolveStage(stages, "ተሸጧል")).toEqual({ stage: stages[2], matched: true });
    expect(resolveStage(stages, "negociation").stage?.id).toBe("n");
    expect(resolveStage(stages, "Closed Won")).toEqual({ stage: stages[2], matched: true });
    expect(resolveStage(stages, "closed-lost").stage?.id).toBe("l");
    expect(resolveStage(stages, "Lost").stage?.id).toBe("l");
    expect(resolveStage(stages, "Discovery")).toEqual({ stage: stages[0], matched: false });
    expect(resolveStage(stages, "")).toEqual({ stage: stages[0], matched: false });
  });

  it("requires a close date for won/lost deals and counts unknown stages", () => {
    const rows = validateRows(
      "deals",
      [
        { T: "Old win", S: "Closed Won", D: "2024-03-01" },
        { T: "No date", S: "Perdu", D: "" },
        { T: "Unknown", S: "Discovery", D: "" },
        { T: "Blank stage", S: "", D: "" },
      ],
      { title: "T", stage: "S", close_date: "D" },
    );
    const out = checkDealStages(rows, stages);
    expect(out.rows.map((r) => r.errors)).toEqual([[], ['Close date is required for deals in the "Perdu" stage'], [], []]);
    expect(out.unmatchedStages).toBe(1);
  });
});

describe("template sample rows", () => {
  it("recognizes untouched sample rows through the mapping", () => {
    const cfg = TEMPLATE_CONFIGS.deals;
    const mapping = autoMapColumns(cfg.headers, "deals");
    const sample = Object.fromEntries(cfg.headers.map((h, i) => [h, cfg.sampleRows[0][i]]));
    expect(isTemplateSampleRow("deals", sample, mapping)).toBe(true);
    // Excel re-formatting numbers/dates doesn't matter; changed text does.
    expect(isTemplateSampleRow("deals", { ...sample, close_date: "11/30/2026", value: "45,000" }, mapping)).toBe(true);
    expect(isTemplateSampleRow("deals", { ...sample, title: "Real deal" }, mapping)).toBe(false);
  });
});

describe("parseImportSpreadsheet", () => {
  const fileOf = (name: string, data: ArrayBuffer | Uint8Array, type = "") => {
    const buffer = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
    return { name, type, size: buffer.byteLength, arrayBuffer: async () => buffer } as unknown as File;
  };

  it("reads raw cell values from the Data Import sheet", async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["phone", "close_date", "value", "probability", "vip", "title"],
      [251911234567, 46125, 45000.5, 0.75, true, "Deal"],
      [911234567, 46117, 1234567, 0.4, false, "Other"],
    ]);
    ws.B2.z = "dd/mm/yyyy"; // displays 13/04/2026
    ws.B3.z = "dd/mm/yyyy"; // displays 05/04/2026
    ws.C2.z = '"ETB" #,##0.00';
    ws.C3.z = "#,##0";
    ws.D2.z = "0%";
    ws.D3.z = "0%";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Read me first"]]), "Notes");
    XLSX.utils.book_append_sheet(wb, ws, "Data Import");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const parsed = await parseImportSpreadsheet(fileOf("deals.xlsx", buffer), { maxRows: 100 });
    expect(parsed.truncated).toBe(false);
    expect(parsed.headers).toEqual(["phone", "close_date", "value", "probability", "vip", "title"]);
    expect(parsed.rows).toEqual([
      { phone: "251911234567", close_date: "2026-04-13", value: "45000.5", probability: "75%", vip: "TRUE", title: "Deal" },
      { phone: "911234567", close_date: "2026-04-05", value: "1234567", probability: "40%", vip: "FALSE", title: "Other" },
    ]);
  });

  it("flags sheets with more rows than allowed", async () => {
    const XLSX = await import("xlsx");
    const aoa = [["title"], ...Array.from({ length: 1100 }, (_, i) => [`Deal ${i}`])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Sheet1");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    expect((await parseImportSpreadsheet(fileOf("big.xlsx", buffer), { maxRows: 50 })).truncated).toBe(true);
  });

  it("parses .csv by extension even when the browser calls it an Excel file", async () => {
    const utf8 = new TextEncoder().encode("name;city\nAbebe Bikila;Addis Ababa\nCafé Lumière;Mekelle\n");
    const parsed = await parseImportSpreadsheet(fileOf("contacts.csv", utf8, "application/vnd.ms-excel"));
    expect(parsed.rows).toEqual([
      { name: "Abebe Bikila", city: "Addis Ababa" },
      { name: "Café Lumière", city: "Mekelle" },
    ]);
    // Excel's plain "CSV" save on Windows is Windows-1252, not UTF-8.
    const cp1252 = new Uint8Array([...new TextEncoder().encode("name\nCaf"), 0xe9, 0x0a]);
    expect((await parseImportSpreadsheet(fileOf("legacy.csv", cp1252))).rows).toEqual([{ name: "Café" }]);
  });
});
