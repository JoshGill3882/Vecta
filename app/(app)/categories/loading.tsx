import { Skeleton } from "@/src/components/ui/skeleton";

/**
 * Suspense fallback for the categories route. Like the tasks fallback, this sits
 * inside the `(app)` layout's boundary, so only the content region swaps while
 * the auth check and category/task reads resolve.
 *
 * Mirrors `CategoriesView`: header over a bordered card of rows, so content
 * settles into the same frame. Row count is arbitrary — enough to fill the card
 * without implying a real total.
 */
export default function CategoriesLoading() {
  return (
    <section aria-busy="true" aria-label="Loading categories">
      <header className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-[27px] w-44" />
          <Skeleton className="mt-2.5 h-[13.5px] w-64 max-w-full" />
        </div>
        {/* Stands in for the "New category" button (size lg). */}
        <Skeleton className="h-10 w-[150px] shrink-0 rounded-md" />
      </header>

      <div className="bg-card overflow-hidden rounded-[13px] border">
        {Array.from({ length: 4 }).map((_, i) => (
          // Matches CategoryRow: chip · spacer · count · edit/delete controls.
          <div
            key={i}
            className="border-border/60 flex items-center gap-3 border-b px-4 py-[13px] last:border-b-0"
          >
            <Skeleton className="h-[22px] w-28 rounded-full" />
            <span className="flex-1" />
            <Skeleton className="h-[12.5px] w-12" />
            <div className="flex gap-0.5">
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
