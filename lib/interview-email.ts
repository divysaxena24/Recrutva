import nodemailer from "nodemailer";

type InterviewInviteEmailParams = {
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string | null;
  scheduledAt: Date | null;
  emailType?: "invite" | "reminder";
};

/**
 * Build the SMTP transport.
 *
 * Prefers the standardized SMTP_* variables (SMTP_HOST, SMTP_PORT, SMTP_USER,
 * SMTP_PASS) that Docker Compose and production pass to the container.
 * Falls back to the legacy EMAIL_USER/EMAIL_PASS Gmail-style variables for
 * existing local development setups.
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
    secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
    auth: { user, pass },
  });
}

function formatInterviewDate(scheduledAt: Date | null) {
  if (!scheduledAt) return "your scheduled slot";

  return new Date(scheduledAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });
}

export function buildInterviewEmail({
  candidateId,
  candidateName,
  jobTitle,
  scheduledAt,
  emailType = "invite",
}: InterviewInviteEmailParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const interviewDate = formatInterviewDate(scheduledAt);
  const interviewLink = `${appUrl}/interview/${candidateId}`;
  const heading =
    emailType === "invite" ? "Your AI Interview is Ready" : "Daily Interview Reminder";
  const intro =
    emailType === "invite"
      ? `Thank you for applying. Your AI screening interview for <strong style="color:#7fa0ff;">${jobTitle}</strong> is now ready.`
      : `This is your daily reminder that your AI screening interview for <strong style="color:#7fa0ff;">${jobTitle}</strong> is scheduled and waiting for you to begin.`;
  const footerNote =
    emailType === "invite"
      ? "This email was sent immediately after your application so you can start your interview without waiting."
      : "You'll receive this reminder every day at 3:50 PM IST until your interview is submitted.";
  const subject =
    emailType === "invite"
      ? `Interview Ready: ${jobTitle || "Your Recrutva Application"}`
      : `Reminder: Your AI Interview for "${jobTitle}" is Waiting`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#07090F;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:600px;margin:40px auto;background:#0E1220;border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <div style="background:linear-gradient(135deg,#3D6EFA,#00E5C0);padding:40px;text-align:center;">
          <div style="font-size:40px;margin-bottom:8px;">AI</div>
          <h1 style="color:#fff;margin:0;font-size:26px;font-weight:900;letter-spacing:-0.5px;">Recrutva</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">${heading}</p>
        </div>

        <div style="padding:40px;">
          <p style="color:#8A93A8;font-size:14px;margin:0 0 4px;">Hello,</p>
          <h2 style="color:#EDF0F7;font-size:22px;font-weight:800;margin:0 0 24px;">${candidateName}</h2>

          <p style="color:#8A93A8;font-size:15px;line-height:1.7;margin:0 0 24px;">
            ${intro}
          </p>

          <div style="background:#141927;border:1px solid rgba(255,255,255,0.10);border-radius:16px;padding:24px;margin:0 0 32px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
                  <span style="color:#3D6EFA;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;display:block;margin-bottom:4px;">Scheduled For</span>
                  <span style="color:#EDF0F7;font-size:15px;font-weight:700;">${interviewDate} IST</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <span style="color:#3D6EFA;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;display:block;margin-bottom:4px;">Position</span>
                  <span style="color:#EDF0F7;font-size:15px;font-weight:700;">${jobTitle || "Your application"}</span>
                </td>
              </tr>
            </table>
          </div>

          <div style="text-align:center;margin:0 0 32px;">
            <a href="${interviewLink}"
              style="display:inline-block;background:#3D6EFA;color:#fff;text-decoration:none;padding:18px 44px;border-radius:14px;font-weight:800;font-size:16px;letter-spacing:0.3px;">
              Start My AI Interview
            </a>
          </div>

          <div style="background:#0b1220;border-left:3px solid #00E5C0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <p style="color:#4A5368;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Quick Tips</p>
            <ul style="color:#8A93A8;font-size:13px;line-height:1.8;margin:0;padding-left:16px;">
              <li>Find a quiet environment before starting</li>
              <li>Speak clearly, Sarah AI will transcribe your answers</li>
              <li>You have one attempt, so take your time</li>
              <li>Complete the interview using the link above</li>
            </ul>
          </div>

          <p style="color:#4A5368;font-size:12px;line-height:1.6;margin:0;">
            ${footerNote}
          </p>
        </div>

        <div style="border-top:1px solid rgba(255,255,255,0.08);padding:20px 40px;text-align:center;">
          <p style="color:#4A5368;font-size:11px;margin:0;">
            © ${new Date().getFullYear()} Recrutva · <a href="${appUrl}/jobs" style="color:#3D6EFA;text-decoration:none;">Browse Jobs</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export async function sendInterviewInviteEmail(params: InterviewInviteEmailParams) {
  const transporter = getTransporter();
  const { subject, html } = buildInterviewEmail(params);

  const from =
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    process.env.EMAIL_USER ||
    "Recrutva AI <no-reply@recrutva.ai>";

  await transporter.sendMail({
    from: from.includes("<") ? from : `"Recrutva AI" <${from}>`,
    to: params.candidateEmail,
    subject,
    html,
  });
}
