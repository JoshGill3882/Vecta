import { Skeleton } from "@/src/components/ui/skeleton";
import { TASK_STATUSES } from "@/src/lib/task-status";

/**
 * Suspense fallback for the tasks route. Next wraps `page.tsx` in a boundary
 * nested inside the `(app)` layout, so the top bar stays put and only this
 * `<main>` region swaps in while `requireSession()` and the task/category reads
 * resolve.
 *
 * It mirrors `TasksView`'s DOM — header, then the three status sections — so the
 * real content lands into the same shape and the page doesn't jump when data
 * arrives. Nothing here is data-driven; the counts and cards are stand-ins.
 */
export default function TasksLoading() {
  return (
    <section aria-busy="true" aria-label="Loading tasks">
      <header className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-[27px] w-40" />
          <Skeleton className="mt-2.5 h-[13.5px] w-56" />
        </div>
        {/* Stands in for the "New task" button (size lg). */}
        <Skeleton className="h-10 w-[132px] shrink-0 rounded-md" />
      </header>

      {TASK_STATUSES.map((status, i) => (
        <div key={status.id} className="mb-3.5">
          {/* Matches the CollapsibleTrigger row: chevron · dot · label · count. */}
          <div className="flex items-center gap-2.5 px-0.5 py-2">
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton className="size-2 rounded-full" />
            <Skeleton className="h-[14.5px] w-24" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>

          {/* A couple of card placeholders under the first two sections; the
              last stays empty so the whole viewport isn't a wall of shimmer. */}
          {i < 2 && (
            <div className="mt-2 flex flex-col gap-2.5">
              {Array.from({ length: i === 0 ? 3 : 2 }).map((_, j) => (
                <CardSkeleton key={j} />
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

/** One task-card placeholder, matching `TaskCard`'s frame and two rows. */
function CardSkeleton() {
  return (
    <div className="bg-card rounded-[12px] border p-4">
      <div className="flex items-start justify-between gap-2.5">
        <Skeleton className="h-[21px] w-2/3" />
        <Skeleton className="size-7 shrink-0 rounded-md" />
      </div>
      <div className="mt-[13px] flex items-center gap-2">
        <Skeleton className="h-[22px] w-20 rounded-full" />
        <Skeleton className="h-[22px] w-24 rounded-full" />
        <span className="flex-1" />
        <Skeleton className="h-[11.5px] w-12" />
      </div>
    </div>
  );
}
