import { Pencil } from "lucide-react";

import { CategoryChip } from "@/src/components/categories/category-chip";
import { StatusBadge } from "@/src/components/tasks/status-badge";
import { Button } from "@/src/components/ui/button";
import type { CategoryDTO } from "@/src/lib/dtos/categories";
import type { TaskDTO } from "@/src/lib/dtos/tasks";
import { relativeTime } from "@/src/lib/relative-time";

/**
 * Read/view mode — the modal's default state for an existing task, and where a
 * save lands. The list card carries no description preview, so this is the one
 * place a task's Markdown description is shown. The Edit button hands control to
 * the form; the header (with its title and close affordance) is the dialog's.
 */
export function TaskView({
  task,
  category,
  onEdit,
  onClose,
}: {
  task: TaskDTO;
  category?: CategoryDTO;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-[18px]">
        <div className="mb-[18px] flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          {category && <CategoryChip name={category.name} color={category.color} />}
          <span className="flex-1" />
          {/* Same clock-derived timestamp as the card, so the server and client
              renders can differ by a tick — suppress that one warning. */}
          <time
            dateTime={task.updatedAt}
            className="text-text-faint text-[11.5px]"
            suppressHydrationWarning
          >
            {relativeTime(task.updatedAt)}
          </time>
        </div>

        <p className="text-text-2 mb-[7px] text-[12.5px] font-medium">Description</p>
        {task.description.trim() ? (
          // TEMPORARY passthrough: descriptions are Markdown, but this renders
          // them as escaped plain text (React escapes children, so nothing here
          // can inject). The sanitised react-markdown + remark-gfm + rehype-
          // sanitize renderer is the next piece of #24 and replaces this block.
          // Never reach for dangerouslySetInnerHTML on this content.
          <div className="text-[14px] leading-[1.6] break-words whitespace-pre-wrap">
            {task.description}
          </div>
        ) : (
          <p className="text-text-faint text-[14px] italic">No description.</p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t px-[18px] py-3.5">
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button type="button" onClick={onEdit}>
          <Pencil className="size-4" />
          Edit
        </Button>
      </div>
    </>
  );
}
