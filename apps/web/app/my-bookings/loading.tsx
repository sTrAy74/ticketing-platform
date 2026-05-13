export default function MyBookingsLoading() {
  return (
    <section className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-9 w-72 rounded bg-stone-200 dark:bg-stone-800" />
        <div className="h-4 w-96 max-w-full rounded bg-stone-200 dark:bg-stone-800" />
      </div>
      <ul className="space-y-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <li
            key={`booking-skel-${idx}`}
            className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-6 w-56 rounded bg-stone-200 dark:bg-stone-800" />
                <div className="h-4 w-64 rounded bg-stone-200 dark:bg-stone-800" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-stone-200 dark:bg-stone-800" />
                <div className="h-5 w-20 rounded bg-stone-200 dark:bg-stone-800" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
