import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { bookingCreateSchema } from "@/lib/validation/booking";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    // Use treeifyError to produce a fields map; fall back to flatten for compat.
    const flat = parsed.error.flatten();
    return NextResponse.json(
      { error: "validation_failed", fields: flat.fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    const booking = await prisma.booking.create({
      data: {
        serviceId: data.serviceId,
        patientName: data.patientName,
        patientEmail: data.patientEmail,
        patientPhone: data.patientPhone,
        slotStart: new Date(data.slotStart),
        status: "pending_confirmation",
      },
    });

    // TODO LD01b: send Postmark confirmation email + Slack ping to #lumen-bookings

    return NextResponse.json({ booking_id: booking.id }, { status: 201 });
  } catch (err) {
    // Don't leak the underlying error.
    console.error("[bookings.create] failed", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
