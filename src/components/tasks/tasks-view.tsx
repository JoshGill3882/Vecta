/**
 * Tasks view — the content of the `/` route. Kept separate from page.tsx so the
 * route stays thin (auth + data fetching) while this owns the presentation.
 */
export function TasksView() {
  return (
    <section>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Tasks</h1>
        <p className="text-text-3 text-sm">Everything on your plate, grouped by status.</p>
      </div>
      <div className="border-border/70 text-text-3 rounded-[14px] border border-dashed p-12 text-center text-sm">
        No tasks yet.
      </div>
    </section>
  );
}
