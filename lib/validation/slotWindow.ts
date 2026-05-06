// Single source of truth for clinic opening hours: Mon–Fri 09:00–17:00 Europe/London.
// Used by both the booking POST validator and the availability GET endpoint.
//
// We use Intl.DateTimeFormat to derive the wall-clock components in Europe/London
// rather than pulling in date-fns-tz — the logic is small and deterministic.

const LONDON_TZ = "Europe/London";
const OPENING_HOUR = 9; // inclusive
const CLOSING_HOUR = 17; // exclusive — last slot starts at 16:30

export const SLOT_INCREMENT_MINUTES = 30;

interface LondonParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  weekday: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
}

/** Decompose a Date into its Europe/London wall-clock parts. */
export function partsInLondon(date: Date): LondonParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });

  const parts = fmt.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  // Some locales return "24" for midnight; normalise to 0.
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;

  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour,
    minute: parseInt(get("minute"), 10),
    weekday: weekdayMap[get("weekday")] ?? -1,
  };
}

/** True iff the date falls Mon–Fri 09:00–17:00 (London) on a 30-minute boundary. */
export function isWithinClinicHours(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false;
  const p = partsInLondon(date);
  if (p.weekday < 1 || p.weekday > 5) return false; // Mon=1..Fri=5
  if (p.hour < OPENING_HOUR || p.hour >= CLOSING_HOUR) return false;
  if (p.minute % SLOT_INCREMENT_MINUTES !== 0) return false;
  return true;
}

/** True iff a YYYY-MM-DD calendar date in London is a weekday (Mon–Fri). */
export function isWeekdayLondon(year: number, month: number, day: number): boolean {
  // Construct noon-UTC for that date so DST shifts can't bump us across midnight.
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const p = partsInLondon(probe);
  return p.weekday >= 1 && p.weekday <= 5;
}

/**
 * For a given calendar date (YYYY-MM-DD interpreted in London), return the ISO
 * 8601 datetimes (with offset) for every 30-minute slot from 09:00 up to and
 * including 16:30 in Europe/London local time.
 */
export function buildSlotsForDate(year: number, month: number, day: number): string[] {
  const slots: string[] = [];
  for (let hour = OPENING_HOUR; hour < CLOSING_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_INCREMENT_MINUTES) {
      slots.push(londonWallClockToIso(year, month, day, hour, minute));
    }
  }
  return slots;
}

/**
 * Convert a London wall-clock instant to an ISO 8601 string with the correct
 * offset. Handles BST/GMT transitions by probing the offset at the candidate
 * UTC instant and correcting once.
 */
export function londonWallClockToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  // Start from the UTC interpretation of the wall-clock time.
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = londonOffsetMinutesAt(utcGuess);
  // Subtract the offset to get the UTC instant that prints as the wall-clock time.
  const trueUtcMs = utcGuess.getTime() - offsetMinutes * 60_000;
  const trueDate = new Date(trueUtcMs);

  // Verify (cheap safety net for DST edges) and re-correct if needed.
  const verifyOffset = londonOffsetMinutesAt(trueDate);
  const finalDate =
    verifyOffset === offsetMinutes
      ? trueDate
      : new Date(utcGuess.getTime() - verifyOffset * 60_000);

  return formatIsoWithOffset(finalDate, londonOffsetMinutesAt(finalDate));
}

function londonOffsetMinutesAt(date: Date): number {
  // Europe/London is UTC+0 in winter (GMT) and UTC+1 in summer (BST).
  // Compute by comparing the London wall-clock time to the UTC wall-clock time.
  const p = partsInLondon(date);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  const realUtc =
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      0,
    );
  return Math.round((asIfUtc - realUtc) / 60_000);
}

function formatIsoWithOffset(date: Date, offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");

  // Build the wall-clock fields in the target offset.
  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  const y = local.getUTCFullYear();
  const mo = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  const h = String(local.getUTCHours()).padStart(2, "0");
  const mi = String(local.getUTCMinutes()).padStart(2, "0");
  const s = String(local.getUTCSeconds()).padStart(2, "0");

  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${oh}:${om}`;
}

/** Parse a YYYY-MM-DD string. Returns null if malformed. */
export function parseYmd(s: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Validate the calendar (rejects e.g. Feb 30).
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}
