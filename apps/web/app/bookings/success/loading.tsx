export default function BookingSuccessLoading() {
  return (
    <section className="mx-auto max-w-xl space-y-6 animate-pulse">
      <div className="h-9 w-64 rounded bg-stone-200 dark:bg-stone-800" />
      <div className="h-5 w-full rounded bg-stone-200 dark:bg-stone-800" />
      <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-950">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={`success-skel-${idx}`} className="flex items-center justify-between gap-4">
              <div className="h-4 w-24 rounded bg-stone-200 dark:bg-stone-800" />
              <div className="h-4 w-28 rounded bg-stone-200 dark:bg-stone-800" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
