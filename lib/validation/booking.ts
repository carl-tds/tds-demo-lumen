// Shared zod schema for booking creation. Used by:
//   - app/api/bookings/route.ts (server validation)
//   - the booking form on the frontend (mirrors the same shape)
//
// IMPORTANT: server-side is the source of truth. Frontend validation is a UX
// affordance only and is re-checked here.

import { z } from "zod";
import { isWithinClinicHours } from "./slotWindow";

// cuid is the default Prisma ID format for Service / Booking.
// Pattern: starts with 'c', 24 lower-case alphanumeric chars (we accept 24-25 to be tolerant).
const CUID_RE = /^c[a-z0-9]{20,30}$/;

/**
 * UK phone validator.
 *
 * Accepts:
 *   - E.164 starting with +44 (12 digits total including the +44 country code,
 *     i.e. 10 digits of subscriber number after +44; common UK numbers are
 *     +44 followed by 10 digits → 13 chars total counting the '+', so we
 *     measure digits-only and require 12 digits when starting with +44).
 *   - Domestic starting with 0: 11 digits total. 07 mobiles or 0[1-9] landlines.
 *
 * Spaces and hyphens are stripped before length checks. Parentheses rejected.
 */
function isValidUkPhone(raw: string): boolean {
  const cleaned = raw.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+44")) {
    const digits = cleaned.slice(3);
    if (!/^\d+$/.test(digits)) return false;
    // +44 is followed by 10 digits → 12 digits total counting the country code.
    return digits.length === 10;
  }
  if (cleaned.startsWith("0")) {
    if (!/^\d+$/.test(cleaned)) return false;
    if (cleaned.length !== 11) return false;
    // Second digit must be 1-9 (07 mobiles, 01/02/03/.. landlines and service nos)
    return /^0[1-9]/.test(cleaned);
  }
  return false;
}

export const bookingCreateSchema = z.object({
  patientName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  patientEmail: z.string().trim().email("Invalid email address"),
  patientPhone: z
    .string()
    .trim()
    .refine(isValidUkPhone, {
      message: "Invalid UK phone number",
    }),
  serviceId: z.string().regex(CUID_RE, "Invalid service id"),
  slotStart: z
    .string()
    .datetime({ offset: true, message: "Invalid slot datetime" })
    .refine(
      (s) => isWithinClinicHours(new Date(s)),
      {
        message: "Slot is outside clinic hours (Mon–Fri 09:00–17:00 Europe/London)",
      },
    ),
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
