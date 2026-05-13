"use client";

import { useActionState } from "react";
import { createBooking } from "../app/actions/booking";

export default function BookingForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(createBooking, null);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900"
    >
      <div>
        <p className="text-sm font-semibold">Book tickets</p>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Enter your email and number of tickets.
        </p>
      </div>
      <input type="hidden" name="eventId" value={eventId} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          name="userEmail"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          disabled={pending}
          className="rounded-lg border border-stone-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70 dark:border-stone-600 dark:bg-stone-950"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Quantity
        <select
          name="quantity"
          defaultValue={1}
          disabled={pending}
          className="rounded-lg border border-stone-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70 dark:border-stone-600 dark:bg-stone-950"
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-stone-900 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-500 dark:text-stone-950"
      >
        {pending ? "Booking..." : "Book now"}
      </button>
      {state?.message ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
