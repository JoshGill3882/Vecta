"use client";

import type { ComponentProps } from "react";
import { ChevronDownIcon, type LucideIcon } from "lucide-react";

import { Button } from "@/src/shared/components/ui/button";

/** The button that opens one of the toolbar's filter menus.
 *
 * Shared by every filter so they read as one group: outlined while the filter
 * is off, filled with a count once anything is selected. The count is hidden
 * from screen readers and spoken as words instead, so the button is announced
 * as "Due, 2 selected" rather than "Due 2".
 *
 * Every other prop reaches the button, which is what lets a menu trigger wrap
 * it with `asChild` and attach its ref and handlers.
 */
export function FilterTrigger({
  icon: Icon,
  label,
  count,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "children"> & {
  icon: LucideIcon;
  label: string;
  count: number;
}) {
  return (
    <Button variant={count > 0 ? "secondary" : "outline"} {...props}>
      <Icon />
      {label}
      {count > 0 && (
        <>
          <span
            aria-hidden
            className="bg-foreground/10 min-w-[18px] rounded-full px-1.5 text-[11px] leading-[18px] font-semibold"
          >
            {count}
          </span>
          <span className="sr-only">, {count} selected</span>
        </>
      )}
      <ChevronDownIcon className="text-text-3 transition-transform duration-150 group-aria-expanded/button:rotate-180" />
    </Button>
  );
}
