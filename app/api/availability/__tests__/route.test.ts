import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const { prismaMock } = await vi.hoisted(async () => {
  const { mockDeep } = await import("vitest-mock-extended");
  return { prismaMock: mockDeep() as DeepMockProxy<PrismaClient> };
});

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

import { GET } from "@/app/api/availability/route";

const VALID_SERVICE = "ckxabcdefghijklmnopqrstuv";

function makeRequest(date: string | undefined, serviceId: string | undefined): Request {
  const url = new URL("http://localhost/api/availability");
  if (date !== undefined) url.searchParams.set("date", date);
  if (serviceId !== undefined) url.searchParams.set("serviceId", serviceId);
  return new Request(url.toString(), { method: "GET" });
}

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.booking.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/availability", () => {
  it("weekday returns 30-minute slots from 09:00 to 16:30 (16 slots)", async () => {
    // 2026-05-13 is a Wednesday → BST (UTC+1)
    const res = await GET(makeRequest("2026-05-13", VALID_SERVICE));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.slots)).toBe(true);
    // 09:00, 09:30, ..., 16:30 → 16 slots
    expect(json.slots).toHaveLength(16);
    expect(json.slots[0]).toMatch(/^2026-05-13T09:00:00/);
    expect(json.slots[json.slots.length - 1]).toMatch(/^2026-05-13T16:30:00/);
    // BST offset
    expect(json.slots[0]).toMatch(/\+01:00$/);
  });

  it("excludes slots already booked (and counted-as-occupying statuses)", async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      // 09:00 BST on 2026-05-13
      {
        id: "ckbook01",
        serviceId: VALID_SERVICE,
        patientName: "x",
        patientEmail: "x@example.com",
        patientPhone: "07700900123",
        slotStart: new Date("2026-05-13T09:00:00+01:00"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: "pending_confirmation" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const res = await GET(makeRequest("2026-05-13", VALID_SERVICE));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.slots).toHaveLength(15);
    expect(json.slots.find((s: string) => s.startsWith("2026-05-13T09:00:00"))).toBeUndefined();

    // Verify the query filters out cancelled/no_response/conflict.
    expect(prismaMock.booking.findMany).toHaveBeenCalled();
    const call = prismaMock.booking.findMany.mock.calls[0][0];
    expect(call?.where?.status).toEqual(
      expect.objectContaining({ notIn: ["cancelled", "no_response", "conflict"] }),
    );
  });

  it("weekend date → 400 invalid_date", async () => {
    // 2026-05-16 is Saturday
    const res = await GET(makeRequest("2026-05-16", VALID_SERVICE));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_date");
  });

  it("malformed date → 400 invalid_date", async () => {
    const res = await GET(makeRequest("2026-13-99", VALID_SERVICE));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_date");
  });

  it("missing serviceId → 400 missing_service_id", async () => {
    const res = await GET(makeRequest("2026-05-13", undefined));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("missing_service_id");
  });
});
