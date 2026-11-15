import {
  Bug,
  CircleAlert,
  Info,
  List,
  Lock,
  Server,
  Tag,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import type { LogLevel, LogSource } from "@/src/shared/lib/dtos/logs";

/** How a level or a source is shown: its name and its icon. */
export interface LogLabel {
  /** The name shown for it, such as `Warning`. */
  label: string;
  /** The icon shown before the name. */
  Icon: LucideIcon;
}

/** How a level's badge looks, as well as what it says. */
export interface LevelLabel extends LogLabel {
  /** The badge's text, border and tint classes. */
  className: string;
}

/** The quiet badge, for the levels that ask for nothing. */
const QUIET = "text-text-2 border-border-strong bg-surface-2";

/** Each level's badge, in order of severity. Debug and Info share the quiet
 * styling and differ by name and icon; Warning and Error are tinted so they
 * stand out in a page of routine entries.
 *
 * The tints are mixed into the card's colour rather than laid over the row, so
 * a badge looks the same on an open row as on a closed one. Laid over an open
 * row, the Error tint would take its text below 4.5:1. */
export const LEVEL_LABELS: Record<LogLevel, LevelLabel> = {
  debug: { label: "Debug", Icon: Bug, className: QUIET },
  info: { label: "Info", Icon: Info, className: QUIET },
  warn: {
    label: "Warning",
    Icon: TriangleAlert,
    className:
      "text-brand-orange border-brand-orange/35 bg-[color-mix(in_oklab,var(--brand-orange)_12%,var(--card))]",
  },
  error: {
    label: "Error",
    Icon: CircleAlert,
    className:
      "text-destructive border-destructive/40 bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))]",
  },
};

/** Each source's name and icon. The icons are the ones the tabs use for Tasks
 * and Categories, so a source reads as the page its entries came from. */
export const SOURCE_LABELS: Record<LogSource, LogLabel> = {
  auth: { label: "Auth", Icon: Lock },
  tasks: { label: "Tasks", Icon: List },
  categories: { label: "Categories", Icon: Tag },
  system: { label: "System", Icon: Server },
};
