// send-invite: emails a workspace invitation link (optional; the UI always shows a copyable link).
//
// Request  (POST, Authorization: Bearer <user access token>): { invitation_id: uuid }
// Response: 200 { sent: true }                     email accepted by the provider
//           200 { sent: false, reason: string }    no email provider configured / provider failed
//           { error } with 400, 401, 403, 404, 405, 409 (already accepted), 410 (expired)
//
// Secrets: RESEND_API_KEY + INVITE_FROM_EMAIL (e.g. "Acme CRM <invites@yourdomain.com>", a
// domain verified in Resend) and SITE_URL (public app URL, e.g. https://app.example.com).
import { errorResponse, json, preflight } from "../_shared/cors.ts";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return errorResponse(req, 405, "Method not allowed.");

  const user = await getCaller(req);
  if (!user) return errorResponse(req, 401, "Sign in to send invitations.");

  let body: { invitation_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse(req, 400, "Request body must be JSON.");
  }
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
    .select("id, organization_id, email, role, token, invited_by, expires_at, accepted_at, organizations(name)")
    .eq("id", invitationId)
    .maybeSingle();
  if (invError) {
    console.error("send-invite: lookup failed", invError.message);
    return errorResponse(req, 500, "Invitations are temporarily unavailable.");
  }
  if (!invitation) return errorResponse(req, 404, "Invitation not found.");

  // Only admins/managers of the invitation's workspace may send it.
  const { data: membership } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", invitation.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || (membership.role !== "admin" && membership.role !== "manager")) {
    return errorResponse(req, 403, "Only workspace admins and managers can send invitations.");
  }

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

  const { data: inviterProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const org = invitation.organizations as unknown as { name?: string } | { name?: string }[] | null;
  const workspace = (Array.isArray(org) ? org[0]?.name : org?.name) || "a workspace";
  const inviter = inviterProfile?.full_name?.trim() || user.email || "A teammate";
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
        subject: `${inviter} invited you to ${workspace}`,
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
