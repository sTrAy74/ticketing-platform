import Link from "next/link";
import { serverApiUrl } from "../../../lib/api";

type Props = {
  searchParams: Promise<{ [k: string]: string | undefined }>;
};

type EventSummary = {
  name: string;
  currentPriceCents: number | null;
};

async function eventSummary(eventId?: string): Promise<EventSummary> {
  if (!eventId) return { name: "Recorded event", currentPriceCents: null };
  const res = await fetch(`${serverApiUrl()}/events/${eventId}`, { cache: "no-store" });
  if (!res.ok) return { name: "Recorded event", currentPriceCents: null };
  const payload = await res.json();
  const name = typeof payload.event?.name === "string" ? payload.event.name : "Recorded event";
  const currentPriceCents =
    typeof payload.event?.currentPrice?.cents === "number" ? payload.event.currentPrice.cents : null;
  return { name, currentPriceCents };
}

export default async function BookingSuccessPage({ searchParams }: Props) {
  const sp = await searchParams;
  const total = Number(sp.total ?? 0);
  const unit = Number(sp.unit ?? 0);
  const quantity = Number(sp.quantity ?? 0);
  const email = decodeURIComponent(sp.email ?? "");
  const eventId = sp.eventId;
  const summary = await eventSummary(eventId);
  const priceDelta = summary.currentPriceCents !== null && unit > 0 ? summary.currentPriceCents - unit : null;

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-semibold">Booking confirmed</h1>
      <p className="text-stone-600 dark:text-stone-400">
        Your booking is saved. Here is a quick summary of what you paid and what the ticket costs right now.
      </p>
      <dl className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white p-6 text-sm dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-950">
        <Detail label="Event" value={summary.name} />
        <Detail label="Email" value={email || "-"} />
        <Detail label="Tickets" value={quantity ? String(quantity) : "-"} />
        <Detail label="Price per ticket at booking" value={unit ? `$${(unit / 100).toFixed(2)}` : "-"} />
        <Detail label="Total paid" value={total ? `$${(total / 100).toFixed(2)}` : "-"} />
        <Detail
          label="Current ticket price"
          value={summary.currentPriceCents !== null ? `$${(summary.currentPriceCents / 100).toFixed(2)}` : "-"}
        />
        <Detail
          label="Difference from booking price"
          value={
            priceDelta === null
              ? "-"
              : priceDelta === 0
                ? "No change"
                : `${priceDelta > 0 ? "+" : "-"}$${(Math.abs(priceDelta) / 100).toFixed(2)} per ticket`
          }
        />
      </dl>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/events" className="font-semibold text-amber-700 underline dark:text-amber-400">
          Back to events
        </Link>
        {email ? (
          <Link
            href={`/my-bookings?email=${encodeURIComponent(email)}`}
            className="font-semibold text-stone-800 underline dark:text-stone-200"
          >
            Open my bookings
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-stone-500 dark:text-stone-400">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
