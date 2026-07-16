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

  function openFromCard() {
    // A drag to select text finishes with a click on the card. Opening the
    // dialog then would tear the selection away mid-gesture.
    if (window.getSelection()?.toString()) return;
    onEdit(task);
  }

  return (
    <article
      onClick={openFromCard}
      className={cn(
        "bg-card hover:border-ring/50 cursor-pointer rounded-[12px] border p-4 transition-colors",
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
          {/* The card's keyboard route in. It carries no handler of its own:
              Enter/Space fire a click that bubbles to the article, so pointer
              and keyboard arrive at one place. A button around the whole card
              would nest the ⋮ trigger inside it — invalid, and it would cost
              the title its accessible name.

              `select-text` is load-bearing: a button's text is unselectable by
              default, so without it a drag across the title selects nothing and
              reads as a plain click — opening the dialog mid-gesture. */}
          <button
            type="button"
            className="focus-visible:ring-ring/50 cursor-pointer rounded-md text-left outline-none select-text focus-visible:ring-3"
          >
            {task.title}
          </button>
        </h3>
        {/* Radix portals the menu's items out of the card, so only the trigger
            itself sits in the article's bubble path. */}
        <div onClick={(event) => event.stopPropagation()} className="contents">
          <TaskCardMenu task={task} onEdit={onEdit} />
        </div>
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
