"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, X } from "lucide-react";
import type { z } from "zod";

import { Button } from "@/src/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import type { CategoryDTO } from "@/src/lib/dtos/categories";
import type { TaskDTO } from "@/src/lib/dtos/tasks";
import { taskCreateSchema } from "@/src/lib/schemas/tasks";

import { CategorySelect } from "./category-select";
import { StatusPicker } from "./status-picker";

/**
 * The form's values are the create schema's, in both modes. `taskUpdateSchema`
 * is `.partial()`, which is right for a PATCH-shaped action but wrong here — the
 * edit form still shows every field, so it still has to enforce every rule.
 */
export type TaskFormValues = z.output<typeof taskCreateSchema>;
type TaskFormInput = z.input<typeof taskCreateSchema>;

const LABEL_CLASS = "text-text-2 mb-[7px] text-[12.5px] font-medium";
const KBD_CLASS =
  "bg-surface-3 border-border-strong text-text-2 rounded-[5px] border border-b-2 px-1.5 py-px font-mono text-[11px] leading-[1.4]";

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  categories,
  onSubmit,
  onCreateCategory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omitted for create; supplied for edit, which pre-populates from it. */
  task?: TaskDTO;
  categories: CategoryDTO[];
  /** Resolves true when the task was saved, which closes the dialog. */
  onSubmit: (values: TaskFormValues) => Promise<boolean>;
  onCreateCategory: (name: string) => Promise<CategoryDTO | null>;
}) {
  const isEdit = task !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // The design gives the dialog no prose description, and Radix only stops
        // warning about the missing `aria-describedby` when it's cleared.
        aria-describedby={undefined}
        // The close button is the first tabbable in the content, so Radix's
        // default would land focus there. Never let it: this always takes over.
        //
        // Where focus goes then depends on the pointer, not the viewport — what
        // raises the on-screen keyboard is the input device, so a narrow desktop
        // window keeps the desktop behaviour. With a mouse, the design opens on
        // the title, ready to type. On touch, focusing any field would throw the
        // keyboard up over the form before the user has chosen a field, so focus
        // the dialog itself: it carries tabIndex={-1}, which keeps the dialog
        // announced and gives the focus trap a start without priming an input.
        // Cancelling without focusing anything would strand focus on the trigger
        // behind the dialog — silent on a phone, broken for a screen reader.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (window.matchMedia("(pointer: coarse)").matches) {
            (event.currentTarget as HTMLElement).focus();
            return;
          }
          document.getElementById("task-title")?.focus();
        }}
        className="top-[7vh] flex max-h-[86vh] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-[18px] py-4">
          <div className="flex items-center gap-2.5">
            <span className="bg-primary/15 text-primary flex size-[30px] items-center justify-center rounded-lg">
              {isEdit ? <Pencil className="size-4" /> : <Plus className="size-4" />}
            </span>
            <DialogTitle className="text-base font-semibold tracking-[-0.01em]">
              {isEdit ? "Edit task" : "New task"}
            </DialogTitle>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <X />
            </Button>
          </DialogClose>
        </div>

        {/* Radix unmounts dialog content on close, so this remounts on each open —
            the form always starts from the current task, with no reset to run. */}
        <TaskForm
          task={task}
          categories={categories}
          onSubmit={onSubmit}
          onCreateCategory={onCreateCategory}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({
  task,
  categories,
  onSubmit,
  onCreateCategory,
  onOpenChange,
}: {
  task?: TaskDTO;
  categories: CategoryDTO[];
  onSubmit: (values: TaskFormValues) => Promise<boolean>;
  onCreateCategory: (name: string) => Promise<CategoryDTO | null>;
  onOpenChange: (open: boolean) => void;
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
    if (saved) onOpenChange(false);
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
            className="h-[42px] rounded-[9px] text-[15px] md:text-[15px]"
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

      <div className="flex shrink-0 items-center justify-between gap-3 border-t px-[18px] py-3.5">
        <span className="text-text-faint text-[11.5px]">
          <kbd className={KBD_CLASS}>esc</kbd> to cancel · <kbd className={KBD_CLASS}>⌘</kbd>
          <kbd className={KBD_CLASS}>↵</kbd> to save
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
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
