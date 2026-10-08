import type { CellObject, WorkSheet } from "xlsx";
import { downloadCsv, parseCsvObjects } from "@/lib/csv";
import type { ColumnMapping, ImportEntity } from "@/lib/dataTransfer";

type Xlsx = typeof import("xlsx");
let xlsxModule: Promise<Xlsx> | undefined;
/** SheetJS is large, so it's only downloaded when an Excel file is actually read or written. */
export const loadXlsx = (): Promise<Xlsx> => (xlsxModule ??= import("xlsx"));

export interface FieldSpecification {
  key: string;
  label: string;
  required: boolean;
  type: string;
  description: string;
  example: string;
}

export interface EntityTemplateConfig {
  entity: ImportEntity;
  title: string;
  singular: string;
  xlsxFilename: string;
  csvFilename: string;
  description: string;
  fields: FieldSpecification[];
  headers: string[];
  sampleRows: string[][];
}

export const TEMPLATE_CONFIGS: Record<ImportEntity, EntityTemplateConfig> = {
  contacts: {
    entity: "contacts",
    title: "Contacts & Leads",
    singular: "Contact",
    xlsxFilename: "Goom-CRM-Contacts-Template.xlsx",
    csvFilename: "Goom-CRM-Contacts-Template.csv",
    description: "Import your customers, sales leads, decision-makers, and key stakeholders.",
    headers: ["first_name", "last_name", "email", "phone", "position", "company", "tags"],
    fields: [
      {
        key: "first_name",
        label: "First Name",
        required: true,
        type: "Text",
        description: "Given name of the contact. Required unless full name is provided.",
        example: "Jane",
      },
      {
        key: "last_name",
        label: "Last Name",
        required: false,
        type: "Text",
        description: "Surname or family name.",
        example: "Smith",
      },
      {
        key: "email",
        label: "Email Address",
        required: false,
        type: "Email",
        description: "Standard email format (e.g., name@company.com). Used for duplicates matching.",
        example: "jane.smith@acme.com",
      },
      {
        key: "phone",
        label: "Phone Number",
        required: false,
        type: "Phone / Text",
        description: "Direct line or mobile number, including optional country code.",
        example: "+1 555 0192",
      },
      {
        key: "position",
        label: "Job Title",
        required: false,
        type: "Text",
        description: "Role or title within their organization.",
        example: "VP of Sales",
      },
      {
        key: "company",
        label: "Company Name",
        required: false,
        type: "Text",
        description: "Associated organization. If not found, Goom CRM creates it automatically.",
        example: "Acme Corporation",
      },
      {
        key: "tags",
        label: "Tags",
        required: false,
        type: "Text (semicolon-separated)",
        description: "Keywords or segments to organize contacts. Separate multiples with ';' or ','.",
        example: "enterprise; decision-maker; vip",
      },
    ],
    sampleRows: [
      ["Jane", "Smith", "jane.smith@acme.com", "+1 555 0192", "VP of Sales", "Acme Corporation", "enterprise; decision-maker; vip"],
      ["Marcus", "Vance", "marcus.v@novatech.io", "+1 555 0843", "Chief Technology Officer", "Nova Technologies", "technical-buyer; q4-lead"],
      ["Sarah", "Jenkins", "s.jenkins@apexretail.com", "+44 20 7946 0122", "Head of Procurement", "Apex Global Retail", "retail; qualified"],
      ["David", "Kim", "dkim@summitlogistics.co", "+1 555 0411", "Director of Operations", "Summit Logistics", "smb; fast-track"],
      ["Elena", "Rostova", "elena@skylineventures.com", "+49 30 1234567", "VP Product", "Skyline Ventures", "inbound; evaluation"],
    ],
  },
  companies: {
    entity: "companies",
    title: "Companies & Accounts",
    singular: "Company",
    xlsxFilename: "Goom-CRM-Companies-Template.xlsx",
    csvFilename: "Goom-CRM-Companies-Template.csv",
    description: "Import your client accounts, corporate prospects, and vendor organizations.",
    headers: ["name", "industry", "website"],
    fields: [
      {
        key: "name",
        label: "Company Name",
        required: true,
        type: "Text",
        description: "Legal or common brand name of the account or company. Required.",
        example: "Acme Corporation",
      },
      {
        key: "industry",
        label: "Industry / Sector",
        required: false,
        type: "Text",
        description: "Market sector (e.g. Software, Finance, Healthcare, Retail, Manufacturing).",
        example: "Cloud Software",
      },
      {
        key: "website",
        label: "Website URL",
        required: false,
        type: "URL / Domain",
        description: "Official web address. Protocol (https://) will be normalized automatically.",
        example: "https://acme.com",
      },
    ],
    sampleRows: [
      ["Acme Corporation", "Cloud Software", "https://acme.com"],
      ["Nova Technologies", "Artificial Intelligence", "https://novatech.io"],
      ["Apex Global Retail", "Retail & E-Commerce", "https://apexretail.com"],
      ["Summit Logistics", "Supply Chain & Logistics", "https://summitlogistics.co"],
      ["Skyline Ventures", "Venture Capital", "https://skylineventures.com"],
    ],
  },
  deals: {
    entity: "deals",
    title: "Deals & Opportunities",
    singular: "Deal",
    xlsxFilename: "Goom-CRM-Deals-Template.xlsx",
    csvFilename: "Goom-CRM-Deals-Template.csv",
    description: "Import active opportunities, contract renewals, and your sales pipeline.",
    headers: ["title", "value", "probability", "close_date", "stage", "company", "contact_email", "notes"],
    fields: [
      {
        key: "title",
        label: "Deal Title",
        required: true,
        type: "Text",
        description: "Name of the commercial opportunity. Required.",
        example: "Enterprise Platform Expansion",
      },
      {
        key: "value",
        label: "Deal Value / Amount",
        required: false,
        type: "Number",
        description: "Monetary amount in your workspace currency (e.g. 45000 or 45k).",
        example: "45000",
      },
      {
        key: "probability",
        label: "Win Probability (%)",
        required: false,
        type: "Number (0-100)",
        description: "Estimated percentage likelihood of winning the deal (between 0 and 100).",
        example: "75",
      },
      {
        key: "close_date",
        label: "Target Close Date",
        required: false,
        type: "Date (YYYY-MM-DD)",
        description: "Projected close date, preferably YYYY-MM-DD (DD/MM/YYYY and MM/DD/YYYY also work). Required for deals in a Won or Lost stage.",
        example: "2026-11-30",
      },
      {
        key: "stage",
        label: "Pipeline Stage",
        required: false,
        type: "Text",
        description: "Stage name from your pipeline (default stages: Prospect, Qualified, Proposal, Negotiation, Won, Lost). Unknown names go to the first stage.",
        example: "Proposal",
      },
      {
        key: "company",
        label: "Company Name",
        required: false,
        type: "Text",
        description: "Organization the deal belongs to. Created automatically if not found.",
        example: "Acme Corporation",
      },
      {
        key: "contact_email",
        label: "Primary Contact Email",
        required: false,
        type: "Email",
        description: "Email of the primary contact person associated with this deal.",
        example: "jane.smith@acme.com",
      },
      {
        key: "notes",
        label: "Notes & Background",
        required: false,
        type: "Text",
        description: "Deal background notes, next steps, or commercial terms.",
        example: "Annual license expansion with multi-team seats",
      },
    ],
    sampleRows: [
      ["Enterprise Platform Expansion", "45000", "75", "2026-11-30", "Proposal", "Acme Corporation", "jane.smith@acme.com", "Annual license expansion with multi-team seats"],
      ["AI Workflow Integration", "28000", "50", "2026-12-15", "Qualified", "Nova Technologies", "marcus.v@novatech.io", "Technical evaluation with engineering team"],
      ["Point-of-Sale System Rollout", "72000", "90", "2026-10-31", "Negotiation", "Apex Global Retail", "s.jenkins@apexretail.com", "Final commercial contract under procurement review"],
      ["Fleet Tracking Implementation", "18500", "40", "2027-01-15", "Qualified", "Summit Logistics", "dkim@summitlogistics.co", "Initial scoping call scheduled for next week"],
      ["Pilot Evaluation License", "9500", "20", "2026-11-15", "Prospect", "Skyline Ventures", "elena@skylineventures.com", "Inbound inquiry from product leadership"],
    ],
  },
};

/**
 * True when an imported row is one of the template's sample rows left in the file (compared through
 * the column mapping). Number and date columns are ignored: Excel may reformat them on save.
 */
export function isTemplateSampleRow(entity: ImportEntity, raw: Record<string, string>, mapping: ColumnMapping): boolean {
  const cfg = TEMPLATE_CONFIGS[entity];
  const textColumns = cfg.headers
    .map((key, i) => ({ key, i }))
    .filter(({ key }) => !/^(Number|Date)/.test(cfg.fields.find((f) => f.key === key)?.type ?? ""));
  return cfg.sampleRows.some((sample) =>
    textColumns.every(({ key, i }) => {
      const h = mapping[key];
      return (h ? (raw[h] ?? "").trim() : "") === sample[i];
    }),
  );
}

/**
 * Creates and downloads a branded Microsoft Excel (.xlsx) template with:
 * 1. "Data Import" worksheet with official headers, formatting, auto-filters, and sample data.
 * 2. "Field Guide & Instructions" worksheet with comprehensive rules, formatting tips, and field definitions.
 */
export async function downloadBrandedExcelTemplate(entity: ImportEntity) {
  const XLSX = await loadXlsx();
  const cfg = TEMPLATE_CONFIGS[entity];
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Data Import (The primary data entry sheet) ---
  const dataAOA: (string | number)[][] = [
    cfg.headers,
    ...cfg.sampleRows,
  ];
  const wsData = XLSX.utils.aoa_to_sheet(dataAOA);

  // Auto-calculate generous column widths
  wsData["!cols"] = cfg.headers.map((h, i) => {
    let maxLen = h.length;
    for (const row of cfg.sampleRows) {
      const cellVal = String(row[i] ?? "");
      if (cellVal.length > maxLen) maxLen = cellVal.length;
    }
    return { wch: Math.max(maxLen + 4, 18) };
  });

  // Enable auto-filter across row 1
  if (cfg.headers.length > 0) {
    const lastColLetter = XLSX.utils.encode_col(cfg.headers.length - 1);
    wsData["!autofilter"] = { ref: `A1:${lastColLetter}${cfg.sampleRows.length + 1}` };
  }

  // --- Sheet 2: Field Guide & Instructions ---
  const guideAOA: (string | number)[][] = [
    ["GOOM CRM — OFFICIAL DATA IMPORT GUIDE"],
    [`Template for ${cfg.title} | Pre-configured for direct import into Goom CRM`],
    [],
    ["HOW TO USE THIS TEMPLATE:"],
    ["1. Open the 'Data Import' worksheet tab (at the bottom of this workbook)."],
    ["2. DO NOT change, rename, or delete the column headers in Row 1."],
    ["3. Replace the sample rows (Row 2 onwards) with your data. Sample rows left in the file are skipped on import."],
    ["4. When finished, save this file (.xlsx) and upload it at: Goom CRM -> Import & Export."],
    ["5. Alternatively, you can also save/export as CSV if desired."],
    [],
    ["FIELD SPECIFICATIONS & FORMAT RULES:"],
    ["Column Header", "Field Name", "Required?", "Data Type", "Description & Allowed Formats", "Sample Value"],
    ...cfg.fields.map((f) => [
      f.key,
      f.label,
      f.required ? "REQUIRED *" : "Optional",
      f.type,
      f.description,
      f.example,
    ]),
    [],
    ["SUPPORT & TIPS:"],
    ["• Duplicates: Existing contacts (same email) and companies (same name) can be skipped; nothing is updated, and deals are always created as new."],
    ["• Dates: Preferred format is YYYY-MM-DD (e.g. 2026-12-31). For DD/MM vs MM/DD dates, one order is used for the whole column."],
    ["• Won/Lost deals: a close date is required; it is recorded as the date the deal was won or lost."],
    ["• Companies & Contacts: Deals automatically link to existing companies or create new ones."],
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet(guideAOA);
  wsGuide["!cols"] = [
    { wch: 22 }, // Column Header
    { wch: 24 }, // Field Name
    { wch: 14 }, // Required?
    { wch: 20 }, // Data Type
    { wch: 65 }, // Description & Rules
    { wch: 32 }, // Sample Value
  ];

  // Append sheets: Data Import first, Guide second
  XLSX.utils.book_append_sheet(wb, wsData, "Data Import");
  XLSX.utils.book_append_sheet(wb, wsGuide, "Field Guide & Instructions");

  // Trigger browser download
  XLSX.writeFile(wb, cfg.xlsxFilename, { bookType: "xlsx" });
}

/**
 * Creates and downloads a branded CSV template with clean headers and curated sample records.
 */
export function downloadBrandedCsvTemplate(entity: ImportEntity) {
  const cfg = TEMPLATE_CONFIGS[entity];
  downloadCsv(cfg.csvFilename, cfg.headers, cfg.sampleRows);
}

/** Rows read past `maxRows` (header, blank rows) before a sheet counts as too long. */
const ROW_SLACK = 1000;

export interface ParsedImportFile {
  headers: string[];
  rows: Record<string, string>[];
  /** The sheet has data past the rows read (only with `maxRows`): treat it as too many rows. */
  truncated: boolean;
}

/** UTF-8 (BOM optional), else Windows-1252 (Excel's plain "CSV" on Windows); UTF-16 with a BOM ("Unicode text"). */
function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** ZIP (xlsx) or OLE (xls) signature, for files without a known extension. */
function looksLikeWorkbook(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer.slice(0, 4));
  return (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) || (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0);
}

/** Without binary floating-point noise, like Excel (15 significant digits). */
const plainNumber = (n: number) => String(Number(n.toPrecision(15)));
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * A cell's underlying value as import text rather than its display text: 251911234567 instead of
 * "2.51911E+11", dates as YYYY-MM-DD whatever their display format, 45000 instead of "ETB 45,000.00"
 * (or a rounded "#,##0"), percentages as "75%", booleans as TRUE/FALSE.
 */
function cellText(XLSX: Xlsx, cell: CellObject | undefined, date1904: boolean): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  if (cell.t === "b") return cell.v ? "TRUE" : "FALSE";
  if (cell.t === "e") return cell.w ?? "";
  if (cell.v instanceof Date) return `${cell.v.getFullYear()}-${pad2(cell.v.getMonth() + 1)}-${pad2(cell.v.getDate())}`;
  if (typeof cell.v !== "number") return String(cell.v);
  const fmt: unknown = typeof cell.z === "number" ? XLSX.SSF.get_table()[cell.z] : cell.z;
  if (typeof fmt !== "string") return plainNumber(cell.v);
  if (XLSX.SSF.is_date(fmt)) {
    const p = cell.v >= 1 || date1904 ? XLSX.SSF.parse_date_code(cell.v, { date1904 }) : null;
    // Time-only values (no date part) keep their display text.
    if (!p) return cell.w ?? plainNumber(cell.v);
    const date = `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
    return p.H || p.M ? `${date} ${pad2(p.H)}:${pad2(p.M)}` : date;
  }
  // A "%" outside quoted/escaped literals means Excel shows the value ×100.
  if (fmt.replace(/"[^"]*"|\\./g, "").includes("%")) return `${plainNumber(cell.v * 100)}%`;
  return plainNumber(cell.v);
}

async function parseWorkbook(buffer: ArrayBuffer, maxRows?: number): Promise<ParsedImportFile> {
  const XLSX = await loadXlsx();
  // cellNF keeps each cell's number format (to spot dates and percentages); sheetRows stops parsing
  // a little past the row cap instead of reading a huge sheet only to reject it.
  const wb = XLSX.read(buffer, { type: "array", cellNF: true, sheetRows: maxRows ? maxRows + ROW_SLACK : 0 });

  if (!wb.SheetNames.length) {
    throw new Error("The Excel workbook does not contain any sheets.");
  }

  // Our template's "Data Import" sheet when present, else the first sheet.
  const targetSheetName = wb.SheetNames.find((name) => name.trim().toLowerCase() === "data import") ?? wb.SheetNames[0];
  const ws: WorkSheet | undefined = wb.Sheets[targetSheetName];
  if (!ws) {
    throw new Error("Unable to read worksheet from Excel workbook.");
  }
  if (!ws["!ref"]) {
    throw new Error("The worksheet is empty.");
  }

  const date1904 = Boolean(wb.Workbook?.WBProps?.date1904);
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const rawData: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) row.push(cellText(XLSX, ws[XLSX.utils.encode_cell({ r, c })], date1904).trim());
    rawData.push(row);
  }
  const hasData = (row: string[]) => row.some((c) => c !== "");
  // Cut off at the cap with data still running near the end of what was read. (A cut-off tail of
  // empty, merely formatted rows doesn't count.)
  const truncated = Boolean(ws["!fullref"]) && rawData.slice(-ROW_SLACK).some(hasData);

  // Find the header row: first non-empty row
  const headerRowIdx = rawData.findIndex(hasData);
  if (headerRowIdx < 0) {
    throw new Error("No column headers found in the Excel file.");
  }

  const rawHeaders = rawData[headerRowIdx];
  const cleanHeaders = rawHeaders.filter((h, idx) => h !== "" && rawHeaders.indexOf(h) === idx);

  if (!cleanHeaders.length) {
    throw new Error("No valid column headers found.");
  }

  const rows: Record<string, string>[] = [];
  for (let r = headerRowIdx + 1; r < rawData.length; r++) {
    const rowArr = rawData[r];
    // Skip completely empty rows
    if (!hasData(rowArr)) continue;

    const rowObj: Record<string, string> = {};
    cleanHeaders.forEach((h) => {
      rowObj[h] = rowArr[rawHeaders.indexOf(h)] ?? "";
    });
    rows.push(rowObj);
  }

  return { headers: cleanHeaders, rows, truncated };
}

/**
 * Universal file parser: reads either .xlsx / .xls or .csv (also .tsv / .txt) files and outputs
 * structured headers and row objects ready for Goom CRM import validation. With `maxRows`, Excel
 * sheets are only parsed a little past that many rows (see `truncated`).
 */
export async function parseImportSpreadsheet(file: File, options: { maxRows?: number } = {}): Promise<ParsedImportFile> {
  const buffer = await file.arrayBuffer();
  // Route by extension, not MIME type: Windows reports .csv files as application/vnd.ms-excel, and
  // SheetJS would then decode UTF-8 text as Latin-1. Files without a known extension are sniffed.
  const isWorkbook = /\.(xlsx|xls)$/i.test(file.name) || (!/\.(csv|tsv|txt)$/i.test(file.name) && looksLikeWorkbook(buffer));
  if (isWorkbook) return parseWorkbook(buffer, options.maxRows);
  return { ...parseCsvObjects(decodeText(buffer)), truncated: false };
}

/**
 * Exports data to a formatted Microsoft Excel (.xlsx) workbook.
 */
export async function exportToExcel(filename: string, sheetName: string, headers: string[], rows: unknown[][]) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Auto-width
  ws["!cols"] = headers.map((h, i) => {
    let maxLen = h.length;
    for (const r of rows) {
      const v = String(r[i] ?? "");
      if (v.length > maxLen) maxLen = Math.min(v.length, 50);
    }
    return { wch: Math.max(maxLen + 4, 16) };
  });

  if (headers.length > 0) {
    const lastCol = XLSX.utils.encode_col(headers.length - 1);
    ws["!autofilter"] = { ref: `A1:${lastCol}${rows.length + 1}` };
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename, { bookType: "xlsx" });
}
