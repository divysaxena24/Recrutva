import { db } from "@/db";
import { applicants } from "@/db/schema";
import { eq, and, isNull, lt, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * Build the SMTP transport.
 * Prefers SMTP_* variables; falls back to legacy EMAIL_USER/EMAIL_PASS.
 */
function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (or EMAIL_USER, EMAIL_PASS)."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const SMTP_FROM =
  process.env.EMAIL_FROM ||
  process.env.SMTP_USER ||
  process.env.EMAIL_USER ||
  "Recrutva AI <no-reply@recrutva.ai>";

/**
 * GET /api/cron/reminders
 *
 * Triggered daily via vercel.json cron.
 *
 * Abuse protection: when CRON_SECRET is configured, callers must present it
 * via the `Authorization: Bearer <secret>` header (or `x-cron-secret`).
 * Vercel cron jobs can pass it via environment configuration; if CRON_SECRET
 * is not set, the endpoint keeps working as before for backwards compatibility.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization") || "";
    const xSecret = req.headers.get("x-cron-secret") || "";
    const bearer = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";
    const presented = bearer || xSecret;

    // Constant-time comparison to avoid timing attacks
    const a = Buffer.from(presented);
    const b = Buffer.from(cronSecret);
    const match =
      a.length === b.length &&
      a.length > 0 &&
      a.reduce((acc, byte, i) => acc | (byte ^ b[i]), 0) === 0;

    if (!match) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find candidates with pending interviews not yet notified in the last 24h
    const pendingCandidates = await db
      .select()
      .from(applicants)
      .where(
        and(
          or(
            eq(applicants.status, "Scheduled"),
            eq(applicants.status, "Ready")
          ),
          or(
            isNull(applicants.lastNotifiedAt),
            lt(applicants.lastNotifiedAt, twentyFourHoursAgo)
          )
        )
      );

    // Only send to those whose interview is still in the future
    const activeCandidates = pendingCandidates.filter(
      (c) => c.scheduledAt && new Date(c.scheduledAt) > now
    );

    console.log(`[CRON] Sending reminders to ${activeCandidates.length} candidates.`);

    const results: { name: string; email: string; status: string }[] = [];

    for (const candidate of activeCandidates) {
      const interviewDate = candidate.scheduledAt
        ? new Date(candidate.scheduledAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "full",
            timeStyle: "short",
          })
        : "your scheduled slot";

      const interviewLink = `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      }/interview/${candidate.id}`;

      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;padding:0;background:#050505;font-family:'Segoe UI',Arial,sans-serif;">
          <div style="max-width:600px;margin:40px auto;background:#0a0a0f;border-radius:24px;overflow:hidden;border:1px solid #1e1e2e;">

            <!-- Header -->
            <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:40px;text-align:center;">
              <div style="font-size:40px;margin-bottom:8px;">🤖</div>
              <h1 style="color:#fff;margin:0;font-size:26px;font-weight:900;letter-spacing:-0.5px;">Recrutva AI</h1>
              <p style="color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">Daily Interview Reminder</p>
            </div>

            <!-- Body -->
            <div style="padding:40px;">
              <p style="color:#94a3b8;font-size:14px;margin:0 0 4px;">Hello,</p>
              <h2 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 24px;">${candidate.name}</h2>

              <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">
                This is your daily reminder that your AI screening interview for
                <strong style="color:#a78bfa;">${candidate.jobTitle}</strong>
                is scheduled and waiting for you to begin.
              </p>

              <!-- Details Card -->
              <div style="background:#111128;border:1px solid #2d2d5e;border-radius:16px;padding:24px;margin:0 0 32px;">
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #1e1e3f;">
                      <span style="color:#6366f1;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;display:block;margin-bottom:4px;">📅 Scheduled For</span>
                      <span style="color:#fff;font-size:15px;font-weight:700;">${interviewDate} IST</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;">
                      <span style="color:#6366f1;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;display:block;margin-bottom:4px;">💼 Position</span>
                      <span style="color:#fff;font-size:15px;font-weight:700;">${candidate.jobTitle}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA -->
              <div style="text-align:center;margin:0 0 32px;">
                <a href="${interviewLink}"
                   style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;padding:18px 44px;border-radius:14px;font-weight:800;font-size:16px;letter-spacing:0.3px;">
                  🎙️ Start My AI Interview
                </a>
              </div>

              <!-- Tips -->
              <div style="background:#0f172a;border-left:3px solid #4f46e5;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Quick Tips</p>
                <ul style="color:#94a3b8;font-size:13px;line-height:1.8;margin:0;padding-left:16px;">
                  <li>Find a quiet environment before starting</li>
                  <li>Speak clearly — Sarah AI will transcribe your answers</li>
                  <li>You have one attempt, so take your time</li>
                  <li>10 questions total, each scored out of 10</li>
                </ul>
              </div>

              <p style="color:#334155;font-size:12px;line-height:1.6;margin:0;">
                You'll receive this reminder every day at 3:50 PM IST until your interview is submitted.
              </p>
            </div>

            <!-- Footer -->
            <div style="border-top:1px solid #1e1e2e;padding:20px 40px;text-align:center;">
              <p style="color:#334155;font-size:11px;margin:0;">
                © ${new Date().getFullYear()} Recrutva AI &nbsp;·&nbsp; Automated Reminder &nbsp;·&nbsp;
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/jobs" style="color:#4f46e5;text-decoration:none;">Browse Jobs</a>
              </p>
            </div>

          </div>
        </body>
        </html>
      `;

      try {
        await getTransporter().sendMail({
          from: SMTP_FROM.includes("<") ? SMTP_FROM : `"Recrutva AI" <${SMTP_FROM}>`,
          to: candidate.email,
          subject: `⏰ Reminder: Your AI Interview for "${candidate.jobTitle}" is Waiting`,
          html: htmlBody,
        });

        // Mark as notified
        await db
          .update(applicants)
          .set({ lastNotifiedAt: now })
          .where(eq(applicants.id, candidate.id));

        console.log(`[EMAIL SENT] ✅ ${candidate.email}`);
        results.push({ name: candidate.name, email: candidate.email, status: "Sent" });
      } catch (emailErr) {
        console.error(`[EMAIL ERROR] ❌ ${candidate.email}:`, emailErr);
        results.push({ name: candidate.name, email: candidate.email, status: "Failed" });
      }
    }

    return NextResponse.json({
      success: true,
      processed: activeCandidates.length,
      results,
    });
  } catch (error) {
    console.error("[CRON ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
