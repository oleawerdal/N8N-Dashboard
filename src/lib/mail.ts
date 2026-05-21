// SMTP2Go API client. Used by:
//  - Invite flow (api/team/users) to email new teammates
//  - Password reset (when wired up)
//  - Error alerts (optional, future)
//  - The "Send test email" button on /admin/emails
//
// Config lives in store.settings.mail (visible to admins) + the api key
// in store.secrets.mailApiKey (server-only). Both are persisted in
// memory and reset on cold start unless SMTP2GO_API_KEY /
// MAIL_FROM_EMAIL / MAIL_FROM_NAME env vars are set (recommended for
// Vercel deploys so the config survives lambda restarts).

import { settings, EMAIL_TEMPLATES } from "./store";

const SMTP2GO_ENDPOINT = "https://api.smtp2go.com/v3/email/send";

export type SendResult =
  | { ok: true; emailId: string | null }
  | { ok: false; error: string };

export async function sendMail(input: {
  to: string;
  toName?: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const cfg = settings.read().mail;
  const apiKey = settings._internalMailKey();
  if (cfg.provider === "none" || !apiKey) {
    return { ok: false, error: "Mail provider not configured" };
  }
  if (!cfg.fromEmail) {
    return { ok: false, error: "Sender address missing" };
  }
  const sender = cfg.fromName
    ? `${cfg.fromName} <${cfg.fromEmail}>`
    : cfg.fromEmail;
  const recipient = input.toName
    ? `${input.toName} <${input.to}>`
    : input.to;
  try {
    const res = await fetch(SMTP2GO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Smtp2go-Api-Key": apiKey,
      },
      body: JSON.stringify({
        sender,
        to: [recipient],
        subject: input.subject,
        text_body: input.body,
        html_body: textToHtml(input.body),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      data?: { succeeded?: number; failed?: number; email_id?: string };
      error?: string;
      error_code?: string;
    };
    if (!res.ok || (data?.data?.failed ?? 0) > 0) {
      return {
        ok: false,
        error:
          data.error ||
          `SMTP2Go HTTP ${res.status}` +
            (data.error_code ? ` (${data.error_code})` : ""),
      };
    }
    return { ok: true, emailId: data?.data?.email_id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Render a registered template (invite/passwordReset/errorAlert/...) by
// key. Variables that the template wasn't designed for are left as
// literal {{name}} so missing fields are visible.
export function renderTemplate(
  key: string,
  vars: Record<string, string | undefined>
): { subject: string; body: string } | null {
  const tpl = settings.read().emails[key];
  if (!tpl) return null;
  const sub = substitute(tpl.subject, vars);
  const body = substitute(tpl.body, vars);
  return { subject: sub, body };
}

function substitute(
  template: string,
  vars: Record<string, string | undefined>
): string {
  const branding = settings.read().branding;
  const full: Record<string, string | undefined> = {
    brandName: branding.brandName,
    ...vars,
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    full[k] !== undefined ? String(full[k]) : `{{${k}}}`
  );
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withLinks = escaped.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>'
  );
  return `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${withLinks}</div>`;
}

export function templateKeys(): string[] {
  return EMAIL_TEMPLATES.map((t) => t.key);
}
