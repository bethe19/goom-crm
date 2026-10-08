// send-invite: emails a workspace invitation link (optional; the UI always shows a copyable link).
//
// Request  (POST, Authorization: Bearer <user access token>): { invitation_id: uuid }
// Response: 200 { sent: true }                     email accepted by the provider
//           200 { sent: false, reason: string }    no email provider configured / provider failed
//           { error } with 400, 401, 403, 404, 405, 409 (already accepted), 410 (expired),
//           413 (body too large), 429 (send throttle; Retry-After header)
//
// Secrets: RESEND_API_KEY + INVITE_FROM_EMAIL (e.g. "Acme CRM <invites@yourdomain.com>", a
// domain verified in Resend) and SITE_URL (public app URL, e.g. https://app.example.com).
import { errorResponse, json, readJsonBody, serveWithCors } from "../_shared/cors.ts";
import { adminClient, getCaller } from "../_shared/supabase.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Strips control/bidi/zero-width characters and caps length: these labels are user-controlled. */
function cleanLabel(value: string, max: number): string {
  const s = value
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const THROTTLE_MESSAGES: Record<string, string> = {
  invite_max: "This invitation has already been emailed several times. Share the link instead.",
  invite_cooldown: "This invitation was emailed a few minutes ago. Share the link, or try again later.",
  org_daily: "Your workspace has sent its invitation emails for today. Share the links instead, or try again tomorrow.",
  user_hourly: "You've sent a lot of invitation emails recently. Share the links instead, or try again later.",
};

function siteUrl(): string | null {
  const raw = (Deno.env.get("SITE_URL") ?? "").trim().replace(/\/+$/, "");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") return raw;
  } catch {
    // fall through
  }
  return null;
}

function renderEmail(opts: { workspace: string; inviter: string; role: string; link: string; expires: string }) {
  const workspace = escapeHtml(opts.workspace);
  const inviter = escapeHtml(opts.inviter);
  const role = escapeHtml(opts.role);
  const link = escapeHtml(opts.link);
  const expires = escapeHtml(opts.expires);

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f6f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b19;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e7e5e0;border-radius:12px;">
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 8px;font-size:13px;color:#6b6862;">Workspace invitation</p>
                <h1 style="margin:0 0 16px;font-size:20px;line-height:28px;font-weight:600;">Join ${workspace}</h1>
                <p style="margin:0 0 24px;font-size:14px;line-height:22px;">
                  ${inviter} invited you to join <strong>${workspace}</strong> as a <strong>${role}</strong>.
                </p>
                <a href="${link}" style="display:inline-block;background:#1c1b19;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Accept invitation</a>
                <p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#6b6862;">
                  This link expires on ${expires}. If the button doesn't work, paste this address into your browser:<br />
                  <span style="word-break:break-all;">${link}</span>
                </p>
                <p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#6b6862;">
                  If you weren't expecting this invitation, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${opts.inviter} invited you to join ${opts.workspace} as a ${opts.role}.`,
    "",
    `Accept the invitation: ${opts.link}`,
    "",
    `This link expires on ${opts.expires}. If you weren't expecting this invitation, you can ignore this email.`,
  ].join("\n");

  return { html, text };
}

serveWithCors(async (req) => {
  if (req.method !== "POST") return errorResponse(req, 405, "Method not allowed.");

  const caller = await getCaller(req);
  if (!caller.user) {
    return errorResponse(req, caller.status, caller.status === 401 ? "Sign in to send invitations." : "Invitations are temporarily unavailable.");
  }
  const user = caller.user;

  const parsed = await readJsonBody(req, 4 * 1024);
  if (!parsed.ok) return errorResponse(req, parsed.status, parsed.message);
  const body = parsed.value as { invitation_id?: unknown } | null;
  const invitationId = typeof body?.invitation_id === "string" ? body.invitation_id.trim() : "";
  if (!UUID_RE.test(invitationId)) return errorResponse(req, 400, "invitation_id must be a UUID.");

  let admin;
  try {
    admin = adminClient();
  } catch (err) {
    console.error("send-invite:", err instanceof Error ? err.message : err);
    return errorResponse(req, 500, "Invitations are temporarily unavailable.");
  }

  const { data: invitation, error: invError } = await admin
    .from("invitations")
    .select("id, organization_id, email, role, token, invited_by, expires_at, accepted_at, organizations(name, status, trial_ends_at, paid_until)")
    .eq("id", invitationId)
    .maybeSingle();
  if (invError) {
    console.error("send-invite: lookup failed", invError.message);
    return errorResponse(req, 500, "Invitations are temporarily unavailable.");
  }
  if (!invitation) return errorResponse(req, 404, "Invitation not found.");

  // Only admins/managers of the invitation's workspace may send it; managers only for reps
  // (mirrors create_invitation).
  const { data: membership, error: memberError } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", invitation.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberError) {
    console.error("send-invite: membership lookup failed", memberError.message);
    return errorResponse(req, 500, "Invitations are temporarily unavailable.");
  }
  if (!membership || (membership.role !== "admin" && membership.role !== "manager")) {
    return errorResponse(req, 403, "Only workspace admins and managers can send invitations.");
  }
  if (membership.role === "manager" && invitation.role !== "rep") {
    return errorResponse(req, 403, "Managers can only send invitations for sales reps.");
  }

  type OrgRow = { name?: string; status?: string; trial_ends_at?: string | null; paid_until?: string | null };
  const orgRaw = invitation.organizations as unknown as OrgRow | OrgRow[] | null;
  const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
  if (org?.status !== "active") return errorResponse(req, 403, "This workspace is suspended. Contact support.");
  const now = Date.now();
  const billingOk = (org.paid_until && Date.parse(org.paid_until) > now) || (org.trial_ends_at && Date.parse(org.trial_ends_at) > now);
  if (!billingOk) return errorResponse(req, 403, "This workspace's trial or subscription has ended. Choose a plan to invite teammates.");

  if (invitation.accepted_at) return errorResponse(req, 409, "This invitation has already been accepted.");
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return errorResponse(req, 410, "This invitation has expired. Create a new one.");
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("INVITE_FROM_EMAIL");
  const site = siteUrl();
  if (!resendKey || !from || !site) {
    return json(req, { sent: false, reason: "Email delivery is not configured." });
  }

  // Atomic per-invitation / per-workspace / per-user send throttle (anti-spam).
  const { data: denied, error: claimError } = await admin.rpc("claim_invite_email", {
    p_invitation_id: invitation.id,
    p_user_id: user.id,
  });
  if (claimError) {
    console.error("send-invite: throttle check failed", claimError.message);
    return errorResponse(req, 500, "Invitations are temporarily unavailable.");
  }
  if (denied) {
    const message = THROTTLE_MESSAGES[denied as string] ?? "Too many invitation emails. Share the link instead.";
    return json(req, { error: message, code: "rate_limit" }, 429, { "Retry-After": "600" });
  }

  const { data: inviterProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  // Workspace and profile names are free text: clean them, and show the inviter's verified
  // address so an impersonating display name is obvious to the recipient.
  const workspace = cleanLabel(org?.name || "", 60) || "a workspace";
  const inviterName = cleanLabel(inviterProfile?.full_name ?? "", 60);
  const inviter = inviterName && user.email ? `${inviterName} (${user.email})` : inviterName || user.email || "A teammate";
  const link = `${site}/invite/${encodeURIComponent(invitation.token)}`;
  const expires = new Date(invitation.expires_at).toUTCString().replace(/ \d\d:\d\d:\d\d GMT$/, "");
  const { html, text } = renderEmail({ workspace, inviter, role: invitation.role, link, expires });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [invitation.email],
        // Fixed subject: user-controlled text never reaches the inbox list.
        subject: "You've been invited to join a workspace",
        html,
        text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error("send-invite: provider error", res.status, (await res.text().catch(() => "")).slice(0, 500));
      return json(req, { sent: false, reason: "The email provider rejected the message." });
    }
  } catch (err) {
    console.error("send-invite: provider request failed", err instanceof Error ? err.message : err);
    return json(req, { sent: false, reason: "The email provider did not respond." });
  }

  return json(req, { sent: true });
});
