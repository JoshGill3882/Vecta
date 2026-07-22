import * as React from "react";

import { cn } from "@/src/lib/utils";

/**
 * Deviates from the shadcn default, which shrinks the text at `md:` — restore
 * that on a re-generate and it breaks: iOS Safari zooms the page when a focused
 * input's text is under 16px, and a width breakpoint is the wrong lever for it.
 * 768px is a portrait iPad, so `md:text-sm` zooms on exactly the tablet width we
 * target. `pointer-fine` keys the 14px to a mouse instead, which is what the
 * smaller text was ever really for.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 pointer-fine:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  );
}

export { Input };
