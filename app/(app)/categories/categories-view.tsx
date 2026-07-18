"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import type { CategoryDTO } from "@/src/lib/dtos/categories";
import { suggestCategoryColor } from "@/src/lib/palette";

import { CategoryEditor } from "./category-editor";
import { CategoryRow } from "./category-row";

/**
 * Categories view — the content of the `/categories` route. `page.tsx` stays
 * thin (auth + data); this owns the presentation.
 *
 * Unlike the other views this is a Client Component: the page is one
 * interactive unit — "is the create form open" and "which row is being edited"
 * are mutually exclusive halves of the same state, and every element on the
 * page sits inside one branch or the other. Reads still happen on the server;
 * the data arrives as props.
 */
export function CategoriesView({
  categories,
  taskCounts,
}: {
  categories: CategoryDTO[];
  taskCounts: Record<string, number>;
}) {
  // At most one editor is open at a time: the create form, or a single row.
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // A deleted row unmounts the Delete button that opened the confirm dialog, so
  // its focus has nowhere to return. Once the refreshed list has rendered, move
  // focus to the page heading rather than leaving the user at `<body>` (#50).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingHeadingFocus = useRef(false);
  const handleDeleted = useCallback(() => {
    pendingHeadingFocus.current = true;
  }, []);
  useEffect(() => {
    if (!pendingHeadingFocus.current) return;
    pendingHeadingFocus.current = false;
    headingRef.current?.focus();
  }, [categories]);

  // Stable identity: CategoryEditor fires this from an effect when its action
  // succeeds, so an inline arrow here would re-run that effect on every render.
  const closeEditors = useCallback(() => {
    setAdding(false);
    setEditingId(null);
  }, []);

  return (
    <section>
      <header className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[23px] font-semibold tracking-[-0.02em] outline-none"
          >
            Categories
          </h1>
          <p className="text-text-3 mt-1 text-[13.5px]">
            Flat labels to group your tasks. {categories.length} total.
          </p>
        </div>
        {!adding && (
          <Button
            size="lg"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
          >
            <Plus className="size-4" />
            New category
          </Button>
        )}
      </header>

      {adding && (
        <CategoryEditor
          submitLabel="Create category"
          initialColor={suggestCategoryColor(categories.length)}
          onDone={closeEditors}
          onCancel={closeEditors}
        />
      )}

      <div className="bg-card overflow-hidden rounded-[13px] border">
        {categories.map((category) =>
          editingId === category.id ? (
            <div
              key={category.id}
              className="bg-surface-2 border-border/60 border-b p-2.5 last:border-b-0"
            >
              <CategoryEditor
                category={category}
                submitLabel="Save changes"
                onDone={closeEditors}
                onCancel={closeEditors}
              />
            </div>
          ) : (
            <CategoryRow
              key={category.id}
              category={category}
              taskCount={taskCounts[category.id] ?? 0}
              onEdit={() => {
                setEditingId(category.id);
                setAdding(false);
              }}
              onDeleted={handleDeleted}
            />
          )
        )}

        {categories.length === 0 && !adding && (
          <p className="text-text-3 px-4 py-10 text-center text-sm">
            No categories yet. Tasks work fine without them.
          </p>
        )}
      </div>
    </section>
  );
}
