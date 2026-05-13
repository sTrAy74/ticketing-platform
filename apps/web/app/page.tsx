import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <h1 className="text-4xl font-bold tracking-tight">Find your next event</h1>
      <p className="max-w-2xl text-lg leading-relaxed text-stone-600 dark:text-stone-300">
        Ticket prices update automatically based on time, demand, and remaining seats. Book with
        confidence knowing overselling is blocked.
      </p>
      <div className="flex flex-wrap gap-3 pt-4">
        <Link
          href="/events"
          className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-amber-500 dark:text-stone-950"
        >
          Browse events →
        </Link>
        <Link
          href="/admin"
          className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 dark:border-stone-700 dark:text-stone-200"
        >
          Time controls
        </Link>
      </div>
      <aside className="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-4 text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-900/70 dark:text-stone-300">
        <p className="font-semibold text-stone-800 dark:text-stone-100">Quick tips</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Open <strong className="font-medium">Time controls</strong> to jump to key moments like
            1 week before or tomorrow and watch the price change.
          </li>
          <li>
            Make a few bookings quickly to trigger demand-based pricing.
          </li>
          <li>Check My bookings to compare the price you paid vs the current price.</li>
        </ul>
      </aside>
    </section>
  );
}
