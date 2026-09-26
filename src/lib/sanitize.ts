/**
 * Maps raw auth/db error messages to safe, user-facing messages.
 */
export function sanitizeErrorMessage(raw: string | undefined | null): string {
  const lower = (raw ?? "").toLowerCase();
  if (lower.includes("invalid login credentials")) return "Invalid email or password.";
  if (lower.includes("email not confirmed")) return "Please confirm your email first — check your inbox for the confirmation link.";
  if (lower.includes("user already registered")) return "An account with this email already exists. Try signing in instead.";
  if (lower.includes("password") && lower.includes("leak")) return "This password has appeared in a data breach. Please choose a different one.";
  if (lower.includes("password") && (lower.includes("at least") || lower.includes("short") || lower.includes("weak"))) return "Password is too weak. Use at least 8 characters with letters and numbers.";
  if (lower.includes("rate limit") || lower.includes("too many")) return "Too many attempts. Please wait a moment and try again.";
  if (lower.includes("row-level security") || lower.includes("permission denied")) return "You don't have permission to perform this action.";
  if (lower.includes("duplicate key")) return "This record already exists.";
  if (lower.includes("foreign key") || lower.includes("violates restrict")) return "This record is still in use by other records.";
  if (lower.includes("network") || lower.includes("failed to fetch")) return "Network error. Please check your connection.";
  return "Something went wrong. Please try again.";
}

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Returns the URL only if it uses an allowlisted protocol (http, https, mailto, tel) or is a
 * relative path; otherwise "#". Control characters and whitespace are stripped first, because
 * browsers ignore them (so `java\tscript:` would otherwise slip past a naive check).
 */
export function sanitizeHref(href: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = href.replace(/[\u0000-\u001F\u007F\s]+/g, "");
  if (!cleaned) return "#";
  if (/^(\/(?!\/)|#|\?)/.test(cleaned)) return cleaned;
  try {
    const url = new URL(cleaned);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : "#";
  } catch {
    // Not absolute and not a rooted path: treat bare domains ("example.com") as https.
    return /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(cleaned) ? `https://${cleaned}` : "#";
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renders the small markdown subset used in notes (**bold**, *italic*, [links](url), - lists)
 * to HTML. All input is HTML-escaped before any tags are added and link targets go through
 * sanitizeHref, so the output is safe for dangerouslySetInnerHTML.
 */
export function renderMarkdown(md: string): string {
  let html = escapeHtml(md);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, (_, text: string, href: string) => {
    // href was HTML-escaped above; unescape entities before validating, then re-escape.
    const raw = href.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const safe = escapeHtml(sanitizeHref(raw));
    return `<a href="${safe}" class="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul class="list-disc pl-4 space-y-1">${m.replace(/\n/g, "")}</ul>\n`);
  html = html.replace(/<\/ul>\n/g, "</ul>").replace(/\n/g, "<br />");
  return html;
}
