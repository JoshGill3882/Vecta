"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { SearchField } from "@/src/shared/components/search-field";
import { Button } from "@/src/shared/components/ui/button";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import { suggestCategoryColor } from "@/src/shared/lib/palette";
import { normaliseQuery } from "@/src/shared/lib/text-search";

import { narrowCategories } from "@/src/features/categories/lib/category-search";

import { CategoryEditor } from "./category-editor";
import { CategoryRow } from "./category-row";

/** DOM id of the search box, which the no-matches card's Clear search sends focus back to. */
const categoriesSearchFieldId = "categories-search-field";

/** Categories view — the content of the `/categories` route.
 *
 * `page.tsx` stays thin (auth + data); this owns the presentation.
 *
 * Unlike the other views this is a Client Component: the page is one
 * interactive unit — "is the create form open" and "which row is being edited"
 * are mutually exclusive halves of the same state, and every element on the
 * page sits inside one branch or the other. Reads still happen on the server;
 * the data arrives as props.
 *
 * The search is matched here, over the categories the page already holds, so
 * nothing is sent as it is typed and leaving the page forgets it.
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
  const [query, setQuery] = useState("");

  const needle = normaliseQuery(query);
  const narrowed = needle !== "";
  // The row being edited stays in the list until its editor closes, so
  // renaming it away from the search never pulls the form out from under you.
  const shown = narrowCategories(categories, needle, editingId);

  // A deleted row unmounts the Delete button that opened the confirm dialog, so
  // its focus has nowhere to return. Once the refreshed list has rendered, move
  // focus to the page heading rather than leaving the user at `<body>`.
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

  // Creating empties the search, so the new category is in view whatever its name.
  // Stable for the same reason as `closeEditors`.
  const finishCreate = useCallback(() => {
    setQuery("");
    closeEditors();
  }, [closeEditors]);

  /** Empties the search from the no-matches card and puts focus back in the box. */
  function clearSearch() {
    setQuery("");
    document.getElementById(categoriesSearchFieldId)?.focus();
  }

  return (
    <section>
      {/* Stacks below `sm` — see tasks-view.tsx for why. */}
      <header className="mb-[18px] flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[23px] font-semibold tracking-[-0.02em] outline-none"
          >
            Categories
          </h1>
          {/* Always mounted, so a screen reader hears the count change as the search narrows the list. */}
          <p role="status" className="text-text-3 mt-1 text-[13.5px]">
            {narrowed
              ? `${shown.length} of ${categories.length} ${categories.length === 1 ? "category" : "categories"}`
              : `Flat labels to group your tasks. ${categories.length} total.`}
          </p>
        </div>
        {!adding && (
          <Button
            size="lg"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            className="w-full sm:w-auto"
          >
            <Plus className="size-4" />
            New category
          </Button>
        )}
      </header>

      {categories.length > 0 && (
        <div className="mb-3.5 flex items-center gap-2">
          <SearchField
            id={categoriesSearchFieldId}
            label="Search categories"
            placeholder="Search categories..."
            value={query}
            onChange={setQuery}
            slashShortcut
          />
        </div>
      )}

      {adding && (
        <CategoryEditor
          submitLabel="Create category"
          initialColor={suggestCategoryColor(categories.length)}
          onDone={finishCreate}
          onCancel={closeEditors}
        />
      )}

      <div className="bg-card overflow-hidden rounded-[13px] border">
        {shown.map((category) =>
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
              needle={needle}
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

        {categories.length > 0 && shown.length === 0 && (
          <div className="px-4 py-9 text-center">
            <p className="text-text-3 text-sm">No categories match “{query.trim()}”.</p>
            <Button variant="outline" onClick={clearSearch} className="mt-3.5">
              Clear search
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
