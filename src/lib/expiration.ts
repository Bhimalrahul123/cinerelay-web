/**
 * Ticket Expiration Utilities for CineRelay
 *
 * Automatically detects expired movie and event tickets based on their show date
 * and show time. By default, events are evaluated against Indian Standard Time (IST, UTC+5:30),
 * which is the operational timezone for all Indian cinemas and event venues.
 */

export interface ExpirableListing {
  event_date?: string | null;
  event_time?: string | null;
  status?: string;
}

/**
 * Returns the current date and time components in Asia/Kolkata (IST).
 */
export function getNowInIST(): {
  todayStr: string; // YYYY-MM-DD
  nowMinutes: number; // minutes from midnight (0 - 1439)
  nowIso: string;
} {
  const now = new Date();

  // en-CA format yields YYYY-MM-DD
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const [hours, minutes] = timeStr.split(":").map(Number);
  const nowMinutes = (hours || 0) * 60 + (minutes || 0);

  return {
    todayStr,
    nowMinutes,
    nowIso: now.toISOString(),
  };
}

/**
 * Parses an event time string (e.g. "18:30" or "06:30 PM" or "18:30:00")
 * into total minutes from midnight (0 - 1439).
 * Returns null if the time cannot be parsed.
 */
export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim();

  // Try 24-hour format: "HH:MM" or "HH:MM:SS"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    const h = Number(match24[1]);
    const m = Number(match24[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return h * 60 + m;
    }
  }

  // Try 12-hour format: "06:30 PM" or "6:30pm"
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (match12) {
    let h = Number(match12[1]);
    const m = Number(match12[2]);
    const period = match12[3].toLowerCase();
    if (period === "pm" && h < 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return h * 60 + m;
    }
  }

  return null;
}

/**
 * Normalizes an event date string to "YYYY-MM-DD" if possible.
 */
export function normalizeDateStr(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // ISO timestamp (e.g. 2026-10-12T00:00:00.000Z)
  if (trimmed.includes("T")) {
    const part = trimmed.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
      return part;
    }
  }

  // Try parsing via Date constructor
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return null;
}

/**
 * Determines whether a ticket's event show date/time has passed.
 *
 * Rules:
 * 1. If no event_date is provided, the listing does not have a strict date expiry -> returns false.
 * 2. If event_date is strictly before today's date in IST -> EXPIRED (returns true).
 * 3. If event_date is strictly after today's date in IST -> ACTIVE (returns false).
 * 4. If event_date is TODAY in IST:
 *    - If event_time is present, the ticket expires once the show starts (with a 15-minute grace period).
 *    - If no event_time is present, the ticket remains active until the end of today (23:59 IST).
 */
export function isTicketExpired(
  eventDate: string | null | undefined,
  eventTime: string | null | undefined,
  graceMinutes: number = 15
): boolean {
  const normDate = normalizeDateStr(eventDate);
  if (!normDate) return false;

  const { todayStr, nowMinutes } = getNowInIST();

  // Past date
  if (normDate < todayStr) {
    return true;
  }

  // Future date
  if (normDate > todayStr) {
    return false;
  }

  // Event is TODAY:
  const showMinutes = parseTimeToMinutes(eventTime);
  if (showMinutes !== null) {
    // Expired if current time is past (show start + graceMinutes)
    return nowMinutes >= showMinutes + graceMinutes;
  }

  // Same day without specific time: not expired yet
  return false;
}

/**
 * Filters out all expired listings from an array of listings.
 * Ensures the marketplace only shows currently valid, future tickets.
 */
export function filterActiveListings<T extends ExpirableListing>(listings: T[]): T[] {
  return listings.filter((item) => {
    // If status is already expired, exclude it
    if (item.status === "expired" || item.status === "sold" || item.status === "cancelled") {
      return false;
    }
    // Check dynamic event date/time expiration
    return !isTicketExpired(item.event_date, item.event_time);
  });
}
