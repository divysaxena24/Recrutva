/**
 * ICS (iCalendar) file generator for Recrutva interview scheduling.
 * Formats standard RFC 5545 calendar event files for email attachments and web downloads.
 */

export interface ICSEventOptions {
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  durationMinutes: number;
  organizerName?: string;
  organizerEmail?: string;
}

function formatDateToICS(date: Date): string {
  // Return UTC ISO string without hyphens/colons: YYYYMMDDTHHMMSSZ
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function generateICS(options: ICSEventOptions): string {
  const {
    title,
    description = "",
    location = "Recrutva Virtual Interview Room",
    startTime,
    durationMinutes,
    organizerName = "Recrutva Hiring Team",
    organizerEmail = "no-reply@recrutva.com",
  } = options;

  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();

  const uid = `interview-${startTime.getTime()}-${Math.random().toString(36).substring(2, 9)}@recrutva.com`;

  // Clean description for ICS format (escape newlines and special characters)
  const cleanDescription = description
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

  const cleanTitle = title
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Recrutva Inc//Recrutva Scheduling System//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatDateToICS(now)}`,
    `DTSTART:${formatDateToICS(startTime)}`,
    `DTEND:${formatDateToICS(endTime)}`,
    `SUMMARY:${cleanTitle}`,
    `DESCRIPTION:${cleanDescription}`,
    `LOCATION:${location}`,
    `ORGANIZER;CN=${organizerName}:mailto:${organizerEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
