/**
 * RFC 4180 CSV parsing and serialization.
 *
 * Handles quoted fields containing delimiters, quotes ("") and newlines, CRLF/LF/CR line endings,
 * a UTF-8 BOM, trailing blank lines, and the delimiters Excel uses across locales (`,` `;` tab `|`,
 * detected from the header or taken from an Excel "sep=;" first line). A quote only opens a quoted
 * field at the start of a field, so stray quotes inside values (5'10") are kept as text.
 */
const DELIMITERS = [",", ";", "\t", "|"];

/**
 * Picks the delimiter that splits the header line into the most columns (outside quotes); ties go
 * to the one whose count holds steady over the next few lines, then to the comma.
 */
export function detectDelimiter(text: string): string {
  const lines: Record<string, number>[] = [];
  let counts: Record<string, number> = {};
  let content = false;
  let inQuotes = false;
  for (let i = 0; i < text.length && lines.length < 6; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') i++;
        else inQuotes = false;
      }
    } else if (ch === '"' && (i === 0 || DELIMITERS.includes(text[i - 1]) || text[i - 1] === "\n" || text[i - 1] === "\r")) {
      inQuotes = true;
      content = true;
    } else if (ch === "\n" || ch === "\r") {
      if (content) lines.push(counts);
      counts = {};
      content = false;
    } else {
      if (DELIMITERS.includes(ch)) counts[ch] = (counts[ch] ?? 0) + 1;
      if (ch.trim()) content = true;
    }
  }
  if (content && lines.length < 6) lines.push(counts);
  const [header, ...rest] = lines;
  if (!header) return ",";
  let best = ",";
  let bestScore = 0;
  for (const d of DELIMITERS) {
    const n = header[d] ?? 0;
    if (!n) continue;
    const score = n * 100 + rest.filter((l) => (l[d] ?? 0) === n).length;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

export function parseCsv(text: string, delimiter?: string): string[][] {
  let src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let delim = delimiter;
  // Excel writes "sep=;" as the first line when it saves with a non-default list separator.
  const sep = /^sep=(.)[^\S\r\n]*(?:\r\n|\n|\r|$)/i.exec(src);
  if (sep) {
    delim ??= sep[1];
    src = src.slice(sep[0].length);
  }
  delim ??= detectDelimiter(src);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldQuoted = false;
  let line = 1;
  let quoteLine = 0;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n" || (ch === "\r" && src[i + 1] !== "\n")) line++;
        field += ch;
      }
    } else if (ch === '"' && !fieldQuoted && field.trim() === "") {
      // Opening quote (leading spaces before it are dropped).
      inQuotes = true;
      fieldQuoted = true;
      field = "";
      quoteLine = line;
    } else if (ch === delim) {
      row.push(field);
      field = "";
      fieldQuoted = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      fieldQuoted = false;
      line++;
    } else {
      field += ch;
    }
  }
  if (inQuotes) {
    throw new Error(`Line ${quoteLine} opens a quote (") that is never closed. Check that row for a stray quote character.`);
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Parses CSV with a header row into objects keyed by trimmed header names. */
export function parseCsvObjects(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const [header = [], ...body] = parseCsv(text);
  const headers = header.map((h) => h.trim());
  const rows = body.map((cells) =>
    Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()])),
  );
  return { headers, rows };
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = Array.isArray(value) ? value.join("; ") : String(value);
  // Neutralize spreadsheet formula injection (=, +, -, @ at the start of a cell).
  // Imports undo this prefix (see stripFormulaGuard in dataTransfer.ts).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(escapeCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const blob = new Blob(["﻿" + toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
