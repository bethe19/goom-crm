import { describe, it, expect } from "vitest";
import {
  backupFilename,
  errorMessage,
  initials,
  inviteLink,
  moveItem,
  passwordChecks,
  passwordSchema,
} from "@/components/settings/validation";

describe("passwordSchema", () => {
  it("requires 8+ chars with a letter and a digit", () => {
    expect(passwordSchema.safeParse("abc12345").success).toBe(true);
    expect(passwordSchema.safeParse("abc1234").success).toBe(false);
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
  });

  it("reports each rule for the live checklist", () => {
    expect(passwordChecks("ab1").map((c) => c.ok)).toEqual([false, true, true]);
  });
});

describe("errorMessage", () => {
  it("shows messages raised by our own database functions", () => {
    expect(errorMessage({ code: "P0001", message: "You can't remove the last admin" })).toBe("You can't remove the last admin");
  });

  it("sanitizes everything else", () => {
    expect(errorMessage({ code: "23505", message: 'duplicate key value violates unique constraint "x"' })).toBe(
      "This record already exists.",
    );
    expect(errorMessage(new Error("relation public.secret does not exist"))).toBe("Something went wrong. Please try again.");
    expect(errorMessage({ code: "42501", message: "new row violates policy" })).toMatch(/permission/);
  });

  it("maps known Supabase Auth error codes before sanitizing", () => {
    const auth = (code: string, message = "raw auth message", extra: Record<string, unknown> = {}) =>
      errorMessage({ name: "AuthApiError", status: 422, code, message, ...extra });
    expect(auth("email_exists")).toBe("An account with this email already exists.");
    expect(auth("user_already_exists")).toMatch(/already exists.*signing in/);
    expect(auth("email_address_invalid")).toMatch(/email address can't be used/);
    expect(auth("same_password")).toMatch(/different from your current/);
    expect(auth("weak_password")).toMatch(/too weak/);
    expect(auth("weak_password", "Password is known to be weak", { reasons: ["pwned"] })).toMatch(/data breach/);
    expect(auth("over_email_send_rate_limit")).toMatch(/Too many emails/);
    expect(auth("over_request_rate_limit")).toMatch(/Too many requests/);
    expect(auth("invalid_credentials")).toBe("Invalid email or password.");
    expect(auth("email_not_confirmed")).toMatch(/confirm your email/);
    expect(auth("reauthentication_needed")).toMatch(/confirm it's you/);
    // Unknown codes still go through the sanitizer.
    expect(auth("unexpected_failure", "pq: relation auth.users does not exist")).toBe("Something went wrong. Please try again.");
    // Object.prototype keys are not codes.
    expect(errorMessage({ code: "constructor", message: "x" })).toBe("Something went wrong. Please try again.");
  });
});

describe("helpers", () => {
  it("builds invite links", () => {
    expect(inviteLink("abc", "https://app.example.com/")).toBe("https://app.example.com/invite/abc");
  });

  it("builds backup filenames", () => {
    expect(backupFilename("Acme Sales & Co.", new Date(2026, 0, 5))).toBe("goom-backup-acme-sales-co-2026-01-05.json");
    expect(backupFilename("", new Date(2026, 11, 31))).toBe("goom-backup-workspace-2026-12-31.json");
  });

  it("computes initials", () => {
    expect(initials("Ada Byron Lovelace")).toBe("AL");
    expect(initials(null, "zed@example.com")).toBe("ZE");
  });

  it("moves list items", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});
