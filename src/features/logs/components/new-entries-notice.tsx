"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";

import { Button } from "@/src/shared/components/ui/button";
import type { LogFilters } from "@/src/shared/lib/schemas/logs";
import { formatCount } from "@/src/features/logs/lib/log-format";
import { logNewCountHref, logsHref } from "@/src/features/logs/lib/log-links";

/** How long the notice waits between checks for new entries, in milliseconds.
 *
 * Often enough that something done in another tab shows up while it is still
 * in mind, and seldom enough that a page left open costs one small count a
 * quarter of a minute.
 */
export const CHECK_INTERVAL = 15_000;

/** Finds the list's first entry, which focus moves to once Show is pressed. */
const FIRST_ENTRY = "[data-log-list] summary";

/** Writes how many new entries there are, such as `1 new entry` or `12 new entries`.
 *
 * @param count How many, at least 1.
 * @returns The count with its noun.
 */
function newEntries(count: number): string {
  return `${formatCount(count)} ${count === 1 ? "new entry" : "new entries"}`;
}

/** Asks how many entries matching the filters have been written since the page read its counts, while the tab is visible.
 *
 * Asks every `CHECK_INTERVAL` while the tab is visible, none while it is
 * hidden, and once straight away when it is shown again, since that is when
 * the reader comes back to look. A check that fails is left to the next one,
 * unless it is answered as signed out, which no later check would change.
 *
 * @param href The address to ask, which carries the filters and the moment.
 * @param onCount Called with the count each check answers.
 */
function useNewEntryChecks(href: string, onCount: (count: number) => void): void {
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setInterval> | undefined;
    let signedOut = false;

    /** Stops the checks every interval, leaving one already asked to finish. */
    function stop() {
      clearInterval(timer);
      timer = undefined;
    }

    /** Starts a check every interval, unless one is running or the session has ended. */
    function start() {
      if (!signedOut && timer === undefined) timer = setInterval(check, CHECK_INTERVAL);
    }

    /** Asks for the count once, and passes on what it says. */
    async function check() {
      try {
        const response = await fetch(href, { cache: "no-store", signal: controller.signal });
        if (response.status === 401) {
          signedOut = true;
          stop();
          return;
        }
        if (!response.ok) return;
        const { count } = await response.json();
        if (typeof count === "number") onCount(count);
      } catch {
        // Offline, a server restarting, or the page moving on: the next check
        // asks again, so nothing is shown for it.
      }
    }

    /** Stops the checks while the tab is hidden, and checks at once when it is shown. */
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stop();
      } else if (!signedOut) {
        void check();
        start();
      }
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [href, onCount]);
}

/** The Logs page's new-entries notice: how many entries matching the filters have been written since the page loaded, with a Show button.
 *
 * The new entries are held back rather than slipped into the list, so the
 * rows being read never move, and the counts that Export and Purge act on
 * still describe what is on screen. Show loads the first page of the same
 * filters afresh, which brings in the new entries and a new `readAt`, and
 * with it a count back at nothing.
 *
 * The live region is always rendered, empty while there is nothing new, so a
 * screen reader announces the notice when it appears without focus moving.
 * The Show button disappears once pressed, so focus moves to the list's first
 * entry, the newest, rather than being lost with it.
 */
export function NewEntriesNotice({
  filters,
  readAt,
  page,
}: {
  /** The page's filters, which the count follows. */
  filters: LogFilters;
  /** When the page's counts were read, as an ISO 8601 timestamp. */
  readAt: string;
  /** Which page is shown, from 1. */
  page: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [count, setCount] = useState(0);
  const [seenReadAt, setSeenReadAt] = useState(readAt);
  const showing = useRef(false);

  // A new `readAt` means the page has been read again, by Show, a filter, a
  // purge or any other change it makes, so what was new is on screen now.
  if (readAt !== seenReadAt) {
    setSeenReadAt(readAt);
    setCount(0);
  }

  useNewEntryChecks(logNewCountHref(filters, readAt), setCount);

  useEffect(() => {
    if (!showing.current) return;
    showing.current = false;
    document.querySelector<HTMLElement>(FIRST_ENTRY)?.focus();
  }, [readAt]);

  /** Loads the first page of the same filters, with the new entries in it. */
  function show() {
    showing.current = true;
    startTransition(() => {
      if (page === 1) router.refresh();
      else router.push(logsHref({ ...filters, page: 1 }));
    });
  }

  return (
    <div role="status">
      {count > 0 && (
        <div className="border-primary/35 bg-primary/10 text-foreground mb-3 flex items-center gap-2 rounded-[10px] border py-[5px] pr-[5px] pl-3 text-[13.5px]">
          <ArrowUp aria-hidden className="text-primary size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 font-medium">{newEntries(count)}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={show}
            className="pointer-coarse:px-3.5"
          >
            Show
          </Button>
        </div>
      )}
    </div>
  );
}
