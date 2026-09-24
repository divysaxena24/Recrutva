import "server-only";
import nodemailer from "nodemailer";

/**
 * Recrutva Email Service
 *
 * Single server-side entry point for all transactional email. SMTP transport
 * construction lives here only — routes/actions/templates must go through
 * `sendEmail`, never build their own transporter.
 *
 * Guarantees:
 * - Never throws to callers: failures return `{ success: false }` so business
 *   transactions (candidate creation, pipeline movement, assessment/interview
 *   completion) are never rolled back or corrupted by email problems.
 * - Never logs credentials or sensitive payloads (recipients, bodies).
 * - Recipient addresses are validated before sending.
 * - If SMTP is not configured, sending is a safe no-op (development).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Optional plain-text version; a stripped fallback is generated when absent. */
  text?: string;
}

export type EmailResult =
  | { success: true }
  | { success: false; error: string };

let transporter: nodemailer.Transporter | null = null;

/**
 * Whether SMTP credentials are configured (SMTP_* or legacy EMAIL_USER/PASS).
 * Never reveals values — boolean only.
 */
export function isEmailConfigured(): boolean {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  return Boolean(user && pass);
}

/**
 * Public application base URL used for all email links.
 * Must be configured as NEXT_PUBLIC_APP_URL in production; falls back to a
 * local default for development only.
 */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

function getSender(): string {
  const from =
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    process.env.EMAIL_USER ||
    "Recrutva <no-reply@recrutva.ai>";
  return from.includes("<") ? from : `"Recrutva" <${from}>`;
}

/**
 * Lazy, cached SMTP transporter.
 * Bounded timeouts keep a dead SMTP host from stalling business transactions
 * indefinitely.
 */
function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : port === 465; // 465 = implicit TLS, 587 = STARTTLS
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error("SMTP is not configured.");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
    greetingTimeout: 5_000,
  });

  return transporter;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Send a transactional email.
 *
 * - Validates the recipient.
 * - No-ops safely when SMTP is not configured.
 * - Catches all delivery errors; logs only the safe error message (never
 *   credentials, recipient, or body content).
 * - Never throws — returns a result instead.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    console.warn(
      "[Email] SMTP is not configured — skipping email (safe no-op). Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS."
    );
    return { success: false, error: "SMTP not configured" };
  }

  if (!isValidEmail(message.to)) {
    console.error("[Email] Refusing to send: invalid recipient address.");
    return { success: false, error: "Invalid recipient" };
  }

  try {
    await getTransporter().sendMail({
      from: getSender(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text ?? stripHtml(message.html),
    });
    return { success: true };
  } catch (error) {
    console.error(
      "[Email] Delivery failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return { success: false, error: "Email delivery failed" };
  }
}

// ─── Shared branded HTML shell ─────────────────────────────────────

export interface BrandedEmailContent {
  /** Small uppercase label in the header, e.g. "Assessment Ready". */
  heading: string;
  /** Main title, e.g. "Your assessment is ready". */
  title: string;
  /** Greeting line, e.g. "Hello Divya,". */
  greeting: string;
  /** Body HTML (one or more paragraphs). */
  introHtml: string;
  /** Optional single primary action. */
  cta?: { label: string; url: string };
  /** Optional small note, e.g. a fallback plain URL. */
  noteHtml?: string;
  /** Optional footer line. */
  footerNote?: string;
}

/**
 * Build the shared branded HTML document used by every template.
 * Plain dark theme consistent with the Recrutva product.
 */
export function buildBrandedEmailHtml(content: BrandedEmailContent): string {
  const appUrl = getAppUrl();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${content.title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      </style>
    </head>
    <body style="margin:0;padding:0;background-color:#F8FAFC;color:#0F172A;-webkit-font-smoothing:antialiased;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;padding:40px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#FFFFFF;border-radius:24px;border:1px solid #E2E8F0;box-shadow:0 10px 25px -5px rgba(15,23,42,0.05);overflow:hidden;">
              
              <!-- Header Banner -->
              <tr>
                <td style="background:linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%);padding:36px 32px;text-align:center;">
                  <table role="presentation" align="center" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="background:rgba(255,255,255,0.2);padding:8px 16px;border-radius:999px;backdrop-filter:blur(4px);display:inline-block;">
                        <span style="color:#FFFFFF;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">${content.heading}</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color:#FFFFFF;margin:16px 0 0;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Recrutva</h1>
                  <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:12px;font-weight:600;">Autonomous AI Hiring & Talent Assessment</p>
                </td>
              </tr>

              <!-- Body Content -->
              <tr>
                <td style="padding:36px 32px 28px;">
                  <p style="color:#64748B;font-size:14px;font-weight:600;margin:0 0 6px;">${content.greeting}</p>
                  <h2 style="color:#0F172A;font-size:20px;font-weight:800;letter-spacing:-0.3px;margin:0 0 20px;line-height:1.3;">${content.title}</h2>

                  <div style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 28px;">
                    ${content.introHtml}
                  </div>

                  ${
                    content.cta
                      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
                    <tr>
                      <td align="center">
                        <a href="${content.cta.url}" target="_blank"
                          style="display:inline-block;background:linear-gradient(135deg, #4F46E5 0%, #4338CA 100%);color:#FFFFFF;text-decoration:none;padding:16px 36px;border-radius:14px;font-weight:700;font-size:14px;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(79,70,229,0.3);text-align:center;">
                          ${content.cta.label} &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>`
                      : ""
                  }

                  ${
                    content.noteHtml
                      ? `<div style="background:#F1F5F9;border-radius:12px;padding:14px 18px;margin:0 0 20px;color:#64748B;font-size:12px;line-height:1.6;">
                          ${content.noteHtml}
                        </div>`
                      : ""
                  }
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#F8FAFC;border-top:1px solid #F1F5F9;padding:24px 32px;text-align:center;">
                  <p style="color:#64748B;font-size:12px;margin:0 0 8px;font-weight:500;">
                    ${content.footerNote ? `${content.footerNote}<br>` : ""}
                    Questions? Contact us at <a href="mailto:divysaxena2402@gmail.com" style="color:#4F46E5;text-decoration:none;font-weight:600;">divysaxena2402@gmail.com</a>
                  </p>
                  <p style="color:#94A3B8;font-size:11px;margin:0;">
                    &copy; ${new Date().getFullYear()} Recrutva AI Inc. All rights reserved. &middot; <a href="${appUrl}/candidate-dashboard" style="color:#4F46E5;text-decoration:none;font-weight:600;">Candidate Portal</a> &middot; <a href="${appUrl}/privacy" style="color:#94A3B8;text-decoration:none;">Privacy Policy</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}