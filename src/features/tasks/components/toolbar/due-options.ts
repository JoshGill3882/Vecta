import { Calendar, CalendarOff, Clock, TriangleAlert, type LucideIcon } from "lucide-react";

import type { DueBucket } from "@/src/features/tasks/lib/due-date";

/** How one due-date option is shown, wherever the filter offers it. */
interface DueOption {
  /** The option's name. */
  label: string;
  /** For Overdue and Due today, the icon the card's due pill shows in that
   * state, so an option and the cards it finds look alike. */
  icon: LucideIcon;
  /** The text colour of the two options that ask for action, for the icon and
   * the label alike. Both hold 4.5:1 against the menu and the sheet. Wherever
   * a row is highlighted, the colour gives way to the row's own text, which
   * matters: the overdue red falls short of 4.5:1 against the highlight. */
  tone?: string;
}

/** Display details for each due-date option.
 *
 * Keyed by option rather than listed, so an option added to `DUE_BUCKETS`
 * fails to type-check until it is given a label and an icon here. The order
 * comes from `DUE_BUCKETS`.
 */
export const DUE_OPTIONS: Record<DueBucket, DueOption> = {
  overdue: { label: "Overdue", icon: TriangleAlert, tone: "text-destructive" },
  today: { label: "Due today", icon: Clock, tone: "text-brand-orange" },
  week: { label: "Next 7 days", icon: Calendar },
  none: { label: "No due date", icon: CalendarOff },
};
