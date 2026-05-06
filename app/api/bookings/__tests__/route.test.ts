import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

// vi.hoisted runs before any top-level imports, so we async-import
// vitest-mock-extended (which is ESM) inside the hoisted callback. The result
// is awaited by Vitest before module imports proceed.
const { prismaMock } = await vi.hoisted(async () => {
  const { mockDeep } = await import("vitest-mock-extended");
  return { prismaMock: mockDeep() as DeepMockProxy<PrismaClient> };
});

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

// Import AFTER the mock declaration.
import { POST } from "@/app/api/bookings/route";

const VALID_BODY = {
  patientName: "Alex Smith",
  patientEmail: "alex@example.com",
  patientPhone: "07700900123",
  // cuid format ID
  serviceId: "ckxabcdefghijklmnopqrstuv",
  // Wednesday 2026-05-13 at 10:00 BST (UTC+1)
  slotStart: "2026-05-13T10:00:00+01:00",
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockReset(prismaMock);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/bookings", () => {
  it("happy path → 201 with booking_id", async () => {
    prismaMock.booking.create.mockResolvedValue({
      id: "ckbook1234567890booking01",
      serviceId: VALID_BODY.serviceId,
      patientName: VALID_BODY.patientName,
      patientEmail: VALID_BODY.patientEmail,
      patientPhone: VALID_BODY.patientPhone,
      slotStart: new Date(VALID_BODY.slotStart),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: "pending_confirmation" as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual({ booking_id: "ckbook1234567890booking01" });
    expect(prismaMock.booking.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceId: VALID_BODY.serviceId,
        patientName: VALID_BODY.patientName,
        patientEmail: VALID_BODY.patientEmail,
        patientPhone: VALID_BODY.patientPhone,
        status: "pending_confirmation",
      }),
    });
  });

  it("invalid email → 400 with fields.patientEmail", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, patientEmail: "not-an-email" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_failed");
    expect(json.fields.patientEmail).toBeTruthy();
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
  });

  it("invalid UK phone (US E.164) → 400", async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, patientPhone: "+1 555 123 4567" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_failed");
    expect(json.fields.patientPhone).toBeTruthy();
  });

  it("invalid UK phone (too short) → 400", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, patientPhone: "0123" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_failed");
    expect(json.fields.patientPhone).toBeTruthy();
  });

  it("out-of-hours slot (08:30) → 400", async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, slotStart: "2026-05-13T08:30:00+01:00" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_failed");
    expect(json.fields.slotStart).toBeTruthy();
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
  });

  it("weekend slot → 400", async () => {
    // 2026-05-16 is a Saturday
    const res = await POST(
      makeRequest({ ...VALID_BODY, slotStart: "2026-05-16T10:00:00+01:00" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_failed");
    expect(json.fields.slotStart).toBeTruthy();
  });

  it("prisma rejection → 500 internal_error", async () => {
    prismaMock.booking.create.mockRejectedValue(new Error("connection refused"));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: "internal_error" });
  });

  it("malformed JSON body → 400", async () => {
    const req = new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
