import { entryCount, logDate, runTime } from "@/src/features/logs/lib/log-format";
import type { RetentionStatusDTO } from "@/src/shared/lib/dtos/settings";

import { RemoveNowButton } from "./remove-now-button";
import { RetentionChoice } from "./retention-choice";

/** Says what the next nightly run will remove, with Remove now when there is anything to. */
function RetentionOutlook({ status }: { status: RetentionStatusDTO }) {
  if (status.cutoff === null) return <span>Entries are kept until you purge them.</span>;

  const cutoff = <time dateTime={status.cutoff}>{logDate(status.cutoff)}</time>;
  if (status.dueForRemoval === 0) return <span>Nothing is older than {cutoff} yet.</span>;

  return (
    <>
      <span>
        <strong className="text-brand-orange font-semibold">
          {entryCount(status.dueForRemoval)}
        </strong>{" "}
        older than {cutoff} will be removed tonight.
      </span>
      <RemoveNowButton />
    </>
  );
}

/** The Logs page's Retention card: how long entries are kept, what is due to go, and the last run.
 *
 * Dates and times are written in the server's time zone, as the rest of the
 * page's are, and the nightly run keeps the server's clock too. `now` is the
 * moment the rest of the page takes "today" from.
 */
export function RetentionCard({ status, now }: { status: RetentionStatusDTO; now: Date }) {
  const lastRun = status.lastAgeOut;

  return (
    <section
      aria-labelledby="retention-heading"
      className="bg-card border-border mt-1 mb-[18px] rounded-[13px] border"
    >
      <div className="grid items-center gap-x-12 gap-y-4 px-4 pt-5 pb-[22px] sm:px-6 sm:pt-6 sm:pb-[26px] min-[900px]:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div>
          <h2 id="retention-heading" className="text-[14.5px] font-semibold tracking-[-0.01em]">
            Retention
          </h2>
          <p className="text-text-3 mt-[3px] text-[13.5px]">
            Entries older than this are deleted automatically every night at 03:00.
          </p>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-2.5">
          <RetentionChoice days={status.logRetentionDays} />
          <div className="text-text-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
            <RetentionOutlook status={status} />
          </div>
          {lastRun && (
            <p className="text-text-3 text-[13px]">
              Last run removed {entryCount(lastRun.removed)} at{" "}
              <time dateTime={lastRun.ranAt}>{runTime(lastRun.ranAt, now)}</time>.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
