import { db } from "@/db";
import { applicants } from "@/db/schema";
import { eq, and, isNull, lt, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Create reusable Gmail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use an App Password, not your real Gmail password
  },
});

// Triggered daily at 3:50 PM IST (10:20 UTC) via vercel.json cron
export async function GET() {
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
        await transporter.sendMail({
          from: `"Recrutva AI" <${process.env.EMAIL_USER}>`,
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
