import type { LogLevel } from "@/src/shared/lib/dtos/logs";
import { cn } from "@/src/shared/lib/utils";

import { LEVEL_LABELS } from "./log-meta";

/** An entry's level as a small pill with its icon and name. */
export function LevelBadge({ level }: { level: LogLevel }) {
  const { label, Icon, className } = LEVEL_LABELS[level];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] rounded-full border py-1 pr-[9px] pl-[7px] text-xs leading-none font-medium whitespace-nowrap",
        className
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
