"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { Button } from "@/src/shared/components/ui/button";
import { Input } from "@/src/shared/components/ui/input";
import { Label } from "@/src/shared/components/ui/label";
import { Textarea } from "@/src/shared/components/ui/textarea";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";
import { taskCreateSchema } from "@/src/shared/lib/schemas/tasks";

import { CategorySelect } from "@/src/features/tasks/components/dialog/category-select";
import { StatusPicker } from "@/src/features/tasks/components/dialog/status-picker";

/**
 * The form's values are the create schema's, in both modes. `taskUpdateSchema`
 * is `.partial()`, which is right for a PATCH-shaped action but wrong here — the
 * edit form still shows every field, so it still has to enforce every rule.
 */
export type TaskFormValues = z.output<typeof taskCreateSchema>;
/** The form values before Zod parses them, which is what the resolver sees. */
type TaskFormInput = z.input<typeof taskCreateSchema>;

/** Shared styling for every field label in the form. */
const LABEL_CLASS = "text-text-2 mb-[7px] text-[12.5px] font-medium";
/** Shared styling for the keyboard-shortcut hints in the footer. */
const KBD_CLASS =
  "bg-surface-3 border-border-strong text-text-2 rounded-[5px] border border-b-2 px-1.5 py-px font-mono text-[11px] leading-[1.4]";

/** The fields the form collects, validated and submitted by `TaskForm`. */
export function TaskForm({
  task,
  categories,
  onSubmit,
  onCreateCategory,
  onSaved,
  onCancel,
}: {
  task?: TaskDTO;
  categories: CategoryDTO[];
  onSubmit: (values: TaskFormValues) => Promise<TaskDTO | null>;
  onCreateCategory: (name: string) => Promise<CategoryDTO | null>;
  onSaved: (task: TaskDTO) => void;
  onCancel: () => void;
}) {
  const isEdit = task !== undefined;

  const form = useForm<TaskFormInput, unknown, TaskFormValues>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: task?.status ?? "open",
      categoryId: task?.categoryId ?? null,
    },
  });

  const {
    control,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  // Per the design, only the edit variant gates on dirty. Create leaves the
  // button live so an empty title answers with an inline error rather than a
  // button that silently does nothing.
  const saveDisabled = isSubmitting || (isEdit && !isDirty);

  const submit = form.handleSubmit(async (values) => {
    const saved = await onSubmit(values);
    if (saved) onSaved(saved);
  });

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (!(event.metaKey || event.ctrlKey)) return;
        if (event.key !== "Enter" && event.key !== "NumpadEnter") return;
        event.preventDefault();
        if (!saveDisabled) void submit();
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-[18px]">
        <div className="mb-4">
          <Label htmlFor="task-title" className={LABEL_CLASS}>
            Title <span className="text-brand-orange">*</span>
          </Label>
          <Input
            {...form.register("title")}
            id="task-title"
            placeholder="What needs doing?"
            aria-invalid={errors.title !== undefined}
            aria-describedby={errors.title ? "task-title-error" : undefined}
            // The design's 15px, but only where a mouse is: under 16px iOS Safari
            // zooms the page on focus, and this is the field the dialog opens on.
            className="h-[42px] rounded-[9px] pointer-fine:text-[15px]"
          />
          {errors.title && (
            <p id="task-title-error" className="text-destructive mt-[7px] text-[12.5px]">
              {errors.title.message}
            </p>
          )}
        </div>

        <div className="mb-4">
          <Label htmlFor="task-description" className={LABEL_CLASS}>
            Description{" "}
            <span className="text-text-faint font-normal">· Markdown supported · optional</span>
          </Label>
          <Textarea
            {...form.register("description")}
            id="task-description"
            placeholder="Add detail, links, code… `inline code`, **bold**, [links](url)"
            aria-invalid={errors.description !== undefined}
            aria-describedby={errors.description ? "task-description-error" : undefined}
            className="min-h-24 resize-y rounded-[9px] leading-[1.55]"
          />
          {errors.description && (
            <p id="task-description-error" className="text-destructive mt-[7px] text-[12.5px]">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="grid gap-4">
          {/* Status and Category render their errors too. RHF blocks the submit
              on any invalid field, and its shouldFocusError can't reach a custom
              control with no registered ref — so a field without a message here
              would fail as a dead button with nothing on screen to explain it. */}
          <div>
            <Label className={LABEL_CLASS}>Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <StatusPicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
            {errors.status && (
              <p className="text-destructive mt-[7px] text-[12.5px]">{errors.status.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="task-category" className={LABEL_CLASS}>
              Category
            </Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <CategorySelect
                  id="task-category"
                  value={field.value ?? null}
                  categories={categories}
                  onChange={field.onChange}
                  onCreate={onCreateCategory}
                  disabled={isSubmitting}
                />
              )}
            />
            {errors.categoryId && (
              <p className="text-destructive mt-[7px] text-[12.5px]">{errors.categoryId.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t px-[18px] py-3.5">
        {/* Instructions for hardware the reader may not have: there is no esc and
            no ⌘ on a phone. Hidden by pointer, not by width, because that is what
            the hint is actually about — the shortcuts themselves stay bound, so a
            keyboard paired with a tablet still works, it just goes unadvertised.
            `ml-auto` below keeps the actions right-aligned once this is gone. */}
        <span className="text-text-faint text-[11.5px] pointer-coarse:hidden">
          <kbd className={KBD_CLASS}>esc</kbd> to cancel · <kbd className={KBD_CLASS}>⌘</kbd>
          <kbd className={KBD_CLASS}>↵</kbd> to save
        </span>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saveDisabled}>
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create task"}
          </Button>
        </div>
      </div>
    </form>
  );
}
