import { cn } from "@/src/lib/utils";

/**
 * A single shimmering placeholder block. The shadcn `skeleton` primitive,
 * retinted to the app's own `surface-2` token so it reads correctly on the dark
 * theme without pulling in the light-theme `accent` default.
 *
 * Deliberately just a pulsing box: the issue calls for skeletons over heavy
 * animation, and `animate-pulse` costs nothing but an opacity keyframe.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-surface-2 animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
