import type { Metadata } from "next";
import BookingFlow from "./_components/BookingFlow";

export const metadata: Metadata = {
  title: "Book an appointment — Lumen Dental",
  description:
    "Request an appointment at Lumen Dental in Bristol. Mon–Fri, 09:00–17:00.",
};

export default function BookPage() {
  return <BookingFlow />;
}
