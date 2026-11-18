"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";

import type { LogPage } from "@/src/server/services/logs";
import { Button } from "@/src/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/shared/components/ui/dialog";
import { useServerAction } from "@/src/shared/hooks/use-server-action";
import type { LogFilters, LogPurge } from "@/src/shared/lib/schemas/logs";
import { purgeLogsAction } from "@/src/features/logs/actions";
import { entryCount } from "@/src/features/logs/lib/log-format";
import { logExportHref, logsHref } from "@/src/features/logs/lib/log-links";

/** What a purge deletes: the entries the filters match, or every entry. */
type Scope = LogPurge["scope"];

/** One of the confirmation's choices: a radio naming what it purges, and how many.
 *
 * Disabled, it says why in place of the count.
 */
function ScopeChoice({
  value,
  title,
  note,
  checked,
  disabled = false,
  onSelect,
}: {
  value: Scope;
  title: string;
  /** The count, or why the choice is unavailable. */
  note: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: (scope: Scope) => void;
}) {
  return (
    <label className="border-border-strong bg-surface-2 has-checked:border-destructive has-checked:bg-destructive/6 flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3 py-2.5 has-disabled:cursor-not-allowed has-disabled:opacity-55">
      <input
        type="radio"
        name="purge-scope"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="accent-destructive mt-[3px]"
      />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block text-sm font-medium">{title}</span>
        <span className="text-text-3 block text-[12.5px]">{note}</span>
      </span>
    </label>
  );
}

/** Downloads the entries a purge would delete as JSON, or shows disabled when there are none.
 *
 * A plain link marked `download`, as the Export menu's are, so the browser
 * saves the file and the confirmation stays open.
 */
function ExportFirstButton({
  href,
}: {
  /** The export's address, or null when there is nothing to export. */
  href: string | null;
}) {
  const label = (
    <>
      <Download aria-hidden />
      Export these first
    </>
  );
  if (href === null) {
    return (
      <Button variant="ghost" disabled className="text-text-2">
        {label}
      </Button>
    );
  }
  return (
    <Button variant="ghost" asChild className="text-text-2">
      <a href={href} download>
        {label}
      </a>
    </Button>
  );
}

/** The Logs page's Purge button, and the confirmation it opens.
 *
 * The confirmation offers the entries the filters match, chosen by default
 * while a filter is on, or every entry, each with the count the page read.
 * The purge deletes only entries written up to the moment those counts were
 * read, so the number on its button is the number deleted. After a purge of
 * the filtered entries the filters are cleared, since they now match nothing.
 *
 * A click outside closes it, which an alert dialog's primitive never allows,
 * so this is a dialog given the alert dialog's role. It cannot be closed
 * while the purge runs.
 *
 * Below 520px the button shrinks to its icon, as Export's does, with its
 * label kept for a screen reader and `title` naming it for a pointer.
 */
export function PurgeDialog({ page, filters }: { page: LogPage; filters: LogFilters }) {
  const runAction = useServerAction();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const filtered = filters.level.length > 0 || filters.source.length > 0;
  const [scope, setScope] = useState<Scope>("all");

  const count = scope === "all" ? page.total : page.matching;
  const scoped =
    scope === "all" ? { level: [], source: [] } : { level: filters.level, source: filters.source };

  /** Opens the confirmation on the default choice, whatever was chosen last time. */
  function openConfirmation() {
    setScope(filtered ? "filtered" : "all");
    setOpen(true);
  }

  /** Runs the purge, closing the confirmation only once it has worked. */
  function purge() {
    startTransition(async () => {
      const request = { scope, ...scoped, readAt: page.readAt };
      const removed = await runAction(purgeLogsAction(request), {
        success: "Log entries purged",
      });
      if (removed === null) return;
      setOpen(false);
      if (scope === "filtered") router.push(logsHref({ level: [], source: [] }));
    });
  }

  return (
    <>
      <Button
        variant="destructive"
        size="lg"
        title="Purge log entries"
        disabled={page.total === 0}
        onClick={openConfirmation}
        className="max-[520px]:size-11 max-[520px]:gap-0 max-[520px]:px-0"
      >
        <Trash2 aria-hidden />
        <span className="max-[520px]:sr-only">Purge…</span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <DialogContent role="alertdialog" showCloseButton={false} className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="bg-destructive/10 text-destructive mb-1 flex size-9 items-center justify-center rounded-[10px]">
              <Trash2 aria-hidden className="size-[18px]" />
            </div>
            <DialogTitle>Purge log entries</DialogTitle>
            <DialogDescription>
              Purged entries are deleted permanently. A single entry recording the purge is kept.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">What to purge</legend>
            <ScopeChoice
              value="filtered"
              title="Entries matching the current filters"
              note={filtered ? entryCount(page.matching) : "No filters are on"}
              checked={scope === "filtered"}
              disabled={!filtered}
              onSelect={setScope}
            />
            <ScopeChoice
              value="all"
              title="Every log entry"
              note={entryCount(page.total)}
              checked={scope === "all"}
              onSelect={setScope}
            />
          </fieldset>

          <DialogFooter className="flex-row flex-wrap sm:justify-between">
            <ExportFirstButton
              href={count > 0 ? logExportHref(scoped, "json", page.readAt) : null}
            />
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button variant="destructive" disabled={pending || count === 0} onClick={purge}>
                {pending ? "Purging…" : `Purge ${entryCount(count)}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
