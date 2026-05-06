"use client";

// LD01a: 3-step booking flow.
//
// Step 1 — service picker (hardcoded list)
// Step 2 — date + slot picker (slots fetched from /api/availability)
// Step 3 — contact details (validated client-side with the server's Zod schema)
// Confirmation — booking_id displayed; "book another" link.
//
// We import bookingCreateSchema directly so client and server agree on the
// rules. Server is still the source of truth and re-validates.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { z } from "zod";

import { bookingCreateSchema } from "@/lib/validation/booking";
import { SERVICES, findServiceById } from "@/app/book/_lib/services";

type Step = "service" | "slot" | "contact" | "confirmed";

type FieldErrors = Partial<{
  patientName: string[];
  patientEmail: string[];
  patientPhone: string[];
  serviceId: string[];
  slotStart: string[];
}>;

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "field_errors"; fields: FieldErrors }
  | { kind: "server_error" };

const labelClass =
  "block text-sm font-medium text-zinc-800 mb-1";
const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-60";
const errorClass = "mt-1 text-sm text-red-600";
const primaryBtnClass =
  "inline-flex w-full sm:w-auto items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-base font-medium text-white shadow-sm hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 disabled:opacity-60";
const secondaryBtnClass =
  "inline-flex w-full sm:w-auto items-center justify-center rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-base font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-sky-200";

function todayYmdLondon(): string {
  // Use the user's local clock for the min attribute. We're not strict here —
  // server validation re-checks the slot is in clinic hours.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function maxYmd(): string {
  // Today + 60 days.
  const d = new Date();
  d.setDate(d.getDate() + 60);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatSlotLabel(iso: string): string {
  const d = new Date(iso);
  // Display in Europe/London local time so 10:00+01:00 shows as "10:00".
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function formatDateLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default function BookingFlow() {
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState<string>("");
  const [slot, setSlot] = useState<string | null>(null);

  const [contact, setContact] = useState({
    patientName: "",
    patientEmail: "",
    patientPhone: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [availability, setAvailability] = useState<{
    state: "idle" | "loading" | "ok" | "error";
    slots: string[];
    message?: string;
  }>({ state: "idle", slots: [] });

  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // For accessibility: move focus to the first heading of each new step.
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step]);

  const selectedService = useMemo(
    () => (serviceId ? findServiceById(serviceId) : undefined),
    [serviceId],
  );

  // Fetch availability whenever date + serviceId are both set. We deliberately
  // do not call setState synchronously in the effect body (React 19's
  // set-state-in-effect rule flags that pattern); instead, the date change
  // handler flips state to "loading" first and we simply consume the response.
  useEffect(() => {
    if (step !== "slot" || !serviceId || !date) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/availability?date=${encodeURIComponent(date)}&serviceId=${encodeURIComponent(serviceId)}`,
          { method: "GET" },
        );
        if (cancelled) return;
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setAvailability({
            state: "error",
            slots: [],
            message:
              err.error === "invalid_date"
                ? "Please choose a weekday."
                : "Could not load slots. Please try a different date.",
          });
          return;
        }
        const data = (await res.json()) as { slots: string[] };
        setAvailability({ state: "ok", slots: data.slots ?? [] });
      } catch {
        if (cancelled) return;
        setAvailability({
          state: "error",
          slots: [],
          message: "Could not load slots. Please check your connection.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, serviceId, date]);

  const goToStep = useCallback((next: Step) => {
    setStep(next);
  }, []);

  const handleServicePick = useCallback(
    (id: string) => {
      setServiceId(id);
      setSlot(null);
      setAvailability({ state: "idle", slots: [] });
      goToStep("slot");
    },
    [goToStep],
  );

  const handleSlotPick = useCallback(
    (iso: string) => {
      setSlot(iso);
      goToStep("contact");
    },
    [goToStep],
  );

  const validateContactField = useCallback(
    (field: "patientName" | "patientEmail" | "patientPhone"): string[] => {
      // We can't easily validate an individual field with the full schema
      // because slotStart/serviceId may not be set yet. Build a partial schema
      // pulling just the field's rules.
      const fieldSchema = bookingCreateSchema.shape[field];
      const result = fieldSchema.safeParse(contact[field]);
      if (result.success) return [];
      return result.error.issues.map((i) => i.message);
    },
    [contact],
  );

  const handleSubmitContact = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!serviceId || !slot) {
        setSubmit({ kind: "server_error" });
        return;
      }

      const payload = {
        ...contact,
        serviceId,
        slotStart: slot,
      };

      // Client-side full validation (UX only; server re-validates).
      const parsed = bookingCreateSchema.safeParse(payload);
      if (!parsed.success) {
        const fields: FieldErrors = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as keyof FieldErrors | undefined;
          if (!key) continue;
          fields[key] = [...(fields[key] ?? []), issue.message];
        }
        setTouched({
          patientName: true,
          patientEmail: true,
          patientPhone: true,
        });
        setSubmit({ kind: "field_errors", fields });
        return;
      }

      setSubmit({ kind: "submitting" });
      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data satisfies z.infer<typeof bookingCreateSchema>),
        });
        if (res.status === 201) {
          const data = (await res.json()) as { booking_id: string };
          startTransition(() => {
            setBookingId(data.booking_id);
            setSubmit({ kind: "idle" });
            goToStep("confirmed");
          });
          return;
        }
        if (res.status === 400) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            fields?: FieldErrors;
          };
          setSubmit({
            kind: "field_errors",
            fields: data.fields ?? {},
          });
          return;
        }
        setSubmit({ kind: "server_error" });
      } catch {
        setSubmit({ kind: "server_error" });
      }
    },
    [contact, serviceId, slot, goToStep],
  );

  const restart = useCallback(() => {
    setStep("service");
    setServiceId(null);
    setDate("");
    setSlot(null);
    setContact({ patientName: "", patientEmail: "", patientPhone: "" });
    setTouched({});
    setAvailability({ state: "idle", slots: [] });
    setSubmit({ kind: "idle" });
    setBookingId(null);
  }, []);

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">
        Book an appointment
      </h1>
      <p className="mt-2 text-sm text-zinc-600 sm:text-base">
        Lumen Dental — Bristol. Mon–Fri, 09:00–17:00.
      </p>

      <StepIndicator step={step} />

      {step === "service" && (
        <section aria-labelledby="step-service-heading" className="mt-6">
          <h2
            id="step-service-heading"
            ref={stepHeadingRef}
            tabIndex={-1}
            className="text-lg font-semibold text-zinc-900 outline-none"
          >
            Choose a service
          </h2>
          <ul className="mt-4 space-y-3">
            {SERVICES.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => handleServicePick(s.id)}
                  className="block w-full rounded-lg border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-sky-500 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-300"
                >
                  <span className="block text-base font-medium text-zinc-900">
                    {s.name}
                  </span>
                  <span className="mt-1 block text-sm text-zinc-600">
                    {s.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === "slot" && (
        <section aria-labelledby="step-slot-heading" className="mt-6">
          <h2
            id="step-slot-heading"
            ref={stepHeadingRef}
            tabIndex={-1}
            className="text-lg font-semibold text-zinc-900 outline-none"
          >
            Pick a date and time
          </h2>
          {selectedService && (
            <p className="mt-1 text-sm text-zinc-600">
              For: {selectedService.name}
            </p>
          )}

          <div className="mt-4">
            <label htmlFor="bk-date" className={labelClass}>
              Choose a date
            </label>
            <input
              id="bk-date"
              name="date"
              type="date"
              className={inputClass}
              min={todayYmdLondon()}
              max={maxYmd()}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSlot(null);
                if (e.target.value) {
                  setAvailability({ state: "loading", slots: [] });
                } else {
                  setAvailability({ state: "idle", slots: [] });
                }
              }}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Weekdays only. Up to 60 days from today.
            </p>
          </div>

          <div className="mt-6" aria-live="polite">
            {availability.state === "idle" && !date && (
              <p className="text-sm text-zinc-500">
                Choose a date to see available times.
              </p>
            )}
            {availability.state === "loading" && (
              <p className="text-sm text-zinc-500">Loading available times…</p>
            )}
            {availability.state === "error" && (
              <p className="text-sm text-red-600">{availability.message}</p>
            )}
            {availability.state === "ok" && availability.slots.length === 0 && (
              <p className="text-sm text-zinc-600">
                No times available on {formatDateLabel(date)}. Try another day.
              </p>
            )}
            {availability.state === "ok" && availability.slots.length > 0 && (
              <fieldset>
                <legend className="text-sm font-medium text-zinc-800">
                  Available times on {formatDateLabel(date)}
                </legend>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {availability.slots.map((iso) => (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => handleSlotPick(iso)}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:border-sky-500 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-300"
                    >
                      {formatSlotLabel(iso)}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => goToStep("service")}
              className={secondaryBtnClass}
            >
              Back
            </button>
          </div>
        </section>
      )}

      {step === "contact" && (
        <section aria-labelledby="step-contact-heading" className="mt-6">
          <h2
            id="step-contact-heading"
            ref={stepHeadingRef}
            tabIndex={-1}
            className="text-lg font-semibold text-zinc-900 outline-none"
          >
            Your details
          </h2>
          {selectedService && slot && (
            <p className="mt-1 text-sm text-zinc-600">
              {selectedService.name} on {formatDateLabel(date)} at{" "}
              {formatSlotLabel(slot)}.
            </p>
          )}

          <form
            noValidate
            onSubmit={handleSubmitContact}
            className="mt-4 space-y-4"
          >
            <ContactField
              id="bk-name"
              label="Full name"
              type="text"
              autoComplete="name"
              value={contact.patientName}
              onChange={(v) =>
                setContact((c) => ({ ...c, patientName: v }))
              }
              onBlur={() =>
                setTouched((t) => ({ ...t, patientName: true }))
              }
              errors={
                submit.kind === "field_errors" && touched.patientName
                  ? submit.fields.patientName ?? []
                  : touched.patientName
                    ? validateContactField("patientName")
                    : []
              }
            />
            <ContactField
              id="bk-email"
              label="Email"
              type="email"
              autoComplete="email"
              value={contact.patientEmail}
              onChange={(v) =>
                setContact((c) => ({ ...c, patientEmail: v }))
              }
              onBlur={() =>
                setTouched((t) => ({ ...t, patientEmail: true }))
              }
              errors={
                submit.kind === "field_errors" && touched.patientEmail
                  ? submit.fields.patientEmail ?? []
                  : touched.patientEmail
                    ? validateContactField("patientEmail")
                    : []
              }
            />
            <ContactField
              id="bk-phone"
              label="Phone"
              type="tel"
              autoComplete="tel"
              hint="UK mobile or landline, e.g. 07700 900123"
              value={contact.patientPhone}
              onChange={(v) =>
                setContact((c) => ({ ...c, patientPhone: v }))
              }
              onBlur={() =>
                setTouched((t) => ({ ...t, patientPhone: true }))
              }
              errors={
                submit.kind === "field_errors" && touched.patientPhone
                  ? submit.fields.patientPhone ?? []
                  : touched.patientPhone
                    ? validateContactField("patientPhone")
                    : []
              }
            />

            {submit.kind === "server_error" && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                <p className="font-medium">Something went wrong</p>
                <p className="mt-1">
                  We could not submit your request. Please try again.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmit({ kind: "idle" })}
                  className="mt-2 inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  Try again
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => goToStep("slot")}
                className={secondaryBtnClass}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submit.kind === "submitting"}
                className={primaryBtnClass}
              >
                {submit.kind === "submitting"
                  ? "Sending…"
                  : "Request appointment"}
              </button>
            </div>
          </form>
        </section>
      )}

      {step === "confirmed" && bookingId && (
        <section aria-labelledby="step-confirmed-heading" className="mt-6">
          <h2
            id="step-confirmed-heading"
            ref={stepHeadingRef}
            tabIndex={-1}
            className="text-2xl font-semibold text-zinc-900 outline-none"
          >
            Request received
          </h2>
          <p className="mt-3 text-base text-zinc-700">
            Thanks. We&apos;ve received your request — the practice will be in
            touch shortly.
          </p>
          <dl className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <dt className="font-medium text-zinc-700">Booking reference</dt>
            <dd className="mt-1 break-all font-mono text-zinc-900">
              {bookingId}
            </dd>
          </dl>
          <div className="mt-6">
            <button
              type="button"
              onClick={restart}
              className={secondaryBtnClass}
            >
              Book another appointment
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const labels: { key: Step; label: string }[] = [
    { key: "service", label: "Service" },
    { key: "slot", label: "Date & time" },
    { key: "contact", label: "Your details" },
  ];
  const currentIndex =
    step === "confirmed" ? labels.length : labels.findIndex((l) => l.key === step);
  return (
    <ol
      aria-label="Booking progress"
      className="mt-6 flex items-center gap-2 text-xs sm:text-sm"
    >
      {labels.map((l, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li
            key={l.key}
            aria-current={active ? "step" : undefined}
            className={[
              "flex items-center gap-1 rounded-full px-2.5 py-1 outline-none focus:ring-2 focus:ring-sky-300",
              active
                ? "bg-sky-100 text-sky-900 font-medium"
                : done
                  ? "text-sky-700"
                  : "text-zinc-500",
            ].join(" ")}
            tabIndex={0}
          >
            <span aria-hidden="true">{i + 1}.</span>
            <span>{l.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ContactField({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  onBlur,
  errors,
  hint,
}: {
  id: string;
  label: string;
  type: "text" | "email" | "tel";
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  errors: string[];
  hint?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [
    errors.length ? errorId : null,
    hint ? hintId : null,
  ]
    .filter((s): s is string => Boolean(s))
    .join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={errors.length > 0}
        aria-describedby={describedBy}
        required
      />
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-zinc-500">
          {hint}
        </p>
      )}
      <div id={errorId} aria-live="polite" className="min-h-0">
        {errors.map((msg, i) => (
          <p key={i} className={errorClass}>
            {msg}
          </p>
        ))}
      </div>
    </div>
  );
}
