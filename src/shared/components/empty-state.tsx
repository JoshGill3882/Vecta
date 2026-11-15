import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** A list standing in for itself when it has nothing to show: an icon, a heading, a line of text and an optional action.
 *
 * Shared by the task list and the Logs page, so an empty list looks the same
 * on every page.
 */
export function EmptyState({
  icon: Icon,
  heading,
  headingId,
  children,
  action,
}: {
  /** The icon above the heading. */
  icon: LucideIcon;
  /** What is missing, such as `No tasks yet`. */
  heading: string;
  /** An id for the heading, so focus can be sent to it. Given one, the heading can take focus. */
  headingId?: string;
  /** The line under the heading, saying why the list is empty or what fills it. */
  children: ReactNode;
  /** A control for undoing whatever emptied the list, shown below the text. */
  action?: ReactNode;
}) {
  return (
    <div className="text-text-2 px-5 py-[60px] text-center">
      <div className="bg-surface-2 text-text-3 mx-auto mb-4 flex size-14 items-center justify-center rounded-[14px] border">
        <Icon className="size-[26px]" />
      </div>
      <h2
        id={headingId}
        tabIndex={headingId === undefined ? undefined : -1}
        className="mb-1.5 text-[17px]"
      >
        {heading}
      </h2>
      <p className="text-text-3 text-sm">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
