import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvObjects, toCsv } from "@/lib/csv";
import { fetchAllRows } from "@/lib/fetchAll";
import { ilikeAny } from "@/lib/postgrest";
import { sanitizeHref, renderMarkdown } from "@/lib/sanitize";

describe("parseCsv", () => {
  it("handles quoted commas, escaped quotes, newlines, CRLF and BOM", () => {
    const text = '\ufeffname,notes\r\n"Acme, Inc.","He said ""hi""\nline 2"\r\nBeta,plain\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["name", "notes"],
      ["Acme, Inc.", 'He said "hi"\nline 2'],
      ["Beta", "plain"],
    ]);
  });

  it("maps rows to header keys and fills missing cells", () => {
    const { headers, rows } = parseCsvObjects(" First , Email \nAda\n");
    expect(headers).toEqual(["First", "Email"]);
    expect(rows).toEqual([{ First: "Ada", Email: "" }]);
  });

  it("round-trips through toCsv and neutralizes formulas", () => {
    const csv = toCsv(["a", "b"], [["x,y", '=SUM(A1)'], [null, ["t1", "t2"]]]);
    expect(parseCsv(csv)).toEqual([["a", "b"], ["x,y", "'=SUM(A1)"], ["", "t1; t2"]]);
  });

  it("uses an explicit delimiter and reports unclosed quotes", () => {
    expect(parseCsv("a|b\n1|2", "|")).toEqual([["a", "b"], ["1", "2"]]);
    expect(() => parseCsv('a,b\n1,2\n3,"x\n')).toThrow(/Line 3.*never closed/);
  });
});

describe("fetchAllRows", () => {
  const source = Array.from({ length: 7 }, (_, i) => i);

  it("keeps paging when the server caps pages below pageSize", async () => {
    const calls: number[] = [];
    // Server max_rows of 2 while we ask for 5 per page.
    const rows = await fetchAllRows<number>(async (from, to) => {
      calls.push(from);
      return { data: source.slice(from, Math.min(to + 1, from + 2)), error: null };
    }, { pageSize: 5 });
    expect(rows).toEqual(source);
    expect(calls).toEqual([0, 2, 4, 6, 7]);
  });

  it("stops at the known total and honours an abort signal", async () => {
    const calls: number[] = [];
    const rows = await fetchAllRows<number>(async (from, to) => {
      calls.push(from);
      return { data: source.slice(from, to + 1), error: null, count: from === 0 ? source.length : null };
    }, { pageSize: 4 });
    expect(rows).toEqual(source);
    expect(calls).toEqual([0, 4]);

    const build = async (from: number) => ({ data: source.slice(from), error: null });
    await expect(fetchAllRows<number>(build, { signal: new AbortController().signal })).resolves.toEqual(source);
    const controller = new AbortController();
    controller.abort();
    await expect(fetchAllRows<number>(build, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    await expect(fetchAllRows<number>(build, undefined, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("ilikeAny", () => {
  it("returns null for blank input", () => {
    expect(ilikeAny(["a"], "   ")).toBeNull();
  });
  it("quotes input so commas and parens cannot inject filters", () => {
    expect(ilikeAny(["first_name", "email"], "a,b)")).toBe(
      'first_name.ilike."%a,b)%",email.ilike."%a,b)%"',
    );
  });
  it("escapes wildcards and quotes", () => {
    // Wildcards become \% and \_ for ilike; then \ and " are backslash-escaped inside the quoted value.
    expect(ilikeAny(["n"], '50%_"x')).toBe(String.raw`n.ilike."%50\\%\\_\"x%"`);
  });
});

describe("sanitizeHref", () => {
  it.each(["javascript:alert(1)", "java\tscript:alert(1)", " JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x"])(
    "blocks %s",
    (href) => expect(sanitizeHref(href)).toBe("#"),
  );
  it("allows safe links", () => {
    expect(sanitizeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(sanitizeHref("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(sanitizeHref("/pipeline")).toBe("/pipeline");
    expect(sanitizeHref("example.com")).toBe("https://example.com");
  });
  it.each(["/\\evil.com", "/\\/evil.com", "//evil.com", "/ /evil.com", "/pipeline\\..\\x"])("blocks off-site rooted path %s", (href) => {
    // Browsers treat "\" as "/", so these would be protocol-relative links to another host.
    expect(sanitizeHref(href)).toBe("#");
  });
});

describe("renderMarkdown", () => {
  it("escapes HTML and neutralizes script links", () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)> [x](javascript:alert(1)) [y](https://a.co/?q="><b>)');
    expect(html).not.toContain("<img");
    expect(html).toContain('href="#"');
    expect(html).not.toMatch(/href="[^"]*"><b>/);
  });
  it("renders bold, italic and lists", () => {
    expect(renderMarkdown("**b** *i*\n- one\n- two")).toContain("<strong>b</strong> <em>i</em>");
  });
});

describe("renderMarkdown lists", () => {
  it("does not put <br> between or after list items", () => {
    expect(renderMarkdown("Intro\n- a\n- b\nAfter")).toBe(
      'Intro<br /><ul class="list-disc pl-4 space-y-1"><li>a</li><li>b</li></ul>After',
    );
  });
});

describe("classifyContextError", () => {
  it("detects a database missing the workspace schema", async () => {
    const { classifyContextError } = await import("@/contexts/AuthContext");
    expect(classifyContextError({ code: "PGRST202", message: "Could not find the function public.get_my_context" })).toBe("schema_outdated");
    expect(classifyContextError({ code: "PGRST205", message: "Could not find the table" })).toBe("schema_outdated");
    expect(classifyContextError({ message: "TypeError: Failed to fetch" })).toBe("network");
    expect(classifyContextError(null)).toBe("no_workspace");
    expect(classifyContextError({ code: "XX000", message: "boom" })).toBe("other");
  });
});
