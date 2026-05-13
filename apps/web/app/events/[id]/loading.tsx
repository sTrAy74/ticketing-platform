export default function EventDetailLoading() {
  return (
    <article className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-stone-200 dark:bg-stone-800" />
        <div className="h-9 w-72 rounded bg-stone-200 dark:bg-stone-800" />
        <div className="h-4 w-80 rounded bg-stone-200 dark:bg-stone-800" />
      </div>
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <div className="h-28 rounded-2xl bg-stone-200 dark:bg-stone-800" />
          <div className="h-72 rounded-2xl bg-stone-200 dark:bg-stone-800" />
          <div className="h-32 rounded-2xl bg-stone-200 dark:bg-stone-800" />
        </div>
        <div className="space-y-3 lg:col-span-2">
          <div className="h-72 rounded-2xl bg-stone-200 dark:bg-stone-800" />
          <div className="h-4 w-40 rounded bg-stone-200 dark:bg-stone-800" />
        </div>
      </section>
    </article>
  );
}
