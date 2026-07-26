"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import type { CategoryDTO } from "@/src/lib/dtos/categories";
import { cn } from "@/src/lib/utils";

const ITEM_CLASS =
  "hover:bg-surface-3 flex w-full items-center gap-[9px] rounded-[7px] px-2.5 py-[9px] text-left text-[13.5px] text-text-2 transition-colors outline-none hover:text-foreground focus-visible:bg-surface-3 focus-visible:text-foreground";

/**
 * Category picker with the design's inline "create new" affordance.
 *
 * Built on Popover rather than Select: the menu holds a text input, and Radix
 * Select's typeahead treats keystrokes as jump-to-option, so an input inside it
 * can't be typed into. Popover imposes no such behaviour on its content.
 *
 * The create row is deliberately not a <form>. PopoverContent portals to the
 * body, so a nested form would be legal DOM — but React events still bubble
 * through the React tree, so a submit or Cmd+Enter here would surface on the
 * task form that owns this field. Handling Enter directly and stopping it here
 * keeps the two from reaching across.
 */
export function CategorySelect({
  value,
  categories,
  onChange,
  onCreate,
  disabled,
  id,
}: {
  value: string | null;
  categories: CategoryDTO[];
  onChange: (categoryId: string | null) => void;
  /** Resolves to the new category, or null if it couldn't be created. */
  onCreate: (name: string) => Promise<CategoryDTO | null>;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<CategoryDTO[]>([]);

  // `categories` comes from a server read, so one created here doesn't appear in
  // it until the caller's refresh lands. Hold it locally until then, or the
  // trigger would fall back to "No category" the instant the user watched
  // themselves create one. The server's copy wins once it arrives, and the list
  // keeps the server's ordering.
  const options = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    for (const category of created) if (!byId.has(category.id)) byId.set(category.id, category);
    return [...byId.values()];
  }, [categories, created]);

  const selected = options.find((category) => category.id === value);

  function reset() {
    setCreating(false);
    setNewName("");
  }

  async function create() {
    const name = newName.trim();
    if (!name || pending) return;

    setPending(true);
    const category = await onCreate(name);
    setPending(false);

    // On failure the parent has surfaced the reason; keep the typed name so the
    // rename-and-retry costs nothing.
    if (!category) return;

    setCreated((previous) => [...previous, category]);
    onChange(category.id);
    reset();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex h-10 w-full items-center justify-between rounded-[9px] border bg-transparent px-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: selected.color }}
              />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-text-faint">No category</span>
          )}
          <ChevronDown className="text-text-3 size-[15px] shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="max-h-[280px] w-[var(--radix-popover-trigger-width)] gap-0 overflow-y-auto p-1.5"
      >
        <button
          type="button"
          className={ITEM_CLASS}
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          <span className="text-text-faint">No category</span>
          {value === null && <Check className="text-primary ml-auto size-3.5" />}
        </button>

        <div className="bg-border mx-0.5 my-[5px] h-px" />

        {options.map((category) => (
          <button
            key={category.id}
            type="button"
            className={ITEM_CLASS}
            onClick={() => {
              onChange(category.id);
              setOpen(false);
            }}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span className="truncate">{category.name}</span>
            {category.id === value && <Check className="text-primary ml-auto size-3.5 shrink-0" />}
          </button>
        ))}

        <div className="bg-border mx-0.5 my-[5px] h-px" />

        {creating ? (
          <div className="flex gap-1.5 px-1.5 pt-1 pb-1.5">
            <Input
              autoFocus
              value={newName}
              disabled={pending}
              maxLength={60}
              placeholder="New category name"
              aria-label="New category name"
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                // Never let Enter reach the task form behind the popover.
                event.preventDefault();
                event.stopPropagation();
                void create();
              }}
              className="h-[34px] text-[13px]"
            />
            <Button type="button" size="sm" disabled={pending || !newName.trim()} onClick={create}>
              {pending ? "Adding…" : "Add"}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className={cn(ITEM_CLASS, "text-primary hover:text-primary")}
            onClick={() => setCreating(true)}
          >
            <Plus className="size-[15px]" />
            Create new category
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
