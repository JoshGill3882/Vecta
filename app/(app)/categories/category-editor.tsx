"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { CategoryChip } from "@/src/components/categories/category-chip";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import type { CategoryDTO } from "@/src/lib/dtos/categories";
import { CATEGORY_PALETTE } from "@/src/lib/palette";
import type { FormState } from "@/src/lib/result";
import { cn } from "@/src/lib/utils";

import { createCategoryAction, updateCategoryAction } from "./actions";

/**
 * The create/edit form — one component for both, as in the design. Passing a
 * `category` switches it to edit mode: the only real difference is which action
 * it submits to, and both share the `(prevState, formData)` shape `useActionState`
 * calls with, so `updateCategoryAction` just needs its `id` bound first.
 */
export function CategoryEditor({
  category,
  submitLabel,
  initialColor,
  onDone,
  onCancel,
}: {
  category?: CategoryDTO;
  submitLabel: string;
  initialColor?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const isEdit = category !== undefined;

  const action = isEdit ? updateCategoryAction.bind(null, category.id) : createCategoryAction;
  const [state, formAction, pending] = useActionState<FormState<CategoryDTO>, FormData>(
    action,
    null // idle: nothing submitted yet
  );

  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? initialColor ?? CATEGORY_PALETTE[0]);

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(isEdit ? "Category updated" : "Category created");
    // The list is rendered from a server read, so ask the router for a fresh
    // one — `revalidateCategories()` in the action expires the cache, this
    // re-runs the page's query and streams the new rows down.
    router.refresh();
    onDone();
  }, [state, isEdit, router, onDone]);

  // A duplicate name comes back as a CONFLICT from the service (Prisma P2002),
  // not as a Zod field error — surface both in the same place, under the field.
  const nameError = state?.ok === false ? (state.fieldErrors?.name?.[0] ?? state.error) : undefined;

  return (
    <form
      action={formAction}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="bg-card border-primary ring-primary/20 mb-3.5 max-w-[680px] rounded-[13px] border p-4 ring-3"
    >
      {/* The colour is picked from swatches, so it rides along in a hidden field
          rather than a native <input type="color">. */}
      <input type="hidden" name="color" value={color} />

      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <Label htmlFor="category-name" className="text-text-3 mb-1.5 text-xs font-medium">
            Name
          </Label>
          <Input
            id="category-name"
            name="name"
            autoFocus
            required
            maxLength={60}
            placeholder="e.g. Frontend"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={nameError !== undefined}
            aria-describedby={nameError ? "category-name-error" : undefined}
            className="h-[38px]"
          />
          {nameError && (
            <p id="category-name-error" className="text-destructive mt-1.5 text-xs">
              {nameError}
            </p>
          )}
        </div>

        <div className="shrink-0">
          <Label className="text-text-3 mb-1.5 text-xs font-medium">Preview</Label>
          <div className="flex h-[38px] items-center">
            <CategoryChip name={name.trim() || "Label preview"} color={color} />
          </div>
        </div>
      </div>

      <div className="mt-3.5">
        <Label className="text-text-3 mb-1.5 text-xs font-medium">Colour</Label>
        <div className="flex flex-wrap gap-[9px]">
          {CATEGORY_PALETTE.map((swatch) => {
            const selected = swatch === color;
            return (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                title={swatch}
                aria-label={`Colour ${swatch}`}
                aria-pressed={selected}
                className={cn(
                  "focus-visible:ring-ring flex size-7 items-center justify-center rounded-lg transition-transform focus-visible:ring-3 focus-visible:outline-none",
                  selected ? "scale-105" : "hover:scale-105"
                )}
                style={{
                  backgroundColor: swatch,
                  // Selected swatches get a ring in their own colour, gapped
                  // from the swatch by a surface-coloured ring beneath it.
                  boxShadow: selected
                    ? `0 0 0 2px var(--card), 0 0 0 4px ${swatch}`
                    : "inset 0 0 0 1px rgba(255,255,255,0.08)",
                }}
              >
                {selected && <Check className="size-3.5 text-white drop-shadow-sm" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending || name.trim() === ""}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
