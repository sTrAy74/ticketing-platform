import Link from "next/link";
import { notFound } from "next/navigation";
import BookingForm from "../../../components/BookingForm";
import EventPriceTicker from "../../../components/EventPriceTicker";
import { serverApiUrl } from "../../../lib/api";

type BreakdownEntry = Record<string, number | Record<string, number>>;

async function fetchEvent(id: string) {
  const res = await fetch(`${serverApiUrl()}/events/${id}`, { cache: "no-store" });
  if (res.status === 404) return { kind: "not-found" as const };
  if (!res.ok) throw new Error(`Failed fetching event detail (${res.status})`);
  return (await res.json()) as {
    kind?: never;
    event: {
      id: string;
      name: string;
      venue: string;
      description: string;
      date: string;
      remaining: number;
      basePrice: { formatted: string; cents: number };
      currentPrice: { formatted: string; cents: number };
      breakdown: BreakdownEntry;
    };
    simTime: Record<string, unknown> | null;
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let bundle: Awaited<ReturnType<typeof fetchEvent>>;
  try {
    bundle = await fetchEvent(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown request error";
    return (
      <article className="space-y-4">
        <h1 className="text-2xl font-semibold">We could not load this event</h1>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Please try again in a moment. {message}
        </p>
        <Link href="/events" className="text-sm text-stone-600 underline-offset-4 hover:underline dark:text-stone-400">
          ← Back to all events
        </Link>
      </article>
    );
  }
  if ("kind" in bundle && bundle.kind === "not-found") notFound();

  const evt = bundle.event;
  const bd = evt.breakdown as {
    weightedSum?: number;
    computation?: string;
    weights?: Record<string, number>;
    adjustments?: {
      time: number;
      demand: number;
      inventory: number;
      weighted?: Record<string, number>;
    };
  };

  return (
    <article className="space-y-8">
      <div className="space-y-2">
        <Link href="/events" className="text-sm text-stone-600 underline-offset-4 hover:underline dark:text-stone-400">
          ← All events
        </Link>
        <h1 className="text-3xl font-semibold">{evt.name}</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {evt.venue} · {new Date(evt.date).toLocaleString()}
        </p>
      </div>
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <EventPriceTicker eventId={id} />
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm shadow-sm dark:border-stone-800 dark:bg-stone-950">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">How this price is calculated</h2>
            <ul className="mt-4 space-y-2 text-[13px]">
              <li className="flex justify-between gap-4">
                <span>Base price</span>
                <strong>{evt.basePrice.formatted}</strong>
              </li>
              {bd.adjustments ? (
                <>
                  <li className="flex justify-between gap-4">
                    <span>Time-based adjustment</span>
                    <strong>+{(bd.adjustments.time * 100).toFixed(2)}%</strong>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>Demand adjustment (last hour)</span>
                    <strong>+{(bd.adjustments.demand * 100).toFixed(2)}%</strong>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>Low-inventory adjustment</span>
                    <strong>+{(bd.adjustments.inventory * 100).toFixed(2)}%</strong>
                  </li>
                </>
              ) : null}
              <li className="flex justify-between gap-4 border-t border-dashed pt-4 text-[12px] text-stone-500 dark:border-stone-800">
                <span>Total adjustment multiplier</span>
                <span>{typeof bd.weightedSum === "number" ? bd.weightedSum.toFixed(4) : "-"}</span>
              </li>
              {bd.weights ? (
                <li className="rounded-lg bg-stone-50 px-3 py-2 text-[11px] text-stone-600 dark:bg-stone-900 dark:text-stone-300">
                  Rule weights: · time {bd.weights.time} · demand {bd.weights.demand} · inventory{" "}
                  {bd.weights.inventory}
                </li>
              ) : null}
              {typeof bd.computation === "string" ? (
                <li className="font-mono text-[11px] text-stone-500">{bd.computation}</li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm leading-relaxed dark:border-stone-800 dark:bg-stone-950">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">About</h2>
            <p className="mt-3 text-[15px] text-stone-700 dark:text-stone-300">{evt.description}</p>
          </div>
        </div>
        <div className="space-y-3 lg:col-span-2">
          <BookingForm eventId={id} />
          <p className="text-[12px] text-stone-500 dark:text-stone-400">
            {evt.remaining <= 0
              ? "This event is sold out."
              : `Only ${evt.remaining} tickets left.`}
          </p>
        </div>
      </section>
    </article>
  );
}
