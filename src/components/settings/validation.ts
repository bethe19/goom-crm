import { z } from "zod";
import type { AppRole } from "@/contexts/AuthContext";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";

/** Password rules for new passwords (sign up, reset, change): 8–128 chars with letters and digits. */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use 128 characters or fewer")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const emailSchema = z.string().trim().min(1, "Email is required").email("Enter a valid email address").max(255);

export const fullNameSchema = z.string().trim().min(1, "Name is required").max(100, "Keep it under 100 characters");

/** Checks each password rule separately so the UI can show a live checklist. */
export function passwordChecks(password: string) {
  return [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "A letter", ok: /[A-Za-z]/.test(password) },
    { label: "A number", ok: /\d/.test(password) },
  ];
}

const BREACHED_PASSWORD_MESSAGE = "This password has appeared in a data breach. Please choose a different one.";

/** Supabase Auth error codes (AuthApiError.code) → user-facing text. */
const AUTH_ERROR_MESSAGES = new Map<string, string>([
  ["email_exists", "An account with this email already exists."],
  ["user_already_exists", "An account with this email already exists. Try signing in instead."],
  ["email_address_invalid", "That email address can't be used. Check it for typos or try a different one."],
  ["same_password", "Your new password must be different from your current one."],
  ["weak_password", "That password is too weak. Use at least 8 characters with letters and numbers."],
  ["over_email_send_rate_limit", "Too many emails have been sent to this address. Wait a few minutes and try again."],
  ["over_request_rate_limit", "Too many requests. Wait a moment and try again."],
  ["invalid_credentials", "Invalid email or password."],
  ["email_not_confirmed", "Please confirm your email first — check your inbox for the confirmation link."],
  ["reauthentication_needed", "For your security, confirm it's you again before making this change."],
  ["captcha_failed", "The security check didn't pass or has expired. Complete it again and retry."],
]);

/**
 * User-facing text for an error from Supabase (auth, PostgREST, RPC or edge function).
 * Known Supabase Auth error codes get a specific message. Messages raised deliberately by our own
 * database functions (`RAISE EXCEPTION` → SQLSTATE P0001), e.g. "You can't remove the last admin",
 * are written for users and shown as-is; everything else goes through `sanitizeErrorMessage` so
 * internals never leak.
 */
export function errorMessage(err: unknown): string {
  if (!err) return sanitizeErrorMessage(undefined);
  if (typeof err === "string") return sanitizeErrorMessage(err);
  const e = err as { message?: unknown; code?: unknown; reasons?: unknown };
  const message = typeof e.message === "string" ? e.message : undefined;
  const authMessage = typeof e.code === "string" ? AUTH_ERROR_MESSAGES.get(e.code) : undefined;
  if (authMessage) {
    // AuthWeakPasswordError lists why: "pwned" means the password is in a known breach.
    if (e.code === "weak_password" && Array.isArray(e.reasons) && e.reasons.includes("pwned")) return BREACHED_PASSWORD_MESSAGE;
    return authMessage;
  }
  if (e.code === "P0001" && message && message.length <= 240) return message;
  if (e.code === "42501" || isPermissionError(err)) return PERMISSION_DENIED_MESSAGE;
  // `.single()` after an update that RLS filtered out (or a record deleted meanwhile).
  if (e.code === "PGRST116") return "This record no longer exists, or your role doesn't allow changing it.";
  return sanitizeErrorMessage(message);
}

export const PERMISSION_DENIED_MESSAGE = "You don't have permission to do this. Ask a workspace admin if you need access.";

/**
 * Thrown when a write matched no rows because RLS hid them (e.g. a rep deleting someone else's
 * record): PostgREST reports success with count 0, so we surface it as a permission error.
 */
export class PermissionDeniedError extends Error {
  readonly code = "42501";
  constructor(message = PERMISSION_DENIED_MESSAGE) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

/** Throws PermissionDeniedError when a single-row delete/update affected nothing. */
export function assertAffected(count: number | null | undefined): void {
  if (count === 0) throw new PermissionDeniedError();
}

/** True for RLS / privilege failures (42501, "row-level security", "permission denied"). */
export function isPermissionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: unknown; code?: unknown };
  if (e.code === "42501") return true;
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  return msg.includes("row-level security") || msg.includes("permission denied");
}

/** True for our own plan-limit errors (P0001 "Your Starter plan includes …"). */
export function isPlanLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: unknown; code?: unknown };
  return e.code === "P0001" && typeof e.message === "string" && /\bplan\b/i.test(e.message) && /upgrade/i.test(e.message);
}

/** Public link an invitee opens to join the workspace. */
export function inviteLink(token: string, origin: string = window.location.origin): string {
  return `${origin.replace(/\/+$/, "")}/invite/${encodeURIComponent(token)}`;
}

export const ROLE_OPTIONS: { value: AppRole; label: string; description: string }[] = (["admin", "manager", "rep"] as const).map(
  (value) => ({ value, label: ROLE_LABELS[value], description: ROLE_DESCRIPTIONS[value].replace(/\.$/, "") }),
);

/** Roles the current user may invite: admins any role, managers reps only (mirrors create_invitation). */
export function invitableRoles(canInviteAnyRole: boolean): typeof ROLE_OPTIONS {
  return canInviteAnyRole ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r.value === "rep");
}

export function roleLabel(role: string | null | undefined): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? "Member";
}

export const CURRENCIES: { code: string; label: string }[] = [
  { code: "USD", label: "US dollar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British pound" },
  { code: "CAD", label: "Canadian dollar" },
  { code: "AUD", label: "Australian dollar" },
  { code: "NZD", label: "New Zealand dollar" },
  { code: "CHF", label: "Swiss franc" },
  { code: "SEK", label: "Swedish krona" },
  { code: "NOK", label: "Norwegian krone" },
  { code: "DKK", label: "Danish krone" },
  { code: "PLN", label: "Polish złoty" },
  { code: "JPY", label: "Japanese yen" },
  { code: "CNY", label: "Chinese yuan" },
  { code: "INR", label: "Indian rupee" },
  { code: "SGD", label: "Singapore dollar" },
  { code: "HKD", label: "Hong Kong dollar" },
  { code: "AED", label: "UAE dirham" },
  { code: "SAR", label: "Saudi riyal" },
  { code: "ZAR", label: "South African rand" },
  { code: "NGN", label: "Nigerian naira" },
  { code: "KES", label: "Kenyan shilling" },
  { code: "ETB", label: "Ethiopian birr" },
  { code: "EGP", label: "Egyptian pound" },
  { code: "BRL", label: "Brazilian real" },
  { code: "MXN", label: "Mexican peso" },
];

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Nairobi",
  "Africa/Addis_Ababa",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

/** All IANA time zones the browser knows (falls back to a short list on old browsers). */
export function listTimezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    const zones = intl.supportedValuesOf?.("timeZone");
    if (zones?.length) return zones.includes("UTC") ? zones : ["UTC", ...zones];
  } catch {
    // ignore
  }
  return FALLBACK_TIMEZONES;
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Initials for avatar fallbacks: "Ada Lovelace" → "AL", "ada@x.io" → "AD". */
export function initials(name: string | null | undefined, email?: string | null): string {
  const source = (name ?? "").trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
    return letters.toUpperCase();
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}

/** Moves an item in a list (used for stage reordering). Returns a new array. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list.slice();
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** `goom-backup-<workspace-slug>-<yyyy-mm-dd>.json` */
export function backupFilename(workspace: string | null | undefined, date: Date = new Date()): string {
  const slug =
    (workspace ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `goom-backup-${slug}-${y}-${m}-${d}.json`;
}
