import Link from "next/link";
import { serverApiUrl } from "../../lib/api";

type EventPayload = {
  id: string;
  name: string;
  date: string;
  venue: string;
  currentPrice: { formatted: string; cents: number };
  availability: number;
};

async function fetchEvents(base: string): Promise<EventPayload[]> {
  const res = await fetch(`${base}/events`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed listing events (${res.status})`);
  const body = (await res.json()) as { events: EventPayload[] };
  return body.events;
}

export default async function EventsPage() {
  const base = serverApiUrl();
  let list: EventPayload[] = [];
  let error: string | null = null;
  try {
    list = await fetchEvents(base);
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Unknown error";
    error = `We couldn't load events right now. ${detail}`;
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Upcoming events</h1>
        <p className="text-stone-600 dark:text-stone-400">
          Live prices update based on time, demand, and remaining seats.
        </p>
      </div>
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2">
        {list.map((event) => (
          <li
            key={event.id}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link href={`/events/${event.id}`} className="text-xl font-semibold hover:underline">
                  {event.name}
                </Link>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{event.venue}</p>
                <p className="text-[13px] text-stone-500 dark:text-stone-500">
                  {new Date(event.date).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span className="text-right font-mono text-sm text-emerald-700 dark:text-emerald-400">
                {event.currentPrice.formatted}
              </span>
            </div>
            <p className="mt-4 text-[13px] text-stone-600 dark:text-stone-400">
              {event.availability === 0 ? (
                <span className="text-red-700 dark:text-red-400">Sold out</span>
              ) : (
                <>{event.availability} tickets remaining</>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
