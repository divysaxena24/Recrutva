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
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#07090F;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:600px;margin:40px auto;background:#0E1220;border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <div style="background:linear-gradient(135deg,#3D6EFA,#00E5C0);padding:40px;text-align:center;">
          <div style="font-size:40px;margin-bottom:8px;">AI</div>
          <h1 style="color:#fff;margin:0;font-size:26px;font-weight:900;letter-spacing:-0.5px;">Recrutva</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">${content.heading}</p>
        </div>

        <div style="padding:40px;">
          <p style="color:#8A93A8;font-size:14px;margin:0 0 4px;">${content.greeting}</p>
          <h2 style="color:#EDF0F7;font-size:22px;font-weight:800;margin:0 0 24px;">${content.title}</h2>

          <div style="color:#8A93A8;font-size:15px;line-height:1.7;margin:0 0 28px;">${content.introHtml}</div>

          ${
            content.cta
              ? `<div style="text-align:center;margin:0 0 28px;">
            <a href="${content.cta.url}"
              style="display:inline-block;background:#3D6EFA;color:#fff;text-decoration:none;padding:18px 44px;border-radius:14px;font-weight:800;font-size:16px;letter-spacing:0.3px;">
              ${content.cta.label}
            </a>
          </div>`
              : ""
          }

          ${
            content.noteHtml
              ? `<p style="color:#4A5368;font-size:12px;line-height:1.6;margin:0;">${content.noteHtml}</p>`
              : ""
          }
        </div>

        <div style="border-top:1px solid rgba(255,255,255,0.08);padding:20px 40px;text-align:center;">
          <p style="color:#4A5368;font-size:11px;margin:0;">
            © ${new Date().getFullYear()} Recrutva · <a href="${appUrl}/jobs" style="color:#3D6EFA;text-decoration:none;">Browse Jobs</a>
            ${
              content.footerNote
                ? `&nbsp;·&nbsp; ${content.footerNote}`
                : ""
            }
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}