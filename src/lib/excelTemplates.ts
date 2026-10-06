import * as XLSX from "xlsx";
import { downloadCsv } from "@/lib/csv";
import type { ImportEntity } from "@/lib/dataTransfer";

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
        description: "Projected close date in standard format (YYYY-MM-DD or MM/DD/YYYY).",
        example: "2026-11-30",
      },
      {
        key: "stage",
        label: "Pipeline Stage",
        required: false,
        type: "Text",
        description: "Stage name matching your pipeline (e.g. Lead In, Proposal Sent, Closed Won).",
        example: "Proposal Sent",
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
      ["Enterprise Platform Expansion", "45000", "75", "2026-11-30", "Proposal Sent", "Acme Corporation", "jane.smith@acme.com", "Annual license expansion with multi-team seats"],
      ["AI Workflow Integration", "28000", "50", "2026-12-15", "Meeting Scheduled", "Nova Technologies", "marcus.v@novatech.io", "Technical evaluation with engineering team"],
      ["Point-of-Sale System Rollout", "72000", "90", "2026-10-31", "Qualified", "Apex Global Retail", "s.jenkins@apexretail.com", "Final commercial contract under procurement review"],
      ["Fleet Tracking Implementation", "18500", "40", "2027-01-15", "Contact Made", "Summit Logistics", "dkim@summitlogistics.co", "Initial scoping call scheduled for next week"],
      ["Pilot Evaluation License", "9500", "85", "2026-11-15", "Lead In", "Skyline Ventures", "elena@skylineventures.com", "Inbound inquiry from product leadership"],
    ],
  },
};

/**
 * Creates and downloads a branded Microsoft Excel (.xlsx) template with:
 * 1. "Data Import" worksheet with official headers, formatting, auto-filters, and sample data.
 * 2. "Field Guide & Instructions" worksheet with comprehensive rules, formatting tips, and field definitions.
 */
export function downloadBrandedExcelTemplate(entity: ImportEntity) {
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
    ["3. Replace the sample rows (Row 2 onwards) with your real data, or paste underneath."],
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
    ["• Multi-tenancy & Duplicates: Duplicate emails or names will be updated or matched safely."],
    ["• Dates: Preferred format is YYYY-MM-DD (e.g. 2026-12-31). ISO and standard dates are supported."],
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

/**
 * Universal file parser: reads either .xlsx / .xls or .csv files and outputs
 * structured headers and row objects ready for Goom CRM import validation.
 */
export async function parseImportSpreadsheet(
  file: File,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const isExcel = /\.(xlsx|xls)$/i.test(file.name) ||
    file.type.includes("spreadsheet") ||
    file.type.includes("excel");

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });

    if (!wb.SheetNames.length) {
      throw new Error("The Excel workbook does not contain any sheets.");
    }

    // Prefer sheet named "Data Import", "Data", "Template", or fall back to the first sheet
    const targetSheetName =
      wb.SheetNames.find((name) => {
        const lower = name.toLowerCase();
        return lower.includes("data import") || lower.includes("data") || lower.includes("template");
      }) || wb.SheetNames[0];

    const ws = wb.Sheets[targetSheetName];
    if (!ws) {
      throw new Error("Unable to read worksheet from Excel workbook.");
    }

    // Convert worksheet to raw array of rows
    const rawData = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
      raw: false,
    });

    if (!rawData || rawData.length === 0) {
      throw new Error("The worksheet is empty.");
    }

    // Find the header row: first non-empty row
    let headerRowIdx = 0;
    while (
      headerRowIdx < rawData.length &&
      (!Array.isArray(rawData[headerRowIdx]) ||
        (rawData[headerRowIdx] as unknown[]).every((c) => String(c ?? "").trim() === ""))
    ) {
      headerRowIdx++;
    }

    if (headerRowIdx >= rawData.length) {
      throw new Error("No column headers found in the Excel file.");
    }

    const rawHeaders = (rawData[headerRowIdx] as unknown[]).map((c) => String(c ?? "").trim());
    const cleanHeaders = rawHeaders.filter((h, idx) => h !== "" && rawHeaders.indexOf(h) === idx);

    if (!cleanHeaders.length) {
      throw new Error("No valid column headers found.");
    }

    const rows: Record<string, string>[] = [];
    for (let r = headerRowIdx + 1; r < rawData.length; r++) {
      const rowArr = (rawData[r] as unknown[]) ?? [];
      // Skip completely empty rows
      if (!rowArr.some((c) => String(c ?? "").trim() !== "")) continue;

      const rowObj: Record<string, string> = {};
      cleanHeaders.forEach((h) => {
        const colIdx = rawHeaders.indexOf(h);
        const val = colIdx >= 0 && colIdx < rowArr.length ? String(rowArr[colIdx] ?? "").trim() : "";
        rowObj[h] = val;
      });
      rows.push(rowObj);
    }

    return { headers: cleanHeaders, rows };
  } else {
    // CSV file
    const text = await file.text();
    const { parseCsvObjects } = await import("@/lib/csv");
    return parseCsvObjects(text);
  }
}

/**
 * Exports data to a formatted Microsoft Excel (.xlsx) workbook.
 */
export function exportToExcel(filename: string, sheetName: string, headers: string[], rows: unknown[][]) {
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

