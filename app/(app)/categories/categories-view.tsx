/**
 * Categories view — the content of the `/categories` route. See the note in
 * tasks-view.tsx: the page stays thin, this owns the presentation.
 */
export function CategoriesView() {
  return (
    <section>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Categories</h1>
        <p className="text-text-3 text-sm">Colour-coded labels you can assign to tasks.</p>
      </div>
      <div className="border-border/70 text-text-3 rounded-[14px] border border-dashed p-12 text-center text-sm">
        No categories yet.
      </div>
    </section>
  );
}
