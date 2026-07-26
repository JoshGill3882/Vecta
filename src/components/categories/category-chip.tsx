import { cn } from "@/src/lib/utils";

/**
 * A category rendered as a GitHub-style label: coloured dot, name, and a tinted
 * pill derived from the category's own colour. Lives in `src/components` rather
 * than beside the categories route because task cards and the task dialog show
 * the same chip.
 *
 * The colour is per-row data, so it has to be an inline style — Tailwind can
 * only emit classes it can see at build time. The hex suffixes are alpha:
 * `55` ≈ 33% for the border, `1f` ≈ 12% for the background tint.
 */
export function CategoryChip({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] rounded-full border py-[5px] pr-[11px] pl-[9px] text-[12.5px] leading-none font-medium whitespace-nowrap",
        className
      )}
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}1f` }}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}
