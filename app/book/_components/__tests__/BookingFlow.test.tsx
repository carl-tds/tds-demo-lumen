/// <reference types="@testing-library/jest-dom" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BookingFlow from "@/app/book/_components/BookingFlow";
import { SERVICES } from "@/app/book/_lib/services";

// A weekday slot that satisfies the server validator (Mon–Fri 09:00–17:00 London).
// Wednesday 2026-05-13 at 10:00 BST.
const VALID_SLOT_ISO = "2026-05-13T10:00:00+01:00";
// The booking flow uses a date <input type="date"> which produces YYYY-MM-DD.
const VALID_DATE_YMD = "2026-05-13";

interface FetchInit extends RequestInit {
  body?: BodyInit | null;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fetchSpyHandlers(handlers: {
  availability?: (url: URL) => Response;
  bookings?: (init: FetchInit | undefined) => Response;
}) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url =
      typeof input === "string"
        ? new URL(input, "http://localhost")
        : input instanceof URL
          ? input
          : new URL((input as Request).url, "http://localhost");

    if (url.pathname === "/api/availability" && (!init || init.method === undefined || init.method === "GET")) {
      return handlers.availability?.(url) ?? jsonResponse(200, { slots: [VALID_SLOT_ISO] });
    }
    if (url.pathname === "/api/bookings" && init?.method === "POST") {
      return handlers.bookings?.(init) ?? jsonResponse(201, { booking_id: "cbookingdefault0000000000" });
    }
    throw new Error(`Unexpected fetch: ${url.pathname} ${init?.method ?? "GET"}`);
  });
}

async function pickFirstService(user: ReturnType<typeof userEvent.setup>) {
  const first = SERVICES[0];
  await user.click(screen.getByRole("button", { name: new RegExp(first.name, "i") }));
}

async function pickDateAndSlot(user: ReturnType<typeof userEvent.setup>) {
  const dateInput = screen.getByLabelText(/choose a date/i) as HTMLInputElement;
  // user.type doesn't play well with date inputs across browsers; set value via fireEvent semantics
  await user.click(dateInput);
  // Use fireEvent-ish path: directly setting via userEvent.type works in jsdom for date inputs
  // when given the YYYY-MM-DD form.
  await user.clear(dateInput);
  await user.type(dateInput, VALID_DATE_YMD);

  // Wait for availability fetch to populate slot buttons.
  const slotBtn = await screen.findByRole("button", { name: /10:00/ });
  await user.click(slotBtn);
}

async function fillContactForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<{ name: string; email: string; phone: string }> = {},
) {
  const data = {
    name: "Alex Smith",
    email: "alex@example.com",
    phone: "07700900123",
    ...overrides,
  };
  await user.type(screen.getByLabelText(/full name/i), data.name);
  await user.type(screen.getByLabelText(/email/i), data.email);
  await user.type(screen.getByLabelText(/phone/i), data.phone);
}

describe("BookingFlow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Step 1 (service picker) by default", () => {
    fetchSpyHandlers({});
    render(<BookingFlow />);
    expect(
      screen.getByRole("heading", { name: /choose a service/i }),
    ).toBeInTheDocument();
    // All five service buttons rendered
    SERVICES.forEach((s) => {
      expect(
        screen.getByRole("button", { name: new RegExp(s.name, "i") }),
      ).toBeInTheDocument();
    });
  });

  it("advances to Step 2 (slot picker) after a service is selected", async () => {
    fetchSpyHandlers({});
    const user = userEvent.setup();
    render(<BookingFlow />);
    await pickFirstService(user);
    expect(
      await screen.findByRole("heading", { name: /pick a date/i }),
    ).toBeInTheDocument();
  });

  it("advances to Step 3 (contact form) after a slot is selected", async () => {
    fetchSpyHandlers({});
    const user = userEvent.setup();
    render(<BookingFlow />);
    await pickFirstService(user);
    await pickDateAndSlot(user);
    expect(
      await screen.findByRole("heading", { name: /your details/i }),
    ).toBeInTheDocument();
  });

  it("shows an inline email error and does NOT call POST /api/bookings on invalid email submit", async () => {
    const fetchSpy = fetchSpyHandlers({});
    const user = userEvent.setup();
    render(<BookingFlow />);
    await pickFirstService(user);
    await pickDateAndSlot(user);
    await fillContactForm(user, { email: "not-an-email" });

    await user.click(screen.getByRole("button", { name: /request appointment/i }));

    expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument();

    const postCalls = fetchSpy.mock.calls.filter((call) => {
      const init = call[1] as FetchInit | undefined;
      return init?.method === "POST";
    });
    expect(postCalls.length).toBe(0);
  });

  it("submits valid input to /api/bookings and renders the confirmation view with the booking id", async () => {
    const fetchSpy = fetchSpyHandlers({
      bookings: () => jsonResponse(201, { booking_id: "cbookingsuccess0000000000" }),
    });
    const user = userEvent.setup();
    render(<BookingFlow />);
    await pickFirstService(user);
    await pickDateAndSlot(user);
    await fillContactForm(user);
    await user.click(screen.getByRole("button", { name: /request appointment/i }));

    // Confirmation view shows the booking id
    expect(
      await screen.findByText(/cbookingsuccess0000000000/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /request received/i }),
    ).toBeInTheDocument();

    // POST happened
    const postCalls = fetchSpy.mock.calls.filter((call) => {
      const init = call[1] as FetchInit | undefined;
      return init?.method === "POST";
    });
    expect(postCalls.length).toBe(1);
    const init = postCalls[0][1] as FetchInit;
    const body = JSON.parse(init.body as string);
    expect(body.patientEmail).toBe("alex@example.com");
    expect(body.patientPhone).toBe("07700900123");
    expect(body.serviceId).toBe(SERVICES[0].id);
    expect(body.slotStart).toBe(VALID_SLOT_ISO);
  });

  it("surfaces a 'Something went wrong' message with a retry button on a 500", async () => {
    const fetchSpy = fetchSpyHandlers({
      bookings: () => jsonResponse(500, { error: "internal_error" }),
    });
    const user = userEvent.setup();
    render(<BookingFlow />);
    await pickFirstService(user);
    await pickDateAndSlot(user);
    await fillContactForm(user);
    await user.click(screen.getByRole("button", { name: /request appointment/i }));

    expect(
      await screen.findByText(/something went wrong/i),
    ).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: /try again/i });
    expect(retry).toBeInTheDocument();

    // Sanity check: a POST was attempted exactly once before retry
    const postCallsBeforeRetry = fetchSpy.mock.calls.filter((call) => {
      const init = call[1] as FetchInit | undefined;
      return init?.method === "POST";
    });
    expect(postCallsBeforeRetry.length).toBe(1);
  });

  it("surfaces field errors from a 400 response without crashing", async () => {
    fetchSpyHandlers({
      bookings: () =>
        jsonResponse(400, {
          error: "validation_failed",
          fields: { patientPhone: ["Invalid UK phone number"] },
        }),
    });
    const user = userEvent.setup();
    render(<BookingFlow />);
    await pickFirstService(user);
    await pickDateAndSlot(user);
    await fillContactForm(user);
    await user.click(screen.getByRole("button", { name: /request appointment/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/invalid uk phone number/i),
      ).toBeInTheDocument();
    });
  });
});
