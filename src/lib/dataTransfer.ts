/**
 * Pure helpers for CSV import/export: column auto-mapping, per-row validation and value parsing,
 * stage matching, failed-row reports and export row shapes. No I/O here, so it's unit tested in
 * src/test/import.test.ts.
 */
import { format } from "date-fns";

export type ImportEntity = "contacts" | "companies" | "deals";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  /** Normalized header aliases (lowercase, alphanumerics only). */
  synonyms: string[];
  hint?: string;
}

export const IMPORT_FIELDS: Record<ImportEntity, ImportField[]> = {
  contacts: [
    { key: "first_name", label: "First name", required: true, synonyms: ["firstname", "first", "givenname", "forename", "fname"], hint: "Or map a full name column below" },
    { key: "last_name", label: "Last name", synonyms: ["lastname", "last", "surname", "familyname", "lname"] },
    { key: "full_name", label: "Full name", synonyms: ["name", "fullname", "contactname", "contact", "person"], hint: "Split into first and last name" },
    { key: "email", label: "Email", synonyms: ["email", "emailaddress", "mail", "workemail", "primaryemail", "emailaddr"] },
    { key: "phone", label: "Phone", synonyms: ["phone", "phonenumber", "mobile", "mobilephone", "telephone", "tel", "cell", "cellphone", "workphone"] },
    { key: "position", label: "Job title", synonyms: ["position", "title", "jobtitle", "role", "job"] },
    { key: "company", label: "Company", synonyms: ["company", "companyname", "organization", "organisation", "account", "accountname", "employer", "org"], hint: "Linked by name; missing companies are created" },
    { key: "tags", label: "Tags", synonyms: ["tags", "tag", "labels", "label", "segments"], hint: "Separate with ; , or |" },
  ],
  companies: [
    { key: "name", label: "Name", required: true, synonyms: ["name", "company", "companyname", "accountname", "organization", "organisation", "account", "businessname"] },
    { key: "industry", label: "Industry", synonyms: ["industry", "sector", "vertical", "category"] },
    { key: "website", label: "Website", synonyms: ["website", "url", "web", "domain", "site", "homepage", "websiteurl", "webaddress"] },
  ],
  deals: [
    { key: "title", label: "Title", required: true, synonyms: ["title", "deal", "dealname", "dealtitle", "name", "opportunity", "opportunityname"] },
    { key: "value", label: "Value", synonyms: ["value", "amount", "dealvalue", "price", "revenue", "dealamount", "size"] },
    { key: "probability", label: "Probability (%)", synonyms: ["probability", "likelihood", "winprobability", "chance", "confidence"] },
    { key: "close_date", label: "Close date", synonyms: ["closedate", "expectedclose", "expectedclosedate", "closingdate", "close", "closedat", "duedate"] },
    { key: "stage", label: "Stage", synonyms: ["stage", "dealstage", "status", "pipelinestage", "phase"], hint: "Matched by name, else the first stage" },
    { key: "company", label: "Company", synonyms: ["company", "companyname", "account", "accountname", "organization", "organisation", "org"], hint: "Linked by name; missing companies are created" },
    { key: "contact_email", label: "Contact email", synonyms: ["contactemail", "email", "contact", "emailaddress", "primarycontactemail"], hint: "Linked to an existing contact" },
    { key: "notes", label: "Notes", synonyms: ["notes", "note", "description", "comments", "comment", "details"] },
    { key: "created_date", label: "Created date", synonyms: ["created", "createddate", "createdat", "createdon", "datecreated", "opendate", "opened"], hint: "Defaults to today" },
  ],
};

/** field key → CSV header ("" = not mapped). */
export type ColumnMapping = Record<string, string>;

/**
 * Case, accent, space and punctuation-insensitive form of a header or stage name. Letters and digits
 * of any script survive ("Téléphone" → "telephone", "ተሸጧል" stays), so non-Latin names still compare.
 */
export function normalizeHeader(h: string): string {
  return h
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Guesses which CSV header feeds each field (case/space/punctuation-insensitive, with synonyms).
 * Each header is used at most once; fields claim headers in field order, trying the field's own
 * key before its synonyms.
 */
export function autoMapColumns(headers: string[], entity: ImportEntity): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  const normalized = headers.map((h) => ({ h, n: normalizeHeader(h) }));
  // Pass 1: exact key matches ("first_name" / "First Name") win over synonyms elsewhere.
  for (const f of IMPORT_FIELDS[entity]) {
    const hit = normalized.find((x) => !used.has(x.h) && x.n === normalizeHeader(f.key));
    if (hit) {
      mapping[f.key] = hit.h;
      used.add(hit.h);
    }
  }
  // Pass 2: synonyms.
  for (const f of IMPORT_FIELDS[entity]) {
    if (mapping[f.key]) continue;
    mapping[f.key] = "";
    for (const syn of f.synonyms) {
      const hit = normalized.find((x) => !used.has(x.h) && x.n === syn);
      if (hit) {
        mapping[f.key] = hit.h;
        used.add(hit.h);
        break;
      }
    }
  }
  return mapping;
}

/** Fields that are required but not satisfied by the mapping (contacts accept full_name for first_name). */
export function missingRequiredFields(entity: ImportEntity, mapping: ColumnMapping): ImportField[] {
  return IMPORT_FIELDS[entity].filter((f) => {
    if (!f.required || mapping[f.key]) return false;
    if (entity === "contacts" && f.key === "first_name" && mapping.full_name) return false;
    return true;
  });
}

// ---------- value parsing ----------

type Parsed<T> = { ok: true; value: T; error?: undefined } | { ok: false; value?: undefined; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

/**
 * Drops a currency symbol (any, e.g. $ € ₹) and a 1–3 letter currency code or abbreviation before or
 * after the number: "ETB 45,000.00", "Br 1,200", "45,000 ETB", "ብር 500". A trailing k/m stays (85k).
 */
function stripCurrency(s: string): string {
  let out = s.replace(/\p{Sc}/gu, "").trim();
  out = out.replace(/^\p{L}{1,3}\.?\s*(?=[-\d.,])/u, "");
  const suffix = /\s*(\p{L}{1,3})\.?$/u.exec(out);
  if (suffix && !/^[km]$/i.test(suffix[1]) && /[\d.,km]$/i.test(out.slice(0, suffix.index))) out = out.slice(0, suffix.index);
  return out;
}

/** "$1,200.50", "ETB 45,000", "1 200", "85k", "1.2M", "1.234,56 EUR" → number. Blank → null. */
export function parseAmount(raw: string): Parsed<number | null> {
  let s = (raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  s = stripCurrency(s).replace(/[\s'_]/g, "");
  const m = /^(-?)([\d.,]+)([km])?$/i.exec(s);
  if (!m) return { ok: false, error: `"${raw.trim()}" isn't a number` };
  let digits = m[2];
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(digits) || /^\d+,\d{1,2}$/.test(digits)) {
    // European format: dots for thousands, comma for decimals.
    digits = digits.replace(/\./g, "").replace(",", ".");
  } else {
    digits = digits.replace(/,/g, "");
  }
  if (!/^\d*\.?\d+$|^\d+\.$/.test(digits)) return { ok: false, error: `"${raw.trim()}" isn't a number` };
  let n = Number(digits);
  if (m[3]) n *= m[3].toLowerCase() === "k" ? 1_000 : 1_000_000;
  if (m[1] === "-") return { ok: false, error: "Value can't be negative" };
  if (!Number.isFinite(n)) return { ok: false, error: `"${raw.trim()}" isn't a number` };
  if (n > 1e12) return { ok: false, error: "Value is too large" };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

/** "60", "60%", "0.6" → 60. Blank → null. Must end up within 0–100. */
export function parseProbability(raw: string): Parsed<number | null> {
  const s = (raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  const hasPct = s.endsWith("%");
  const n = Number(s.replace(/%$/, "").trim());
  if (!Number.isFinite(n) || s.replace(/%$/, "").trim() === "") return { ok: false, error: `Probability "${s}" isn't a number` };
  const v = !hasPct && n > 0 && n < 1 && s.includes(".") ? n * 100 : n;
  if (v < 0 || v > 100) return { ok: false, error: "Probability must be between 0 and 100" };
  return { ok: true, value: Math.round(v) };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function validYmd(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Order of day and month in numeric dates like 05/04/2026. */
export type DateOrder = "dmy" | "mdy";

/** Day/month order of the browser's (or the given) locale: "dmy" for en-GB, de, am…, "mdy" for en-US. */
export function localeDateOrder(locale?: string): DateOrder {
  try {
    const parts = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(new Date(2026, 3, 15));
    const day = parts.findIndex((p) => p.type === "day");
    const month = parts.findIndex((p) => p.type === "month");
    return day >= 0 && month >= 0 && day < month ? "dmy" : "mdy";
  } catch {
    return "mdy";
  }
}

const NUMERIC_DATE_RE = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/;

/**
 * Picks one day/month order for a whole column of numeric dates, so 13/04/2026 and 05/04/2026 in the
 * same file are read the same way. A part > 12 settles it; when nothing does (every value ≤ 12, or
 * the column contradicts itself) `ambiguous` is true and the order is `fallback` (or the majority).
 */
export function inferDateOrder(values: string[], fallback: DateOrder): { order: DateOrder; ambiguous: boolean } {
  let dmy = 0;
  let mdy = 0;
  let either = 0;
  for (const raw of values) {
    const m = NUMERIC_DATE_RE.exec((raw ?? "").trim());
    if (!m) continue;
    const a = +m[1];
    const b = +m[2];
    if (a > 12 && b <= 12) dmy++;
    else if (b > 12 && a <= 12) mdy++;
    else if (a <= 12 && b <= 12) either++;
  }
  if (dmy && !mdy) return { order: "dmy", ambiguous: false };
  if (mdy && !dmy) return { order: "mdy", ambiguous: false };
  if (dmy || mdy) return { order: dmy >= mdy ? "dmy" : "mdy", ambiguous: true };
  return { order: fallback, ambiguous: either > 0 };
}

/**
 * Parses common date formats to "YYYY-MM-DD": ISO (2026-04-15, with optional time), 2026/04/15,
 * 04/15/2026 or 15/04/2026 (per `order`, decided once per column with inferDateOrder), 15.04.2026
 * (dotted dates are always day-first), and textual dates like "Apr 15, 2026" / "15 April 2026".
 * Blank → null.
 */
export function parseDateInput(raw: string, order: DateOrder = "mdy"): Parsed<string | null> {
  const s = (raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  const bad = { ok: false as const, error: `"${s}" isn't a date we recognize (use YYYY-MM-DD)` };
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) {
    const v = validYmd(+m[1], +m[2], +m[3]);
    return v ? { ok: true, value: v } : bad;
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    let y = +m[3];
    if (m[3].length === 2) y += 2000;
    const dayFirst = s.includes(".") || order === "dmy";
    const [mo, d] = dayFirst ? [b, a] : [a, b];
    const v = validYmd(y, mo, d);
    return v ? { ok: true, value: v } : { ok: false, error: `"${s}" isn't a valid ${dayFirst ? "day/month/year" : "month/day/year"} date` };
  }
  if (/[a-z]/i.test(s)) {
    const t = new Date(s);
    if (!Number.isNaN(t.getTime())) {
      const v = validYmd(t.getFullYear(), t.getMonth() + 1, t.getDate());
      if (v) return { ok: true, value: v };
    }
  }
  return bad;
}

/** Normalizes a website to an http(s) URL; rejects other schemes and junk. Blank → null. */
export function normalizeWebsite(raw: string): Parsed<string | null> {
  const s = (raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if ((u.protocol === "http:" || u.protocol === "https:") && /\.[a-z]{2,}$/i.test(u.hostname)) {
      return { ok: true, value: s.length > 500 ? s.slice(0, 500) : withScheme };
    }
  } catch {
    /* fall through */
  }
  return { ok: false, error: `"${s}" isn't a valid website` };
}

export function splitTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of (raw ?? "").split(/[;,|]/)) {
    const t = part.trim().slice(0, 50);
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

// ---------- row validation ----------

export interface ContactImportValues {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  company: string | null;
  tags: string[];
}
export interface CompanyImportValues {
  name: string;
  industry: string | null;
  website: string | null;
}
export interface DealImportValues {
  title: string;
  value: number;
  probability: number | null;
  close_date: string | null;
  stage: string | null;
  company: string | null;
  contact_email: string | null;
  notes: string | null;
  /** YYYY-MM-DD; null = created now. */
  created_date: string | null;
}
export type ImportValues = ContactImportValues | CompanyImportValues | DealImportValues;

export interface ValidatedRow<V = ImportValues> {
  /** 0-based index into the parsed data rows. */
  index: number;
  /** Spreadsheet row number (header is row 1). */
  rowNumber: number;
  raw: Record<string, string>;
  values: V;
  errors: string[];
}

function tooLong(label: string, s: string | null, max: number, errors: string[]) {
  if (s && s.length > max) errors.push(`${label} is longer than ${max} characters`);
}

/**
 * Undoes the CSV export's formula guard ('=…, '+251…), so re-imported exports and failed-rows files
 * keep their original values.
 */
export function stripFormulaGuard(s: string): string {
  return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
}

export function validateRow(
  entity: ImportEntity,
  raw: Record<string, string>,
  mapping: ColumnMapping,
  index = 0,
  dateOrder: DateOrder = "mdy",
): ValidatedRow {
  const get = (key: string) => {
    const h = mapping[key];
    return h ? stripFormulaGuard((raw[h] ?? "").trim()).trim() : "";
  };
  const opt = (key: string) => get(key) || null;
  const errors: string[] = [];
  let values: ImportValues;

  if (entity === "contacts") {
    let first = get("first_name");
    let last = get("last_name");
    const full = get("full_name");
    if (!first && full) {
      const parts = full.split(/\s+/);
      first = parts[0] ?? "";
      if (!last) last = parts.slice(1).join(" ");
    }
    if (!first) errors.push("First name is required");
    const email = opt("email");
    if (email && !isValidEmail(email)) errors.push(`"${email}" isn't a valid email`);
    tooLong("First name", first, 100, errors);
    tooLong("Last name", last, 100, errors);
    tooLong("Phone", opt("phone"), 30, errors);
    tooLong("Job title", opt("position"), 100, errors);
    tooLong("Company", opt("company"), 200, errors);
    values = {
      first_name: first,
      last_name: last,
      email: email ? email.toLowerCase() : null,
      phone: opt("phone"),
      position: opt("position"),
      company: opt("company"),
      tags: splitTags(get("tags")),
    } satisfies ContactImportValues;
  } else if (entity === "companies") {
    const name = get("name");
    if (!name) errors.push("Name is required");
    tooLong("Name", name, 200, errors);
    tooLong("Industry", opt("industry"), 100, errors);
    const site = normalizeWebsite(get("website"));
    if (!site.ok) errors.push(site.error ?? "Invalid value");
    values = { name, industry: opt("industry"), website: site.ok ? site.value : null } satisfies CompanyImportValues;
  } else {
    const title = get("title");
    if (!title) errors.push("Title is required");
    tooLong("Title", title, 200, errors);
    tooLong("Notes", opt("notes"), 5000, errors);
    const amount = parseAmount(get("value"));
    if (!amount.ok) errors.push(amount.error ?? "Invalid value");
    const prob = parseProbability(get("probability"));
    if (!prob.ok) errors.push(prob.error ?? "Invalid value");
    const date = parseDateInput(get("close_date"), dateOrder);
    if (!date.ok) errors.push(date.error ?? "Invalid value");
    const created = parseDateInput(get("created_date"), dateOrder);
    if (!created.ok) errors.push(`Created date: ${created.error ?? "Invalid value"}`);
    const email = opt("contact_email");
    if (email && !isValidEmail(email)) errors.push(`"${email}" isn't a valid contact email`);
    values = {
      title,
      value: amount.ok ? (amount.value ?? 0) : 0,
      probability: prob.ok ? prob.value : null,
      close_date: date.ok ? date.value : null,
      stage: opt("stage"),
      company: opt("company"),
      contact_email: email ? email.toLowerCase() : null,
      notes: opt("notes"),
      created_date: created.ok ? created.value : null,
    } satisfies DealImportValues;
  }
  return { index, rowNumber: index + 2, raw, values, errors };
}

export function validateRows(entity: ImportEntity, rows: Record<string, string>[], mapping: ColumnMapping, dateOrder: DateOrder = "mdy"): ValidatedRow[] {
  return rows.map((r, i) => validateRow(entity, r, mapping, i, dateOrder));
}

/** Key used to detect duplicates (contacts by email, companies by name). null = never a duplicate. */
export function dedupeKey(entity: ImportEntity, values: ImportValues): string | null {
  if (entity === "contacts") return (values as ContactImportValues).email?.toLowerCase() ?? null;
  if (entity === "companies") return (values as CompanyImportValues).name.trim().toLowerCase() || null;
  return null;
}

interface StageLike {
  id: string;
  name: string;
  position?: number;
  is_won?: boolean | null;
  is_lost?: boolean | null;
}

/** Stage names from other CRMs' exports that mean "this pipeline's won/lost stage", whatever it's called. */
const STAGE_ALIASES: Record<string, "is_won" | "is_lost"> = { won: "is_won", closedwon: "is_won", lost: "is_lost", closedlost: "is_lost" };

/**
 * Stage match by name (case, accent and punctuation-insensitive, any script), then "Won"/"Closed Won"
 * and "Lost"/"Closed Lost" to the won/lost stage. Otherwise the first stage (by position), with
 * `matched` false so callers can warn about names that aren't in the pipeline.
 */
export function resolveStage<S extends StageLike>(stages: S[], name: string | null | undefined): { stage: S | undefined; matched: boolean } {
  const sorted = [...stages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const n = normalizeHeader(name ?? "");
  if (n) {
    const hit = sorted.find((s) => normalizeHeader(s.name) === n);
    if (hit) return { stage: hit, matched: true };
    const flag = STAGE_ALIASES[n];
    const alias = flag && sorted.find((s) => s[flag]);
    if (alias) return { stage: alias, matched: true };
  }
  return { stage: sorted[0], matched: false };
}

/** Stage for an imported name, else the first stage (by position). See resolveStage. */
export function matchStage<S extends StageLike>(stages: S[], name: string | null | undefined): S | undefined {
  return resolveStage(stages, name).stage;
}

/**
 * Stage-dependent checks for validated deal rows, once the pipeline's stages are known. Deals going
 * into a won/lost stage need a close date: it becomes won_at/lost_at (without one the database stamps
 * now, and old wins land in this month's reports). Also counts importable rows whose stage name isn't
 * in the pipeline (they go to the first stage).
 */
export function checkDealStages<S extends StageLike>(rows: ValidatedRow[], stages: S[]): { rows: ValidatedRow[]; unmatchedStages: number } {
  if (!stages.length) return { rows, unmatchedStages: 0 };
  let unmatchedStages = 0;
  const out = rows.map((r) => {
    const v = r.values as DealImportValues;
    const { stage, matched } = resolveStage(stages, v.stage);
    const closed = stage?.is_won || stage?.is_lost;
    const row = closed && !v.close_date ? { ...r, errors: [...r.errors, `Close date is required for deals in the "${stage.name}" stage`] } : r;
    if (v.stage && !matched && !row.errors.length) unmatchedStages++;
    return row;
  });
  return { rows: out, unmatchedStages };
}

export interface FailedRow {
  rowNumber: number;
  raw: Record<string, string>;
  reason: string;
}

/** Headers + rows for a downloadable "failed rows" CSV: Row, Reason, then the original columns. */
export function failedRowsCsv(headers: string[], failures: FailedRow[]): { headers: string[]; rows: string[][] } {
  return {
    headers: ["Row", "Reason", ...headers],
    rows: [...failures].sort((a, b) => a.rowNumber - b.rowNumber).map((f) => [String(f.rowNumber), f.reason, ...headers.map((h) => f.raw[h] ?? "")]),
  };
}

// ---------- export shapes ----------

/** Local calendar date (or `pattern`) of a timestamp for exports, not its UTC date; "" when missing. */
export function exportDate(ts: string | null | undefined, pattern = "yyyy-MM-dd"): string {
  if (!ts) return "";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : format(d, pattern);
}

interface ContactLike {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  tags: string[] | null;
  created_at: string;
  companies?: { name: string } | null;
}
export const CONTACT_EXPORT_HEADERS = ["First name", "Last name", "Email", "Phone", "Job title", "Company", "Tags", "Created"];
export function contactExportRow(c: ContactLike): string[] {
  return [c.first_name, c.last_name, c.email ?? "", c.phone ?? "", c.position ?? "", c.companies?.name ?? "", (c.tags ?? []).join("; "), exportDate(c.created_at)];
}

interface CompanyLike {
  name: string;
  industry: string | null;
  website: string | null;
  created_at: string;
}
export const COMPANY_EXPORT_HEADERS = ["Name", "Industry", "Website", "Created"];
export function companyExportRow(c: CompanyLike): string[] {
  return [c.name, c.industry ?? "", c.website ?? "", exportDate(c.created_at)];
}
