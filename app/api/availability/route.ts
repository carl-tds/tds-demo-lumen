import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  buildSlotsForDate,
  isWeekdayLondon,
  parseYmd,
} from "@/lib/validation/slotWindow";

export const runtime = "nodejs";

const CUID_RE = /^c[a-z0-9]{20,30}$/;

// Statuses that mean a slot is occupied. Cancelled / no-response / conflict
// slots are released back into the available pool.
const OCCUPYING_STATUSES = ["pending_confirmation", "confirmed", "completed"] as const;
const RELEASED_STATUSES = ["cancelled", "no_response", "conflict"] as const;

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const serviceId = url.searchParams.get("serviceId");

  if (!serviceId || !CUID_RE.test(serviceId)) {
    return NextResponse.json({ error: "missing_service_id" }, { status: 400 });
  }

  if (!dateParam) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const ymd = parseYmd(dateParam);
  if (!ymd) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  if (!isWeekdayLondon(ymd.year, ymd.month, ymd.day)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const slots = buildSlotsForDate(ymd.year, ymd.month, ymd.day);

  // Find existing bookings for that calendar day. We bound the lookup to the
  // [first slot, last slot] range. Both endpoints are converted to Date so the
  // SQL query gets timestamptz values.
  const dayStart = new Date(slots[0]);
  // Last slot is 16:30; clinic closes at 17:00. Pad the upper bound by an hour
  // to be safe against clock skew.
  const dayEnd = new Date(new Date(slots[slots.length - 1]).getTime() + 60 * 60 * 1000);

  let booked: { slotStart: Date }[] = [];
  try {
    booked = await prisma.booking.findMany({
      where: {
        serviceId,
        slotStart: { gte: dayStart, lte: dayEnd },
        status: { notIn: [...RELEASED_STATUSES] },
      },
      select: { slotStart: true },
    });
  } catch (err) {
    console.error("[availability.list] failed", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  const bookedIso = new Set(
    booked.map((b) => new Date(b.slotStart).toISOString()),
  );
  const free = slots.filter((iso) => !bookedIso.has(new Date(iso).toISOString()));

  return NextResponse.json({ slots: free }, { status: 200 });
}

// Keep OCCUPYING_STATUSES symbol referenced for potential future use; some linters
// flag unused exports.
void OCCUPYING_STATUSES;
