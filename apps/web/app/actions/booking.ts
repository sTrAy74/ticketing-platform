"use server";

import { redirect } from "next/navigation";
import { serverApiUrl } from "../../lib/api";

export type BookingFormState = { message: string } | null;

export async function createBooking(
  _: BookingFormState,
  fd: FormData,
): Promise<BookingFormState> {
  const eventId = String(fd.get("eventId") ?? "");
  const userEmail = String(fd.get("userEmail") ?? "").trim();
  const quantity = Math.floor(Number(fd.get("quantity") ?? "1"));

  if (!eventId) return { message: "We couldn't identify this event. Please reopen the event page and try again." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail))
    return { message: "Please enter a valid email address." };
  if (!(quantity >= 1)) return { message: "Please select at least one ticket." };

  const res = await fetch(`${serverApiUrl()}/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventId, userEmail, quantity }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      message:
        typeof body?.error === "string"
          ? body.error
          : "We couldn't complete your booking right now. Please try again.",
    };
  }

  const total = body.booking.totalPaid?.cents ?? 0;
  const unit = body.booking.unitPricePaid?.cents ?? 0;
  redirect(
    `/bookings/success?eventId=${encodeURIComponent(eventId)}&email=${encodeURIComponent(userEmail)}&quantity=${quantity}&total=${total}&unit=${unit}`,
  );
}
