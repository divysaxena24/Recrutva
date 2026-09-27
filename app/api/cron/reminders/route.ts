import { db } from "@/db";
import { applicants } from "@/db/schema";
import { eq, and, isNull, lt, or, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail, getAppUrl } from "@/lib/email";

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

  // In production, CRON_SECRET is mandatory — reject if missing (fail-closed)
  if (!cronSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Server misconfiguration: CRON_SECRET not set" },
      { status: 500 }
    );
  }

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

    const { schedules } = await import("@/db/schema");
    const { generateICS } = await import("@/lib/ics");

    // Query formal active schedules first
    const activeSchedules = await db
      .select({
        scheduleId: schedules.id,
        scheduledAt: schedules.scheduledAt,
        durationMinutes: schedules.durationMinutes,
        timezone: schedules.timezone,
        status: schedules.status,
        meetingUrl: schedules.meetingUrl,
        candidateId: applicants.id,
        name: applicants.name,
        email: applicants.email,
        jobTitle: applicants.jobTitle,
        lastNotifiedAt: applicants.lastNotifiedAt,
      })
      .from(schedules)
      .innerJoin(applicants, eq(schedules.candidateId, applicants.id))
      .where(
        and(
          inArray(schedules.status, ["SCHEDULED", "CONFIRMED", "RESCHEDULED"]),
          or(
            isNull(applicants.lastNotifiedAt),
            lt(applicants.lastNotifiedAt, twentyFourHoursAgo)
          )
        )
      );

    // Filter to future scheduled sessions
    const targetReminders = activeSchedules.filter(
      (s) => new Date(s.scheduledAt) > now
    );

    console.log(`[CRON] Sending schedule reminders to ${targetReminders.length} candidates.`);

    const results: { name: string; email: string; status: string }[] = [];

    for (const item of targetReminders) {
      const interviewDate = new Date(item.scheduledAt).toLocaleString("en-US", {
        timeZone: item.timezone || "Asia/Kolkata",
        dateStyle: "full",
        timeStyle: "short",
      });

      const interviewLink = item.meetingUrl || `${getAppUrl()}/interview/${item.candidateId}`;

      const icsAttachment = generateICS({
        title: `Reminder: Recrutva Interview - ${item.jobTitle || "Role"}`,
        description: `Reminder for your upcoming interview on ${interviewDate}`,
        location: interviewLink,
        startTime: new Date(item.scheduledAt),
        durationMinutes: item.durationMinutes,
      });

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
              <h2 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 24px;">${item.name}</h2>

              <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">
                This is your daily reminder that your AI screening interview for
                <strong style="color:#a78bfa;">${item.jobTitle}</strong>
                is scheduled and waiting for you to begin.
              </p>

              <!-- Details Card -->
              <div style="background:#111128;border:1px solid #2d2d5e;border-radius:16px;padding:24px;margin:0 0 32px;">
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #1e1e3f;">
                      <span style="color:#6366f1;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;display:block;margin-bottom:4px;">📅 Scheduled For</span>
                      <span style="color:#fff;font-size:15px;font-weight:700;">${interviewDate} (${item.timezone})</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;">
                      <span style="color:#6366f1;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;display:block;margin-bottom:4px;">💼 Position</span>
                      <span style="color:#fff;font-size:15px;font-weight:700;">${item.jobTitle}</span>
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
                You'll receive this reminder until your interview is submitted.
              </p>
            </div>

            <!-- Footer -->
            <div style="border-top:1px solid #1e1e2e;padding:20px 40px;text-align:center;">
              <p style="color:#334155;font-size:11px;margin:0;">
                © ${new Date().getFullYear()} Recrutva AI &nbsp;·&nbsp; Automated Reminder &nbsp;·&nbsp;
                <a href="${getAppUrl()}/jobs" style="color:#4f46e5;text-decoration:none;">Browse Jobs</a>
              </p>
            </div>

          </div>
        </body>
        </html>
      `;

      // sendEmail never throws; failures are logged and do not corrupt state.
      const result = await sendEmail({
        to: item.email,
        subject: `⏰ Reminder: Your AI Interview for "${item.jobTitle}" is Waiting`,
        html: htmlBody,
        attachments: [
          {
            filename: "interview-reminder.ics",
            content: icsAttachment,
            contentType: "text/calendar; method=REQUEST",
          },
        ],
      });

      if (result.success) {
        // Mark as notified
        await db
          .update(applicants)
          .set({ lastNotifiedAt: now })
          .where(eq(applicants.id, item.candidateId));

        console.log(`[EMAIL SENT] ✅ ${item.email}`);
        results.push({ name: item.name, email: item.email, status: "Sent" });
      } else {
        console.error(`[EMAIL ERROR] ❌ ${item.email}: ${result.error}`);
        results.push({ name: item.name, email: item.email, status: "Failed" });
      }
    }

    return NextResponse.json({
      success: true,
      processed: targetReminders.length,
      results,
    });
  } catch (error) {
    console.error("[CRON ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
