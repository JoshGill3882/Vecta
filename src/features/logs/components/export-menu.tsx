import { ChevronDown, Download, FileText } from "lucide-react";

import type { ExportFormat } from "@/src/server/log-export";
import type { LogPage } from "@/src/server/services/logs";
import { Button } from "@/src/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/src/shared/components/ui/dropdown-menu";
import { isFiltered, type LogFilters } from "@/src/shared/lib/schemas/logs";
import { entryCount } from "@/src/features/logs/lib/log-format";
import { logExportHref } from "@/src/features/logs/lib/log-links";

/** The formats the menu offers, each with what it suits. */
const CHOICES: { format: ExportFormat; label: string; suits: string }[] = [
  { format: "csv", label: "CSV", suits: "Spreadsheets" },
  { format: "json", label: "JSON", suits: "Full detail" },
];

/** The Logs page's Export menu: downloads the entries the filters match, as CSV or JSON.
 *
 * Each choice is a plain link to the export route, marked `download`, so the
 * browser saves the file it answers with and the page stays where it is. The
 * menu says what an export will hold before it is picked, and is disabled
 * when that is nothing.
 *
 * Below 520px the button shrinks to its icon, so it stays on the heading's
 * row rather than wrapping under it. Its label is hidden visually rather than
 * removed, so a screen reader still names it, and `title` names it for a
 * pointer.
 */
export function ExportMenu({ page, filters }: { page: LogPage; filters: LogFilters }) {
  const filtered = isFiltered(filters);
  const count = entryCount(page.matching);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={page.matching === 0}>
        <Button
          variant="outline"
          size="lg"
          title="Export"
          className="max-[520px]:size-11 max-[520px]:gap-0 max-[520px]:px-0"
        >
          <Download aria-hidden />
          <span className="max-[520px]:sr-only">Export</span>
          <ChevronDown aria-hidden className="text-text-3 size-[13px] max-[520px]:hidden" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[236px]">
        <DropdownMenuLabel className="text-text-3 font-normal">
          {filtered ? `The ${count} matching your filters` : `All ${count}`}
        </DropdownMenuLabel>
        {CHOICES.map(({ format, label, suits }) => (
          <DropdownMenuItem key={format} asChild>
            <a href={logExportHref(filters, format)} download>
              <FileText aria-hidden className="text-text-3" />
              {label}
              <span className="text-text-3 ml-auto text-xs">{suits}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
