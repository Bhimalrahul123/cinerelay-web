/**
 * Ticket Expiration Utilities for CineRelay
 *
 * Automatically detects expired movie and event tickets based on their show date
 * and show time. By default, events are evaluated against Indian Standard Time (IST, UTC+5:30),
 * which is the operational timezone for all Indian cinemas and event venues.
 */

export interface ExpirableListing {
  id?: string;
  title?: string;
  category?: string;
  description?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  status?: string;
  created_at?: string;
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
 * Smartly extracts a date and time from text (e.g. "9th aug 11:30am", "10th october at 11:30pm", "28dec at 2:50pm").
 */
export function extractDateFromText(text: string | null | undefined): {
  normalizedDate: string | null; // YYYY-MM-DD
  timeMinutes: number | null;
} | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  const monthMap: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };

  // Matches "9th aug", "09 August", "28dec", "28 dec"
  const regex1 = /(\d{1,2})(?:st|nd|rd|th)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i;
  // Matches "aug 9th", "october 10"
  const regex2 = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:st|nd|rd|th)?/i;

  let day: number | null = null;
  let month: number | null = null;

  const match1 = lower.match(regex1);
  if (match1) {
    day = Number(match1[1]);
    month = monthMap[match1[2].toLowerCase()] ?? null;
  } else {
    const match2 = lower.match(regex2);
    if (match2) {
      month = monthMap[match2[1].toLowerCase()] ?? null;
      day = Number(match2[2]);
    }
  }

  if (!day || !month) return null;

  // Determine year: default to current year in IST
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  const normalizedDate = `${currentYear}-${monthStr}-${dayStr}`;

  const timeMinutes = parseTimeToMinutes(lower);

  return { normalizedDate, timeMinutes };
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
  const match24 = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (match24) {
    const h = Number(match24[1]);
    const m = Number(match24[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return h * 60 + m;
    }
  }

  // Try 12-hour format: "06:30 PM" or "6:30pm"
  const match12 = trimmed.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
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
 * Determines whether a ticket's event show date/time has passed or is invalid.
 *
 * Rules:
 * 1. If an event_date is provided:
 *    - If event_date is strictly before today's date in IST -> EXPIRED (true).
 *    - If event_date is strictly after today's date in IST -> ACTIVE (false).
 *    - If event_date is TODAY in IST:
 *       - If event_time is present, expires once the show starts (+ grace period).
 *       - If no event_time is present, stays active until end of today.
 * 2. If no event_date is provided:
 *    - Checks description for any mentioned past date (e.g. "9th aug", "10th october").
 *    - For time-sensitive categories (Movies, Events, Trains, Buses):
 *      Show tickets MUST have a customer-published show date. Without a show date,
 *      it is not an active show ticket and is treated as EXPIRED / EXHAUSTED (true).
 */
export function isTicketExpired(
  eventDate: string | null | undefined,
  eventTime: string | null | undefined,
  graceMinutes: number = 0,
  description?: string | null,
  category?: string | null
): boolean {
  const normDate = normalizeDateStr(eventDate);
  const { todayStr, nowMinutes } = getNowInIST();

  if (normDate) {
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

    return false;
  }

  // If event_date is missing / null:
  // 1. Try to extract date from description (e.g. "9th aug", "10th october")
  if (description) {
    const extracted = extractDateFromText(description);
    if (extracted?.normalizedDate) {
      if (extracted.normalizedDate < todayStr) {
        return true;
      }
    }
  }

  // 2. Movie tickets and scheduled transport tickets require a show date published by the customer.
  // Without a valid show date, they cannot be displayed as active tickets.
  const cat = (category || "").toLowerCase();
  if (!cat || cat === "movies" || cat === "events" || cat === "trains" || cat === "buses") {
    return true; // Not an active, date-verified published ticket -> EXPIRED!
  }

  return false;
}

/**
 * Filters out all expired listings from an array of listings.
 * Ensures the marketplace only shows currently valid, future tickets published by real users.
 */
export function filterActiveListings<T extends ExpirableListing>(listings: T[]): T[] {
  return listings.filter((item) => {
    // If status is already expired, sold, or cancelled, exclude it
    if (item.status === "expired" || item.status === "sold" || item.status === "cancelled") {
      return false;
    }
    if (item.status && item.status !== "approved") {
      return false;
    }
    // Check dynamic event date/time expiration and date requirement
    return !isTicketExpired(
      item.event_date,
      item.event_time,
      0,
      item.description,
      item.category
    );
  });
}
