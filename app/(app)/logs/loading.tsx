import { Skeleton } from "@/src/shared/components/ui/skeleton";

/** Suspense fallback for the Logs route.
 *
 * Like the other routes' fallbacks, this sits inside the `(app)` layout's
 * boundary, so only the content region swaps while the auth check and the log
 * read resolve. Mirrors `LogsView`'s header, so the heading settles into the
 * same place.
 */
export default function LogsLoading() {
  return (
    <section aria-busy="true" aria-label="Loading logs">
      <header className="mb-[18px]">
        <Skeleton className="h-[27px] w-24" />
        <Skeleton className="mt-2.5 h-[13.5px] w-56 max-w-full" />
      </header>
    </section>
  );
}
