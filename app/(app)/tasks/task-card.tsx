import { CategoryChip } from "@/src/components/categories/category-chip";
import { StatusBadge } from "@/src/components/tasks/status-badge";
import type { CategoryDTO } from "@/src/lib/dtos/categories";
import type { TaskDTO } from "@/src/lib/dtos/tasks";
import { relativeTime } from "@/src/lib/relative-time";
import { cn } from "@/src/lib/utils";

import { TaskCardMenu } from "./task-card-menu";

/**
 * Strip the markdown punctuation that would otherwise show up as literal `#`
 * and `**` in the preview line. Descriptions are rendered properly in the task
 * dialog; this is a flattened one-liner, not a renderer.
 */
function previewOf(description: string): string {
  return description.replace(/[#*`>_]/g, "").trim();
}

/** One task in the list: title, description preview, status, category, age. */
export function TaskCard({
  task,
  category,
  onEdit,
}: {
  task: TaskDTO;
  category?: CategoryDTO;
  onEdit: (task: TaskDTO) => void;
}) {
  const preview = previewOf(task.description);
  const closed = task.status === "closed";

  return (
    <article
      className={cn(
        "bg-card rounded-[12px] border p-4 transition-colors",
        closed && "opacity-[0.78]"
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <h3
          className={cn(
            "flex-1 text-[15px] leading-[1.4] font-medium tracking-[-0.01em]",
            closed && "text-text-2 line-through"
          )}
        >
          {task.title}
        </h3>
        <TaskCardMenu task={task} onEdit={onEdit} />
      </div>

      {preview && (
        <p className="text-text-3 mt-1.5 line-clamp-2 text-[13.5px] leading-[1.5]">{preview}</p>
      )}

      <div className="mt-[13px] flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        {category && <CategoryChip name={category.name} color={category.color} />}
        <span className="flex-1" />
        {/* Relative time is computed from the clock, so the server's render and
            the client's can legitimately differ by a tick — the timestamp is the
            canonical case for suppressing that warning. */}
        <time
          dateTime={task.updatedAt}
          className="text-text-faint text-[11.5px]"
          suppressHydrationWarning
        >
          {relativeTime(task.updatedAt)}
        </time>
      </div>
    </article>
  );
}
