import Link from "next/link";
import { serverApiUrl } from "../../lib/api";

type BookingItem = {
  id: string;
  eventName: string;
  eventId: string;
  quantity: number;
  unitPricePaid: { formatted: string; cents: number };
  totalPaid: { formatted: string; cents: number };
};

async function loadBookings(email: string) {
  const res = await fetch(`${serverApiUrl()}/bookings?email=${encodeURIComponent(email)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load bookings");
  const body = (await res.json()) as { bookings: BookingItem[] };
  return body.bookings;
}

async function currentPriceFor(eventId: string) {
  const res = await fetch(`${serverApiUrl()}/events/${eventId}`, { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { event: { currentPrice: { cents: number; formatted: string } } };
  return body.event.currentPrice;
}

type Props = { searchParams: Promise<{ email?: string }> };

export default async function MyBookingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const email = sp.email?.trim();

  if (!email) {
    return (
      <section className="mx-auto max-w-lg space-y-6">
        <h1 className="text-3xl font-semibold">My bookings</h1>
        <p className="text-stone-600 dark:text-stone-400">Enter the email you used when booking to view your tickets.</p>
        <form method="GET" className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-600 dark:bg-stone-900"
            />
          </label>
          <button
            type="submit"
            className="mt-3 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white dark:bg-amber-500 dark:text-stone-950"
          >
            View bookings
          </button>
        </form>
        <Link href="/events" className="text-sm font-semibold text-amber-700 underline dark:text-amber-400">
          Browse events
        </Link>
      </section>
    );
  }

  let rows: BookingItem[] = [];
  let error: string | null = null;
  try {
    rows = await loadBookings(email);
  } catch {
    error = "Please make sure the API is running.";
  }

  const enriched = await Promise.all(
    rows.map(async (b) => ({
      ...b,
      current: await currentPriceFor(b.eventId),
    })),
  );

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Bookings for {email}</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Compare the price you paid with the current live price.
        </p>
      </div>
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load bookings right now. {error}
        </p>
      ) : null}
      <ul className="space-y-4">
        {enriched.map((b) => {
          const delta =
            b.current && typeof b.unitPricePaid.cents === "number"
              ? b.current.cents - b.unitPricePaid.cents
              : null;
          return (
            <li
              key={b.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{b.eventName}</p>
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    {b.quantity} tickets · Total paid: {b.totalPaid.formatted}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-stone-500">Price per ticket at booking</p>
                  <p className="font-mono font-semibold">{b.unitPricePaid.formatted}</p>
                  {b.current ? (
                    <>
                      <p className="mt-2 text-stone-500">Current price now</p>
                      <p className="font-mono font-semibold">{b.current.formatted}</p>
                      {delta !== null ? (
                        <p className={`mt-1 text-xs ${delta > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                          {delta > 0
                            ? `Now +$${(delta / 100).toFixed(2)} per ticket`
                            : `Now -$${(Math.abs(delta) / 100).toFixed(2)} per ticket`}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
              <Link href={`/events/${b.eventId}`} className="mt-3 inline-block text-sm font-semibold text-amber-700 underline dark:text-amber-400">
                View event
              </Link>
            </li>
          );
        })}
      </ul>
      {enriched.length === 0 && !error ? (
        <p className="text-sm text-stone-600 dark:text-stone-400">No bookings yet.</p>
      ) : null}
    </section>
  );
}
