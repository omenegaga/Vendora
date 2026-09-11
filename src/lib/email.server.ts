/**
 * Server-only access email delivery.
 *
 * Managed email sending needs a verified sender domain for this project. Until
 * one is configured this records the attempt and reports why nothing was sent,
 * so the hosted download page stays the buyer's reliable path.
 */

export type AccessEmailResult = { sent: boolean; reason?: string };

async function deliver(args: { to: string; subject: string; html: string }) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM_ADDRESS"];
  if (!apiKey || !from) return { sent: false, reason: "email_not_configured" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `Vendora <${from}>`, to: [args.to], subject: args.subject, html: args.html }),
    });
    return response.ok ? { sent: true } : { sent: false, reason: "email_rejected" };
  } catch {
    return { sent: false, reason: "email_request_failed" };
  }
}

export function sendAdminInvitationEmail(args: { to: string; invitationUrl: string; expiresAt: string }) {
  return deliver({
    to: args.to,
    subject: "You have been invited to manage Vendora",
    html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a"><h1 style="font-size:20px">Manage Vendora</h1><p>You have been invited to become a Vendora administrator.</p><p><a href="${args.invitationUrl}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Accept invitation</a></p><p style="font-size:13px;color:#64748b">This single-use link expires ${new Date(args.expiresAt).toUTCString()}.</p></div>`,
  });
}

export async function sendAccessEmail(args: {
  to: string;
  buyerName?: string | null;
  productName: string;
  downloadUrl: string;
  expiresAt: string;
  senderName: string;
  supportEmail?: string | null;
}): Promise<AccessEmailResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM_ADDRESS"];

  if (!apiKey || !from) {
    console.log("Access email not sent (email sending is not configured yet)", {
      to: args.to,
      product: args.productName,
    });
    return { sent: false, reason: "email_not_configured" };
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
      <h1 style="font-size:20px;margin:0 0 12px">Your download is ready</h1>
      <p style="margin:0 0 16px">Hi ${args.buyerName ?? "there"}, thanks for buying <strong>${args.productName}</strong>.</p>
      <p style="margin:0 0 24px">
        <a href="${args.downloadUrl}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Download now</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">This link works until ${new Date(args.expiresAt).toUTCString()}.</p>
      ${args.supportEmail ? `<p style="margin:0;font-size:13px;color:#64748b">Need help? Reply or email ${args.supportEmail}.</p>` : ""}
    </div>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${args.senderName} <${from}>`,
        to: [args.to],
        subject: `Your download: ${args.productName}`,
        html,
      }),
    });
    if (!response.ok) {
      console.error("Access email rejected", await response.text());
      return { sent: false, reason: "email_rejected" };
    }
    return { sent: true };
  } catch (error) {
    console.error("Access email failed", error);
    return { sent: false, reason: "email_request_failed" };
  }
}
