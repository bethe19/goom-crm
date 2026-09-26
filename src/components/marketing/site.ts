/**
 * Public-site facts in one place.
 * OWNER TODO: every value marked PLACEHOLDER must be confirmed or replaced before launch —
 * nothing here has been verified (mailboxes may not exist, the legal entity is unconfirmed).
 */
export const SITE = {
  name: "Goom",
  /** PLACEHOLDER — the registered legal name of the company operating the service. */
  legalEntity: "Goom Inc.",
  /** PLACEHOLDER mailboxes — make sure each one exists and is monitored. */
  salesEmail: "sales@goom.com",
  supportEmail: "support@goom.com",
  legalEmail: "legal@goom.com",
  privacyEmail: "privacy@goom.com",
  /** PLACEHOLDER — date the Terms/Privacy text was last reviewed. */
  legalLastUpdated: "September 18, 2026",
} as const;

export const SIGNUP_PATH = "/auth?mode=signup";

/** Signup link that carries the chosen plan (`?plan=`) through to the Auth page. */
export function signupPathFor(plan: string): string {
  return `${SIGNUP_PATH}&plan=${encodeURIComponent(plan)}`;
}
export const LOGIN_PATH = "/auth";

export const NAV_LINKS = [
  { to: "/product", label: "Product" },
  { to: "/solutions", label: "Solutions" },
  { to: "/customers", label: "Use cases" },
  { to: "/pricing", label: "Pricing" },
  { to: "/contact", label: "Contact" },
] as const;
