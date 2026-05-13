export default function EventsLoading() {
  return (
    <section className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-9 w-56 rounded bg-stone-200 dark:bg-stone-800" />
        <div className="h-4 w-96 max-w-full rounded bg-stone-200 dark:bg-stone-800" />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <li
            key={`event-skel-${idx}`}
            className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950"
          >
            <div className="h-6 w-2/3 rounded bg-stone-200 dark:bg-stone-800" />
            <div className="mt-3 h-4 w-1/2 rounded bg-stone-200 dark:bg-stone-800" />
            <div className="mt-2 h-4 w-1/3 rounded bg-stone-200 dark:bg-stone-800" />
            <div className="mt-6 h-4 w-1/2 rounded bg-stone-200 dark:bg-stone-800" />
          </li>
        ))}
      </ul>
    </section>
  );
}
