import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import { PurgeDialog } from "@/src/features/logs/components/purge-dialog";
import { purgeLogsAction } from "@/src/features/logs/actions";
import type { LogPage } from "@/src/server/services/logs";
import type { ActionResult } from "@/src/shared/lib/result";
import type { LogFilters } from "@/src/shared/lib/schemas/logs";

// `useServerAction` refreshes through the router and reports through sonner,
// neither of which exists in a test; the action is stood in for, so only the
// button and its confirmation are tested.
const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push, replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/src/features/logs/actions", () => ({
  purgeLogsAction: vi.fn(),
}));

const mockPurge = vi.mocked(purgeLogsAction);

/** When the page's counts were read. */
const READ_AT = "2026-11-17T19:30:00.000Z";

/** A page of the log with entries to purge, for a test to change what it needs.
 *
 * @param change The fields that differ.
 * @returns The page.
 */
function logPage(change: Partial<LogPage> = {}): LogPage {
  return {
    entries: [],
    page: 1,
    pageCount: 25,
    matching: 1204,
    total: 1204,
    oldest: null,
    levelCounts: { debug: 3, info: 1180, warn: 12, error: 9 },
    sourceCounts: { auth: 40, tasks: 1100, categories: 50, system: 14 },
    readAt: READ_AT,
    ...change,
  };
}

/** Filters for a test, with nothing picked unless it says.
 *
 * @param change The choices that differ from no filters.
 * @returns The filters.
 */
function filters(change: Partial<LogFilters> = {}): LogFilters {
  return { q: "", level: [], source: [], range: null, page: 1, ...change };
}

/** Warnings and errors from Auth, on the second page, matching 12 of the entries. */
const FILTERED = {
  page: logPage({ matching: 12 }),
  filters: filters({ level: ["warn", "error"], source: ["auth"], page: 2 }),
};

/** Finds the Purge button.
 *
 * @returns The button.
 */
function purgeButton(): HTMLElement {
  return screen.getByRole("button", { name: "Purge…" });
}

/** Opens the confirmation as a reader would.
 *
 * @returns The confirmation.
 */
async function openConfirmation(): Promise<HTMLElement> {
  await userEvent.click(purgeButton());
  return screen.findByRole("alertdialog", { name: "Purge log entries" });
}

/** A purge that has not finished, for a test to finish when it is ready.
 *
 * @returns The pending result, and a function that settles it with a count.
 */
function pendingPurge(): { finish: (removed: number) => void } {
  let finish: (removed: number) => void = () => {};
  mockPurge.mockReturnValue(
    new Promise<ActionResult<number>>((resolve) => {
      finish = (removed) => resolve({ ok: true, data: removed });
    })
  );
  return { finish: (removed) => finish(removed) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPurge.mockResolvedValue({ ok: true, data: 12 });
});

describe("PurgeDialog", () => {
  describe("the Purge button", () => {
    it("is enabled while the log has entries, even when the filters match none", () => {
      render(
        <PurgeDialog page={logPage({ matching: 0 })} filters={filters({ level: ["debug"] })} />
      );

      expect(purgeButton().hasAttribute("disabled")).toBe(false);
    });

    it("is disabled when the log is empty", () => {
      render(<PurgeDialog page={logPage({ total: 0, matching: 0 })} filters={filters()} />);

      expect(purgeButton().hasAttribute("disabled")).toBe(true);
    });

    it("keeps its name on a narrow screen, where only its icon shows", () => {
      render(<PurgeDialog page={logPage()} filters={filters()} />);

      // jsdom applies no media queries, so this checks what the narrow layout
      // keeps: a name for a screen reader and a tooltip for a pointer, with
      // the label hidden visually rather than removed.
      const button = purgeButton();
      expect(button.getAttribute("title")).toBe("Purge log entries");
      expect(button.className.split(" ")).toEqual(
        expect.arrayContaining(["max-[520px]:size-11", "max-[520px]:gap-0", "max-[520px]:px-0"])
      );
      const label = Array.from(button.querySelectorAll("span")).find(
        (s) => s.textContent === "Purge…"
      );
      expect(label?.className).toContain("max-[520px]:sr-only");
      expect(label?.className).not.toContain("hidden");
    });
  });

  describe("the confirmation", () => {
    it("says the purge is permanent and that one entry recording it is kept", async () => {
      render(<PurgeDialog page={logPage()} filters={filters()} />);

      const dialog = await openConfirmation();
      expect(dialog.textContent).toContain(
        "Purged entries are deleted permanently. A single entry recording the purge is kept."
      );
    });

    it("offers every entry, and not the filtered ones, when no filter is on", async () => {
      render(<PurgeDialog page={logPage()} filters={filters()} />);

      const dialog = await openConfirmation();
      const matching = within(dialog).getByRole("radio", {
        name: /Entries matching the current filters/,
      });
      expect(matching.hasAttribute("disabled")).toBe(true);
      expect(matching.closest("label")?.textContent).toContain("No filters are on");
      const every = within(dialog).getByRole("radio", { name: /Every log entry/ });
      expect((every as HTMLInputElement).checked).toBe(true);
      expect(every.closest("label")?.textContent).toContain("1,204 entries");
      within(dialog).getByRole("button", { name: "Purge 1,204 entries" });
    });

    it("chooses the filtered entries by default while a filter is on, with both counts", async () => {
      render(<PurgeDialog {...FILTERED} />);

      const dialog = await openConfirmation();
      const matching = within(dialog).getByRole("radio", {
        name: /Entries matching the current filters/,
      });
      expect((matching as HTMLInputElement).checked).toBe(true);
      expect(matching.closest("label")?.textContent).toContain("12 entries");
      const every = within(dialog).getByRole("radio", { name: /Every log entry/ });
      expect(every.closest("label")?.textContent).toContain("1,204 entries");
      within(dialog).getByRole("button", { name: "Purge 12 entries" });
    });

    it("names the count of the choice made on its confirm button", async () => {
      render(<PurgeDialog {...FILTERED} />);

      const dialog = await openConfirmation();
      await userEvent.click(within(dialog).getByRole("radio", { name: /Every log entry/ }));

      within(dialog).getByRole("button", { name: "Purge 1,204 entries" });
    });

    it("names a single entry as one", async () => {
      render(<PurgeDialog page={logPage({ total: 1, matching: 1 })} filters={filters()} />);

      const dialog = await openConfirmation();
      within(dialog).getByRole("button", { name: "Purge 1 entry" });
    });

    it("opens on the default choice again, whatever was chosen last time", async () => {
      render(<PurgeDialog {...FILTERED} />);

      let dialog = await openConfirmation();
      await userEvent.click(within(dialog).getByRole("radio", { name: /Every log entry/ }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

      dialog = await openConfirmation();
      within(dialog).getByRole("button", { name: "Purge 12 entries" });
    });

    it("cannot purge, or export, the filtered entries when they match none", async () => {
      render(
        <PurgeDialog page={logPage({ matching: 0 })} filters={filters({ level: ["debug"] })} />
      );

      const dialog = await openConfirmation();
      const confirm = within(dialog).getByRole("button", { name: "Purge 0 entries" });
      expect(confirm.hasAttribute("disabled")).toBe(true);
      const exportFirst = within(dialog).getByRole("button", { name: "Export these first" });
      expect(exportFirst.hasAttribute("disabled")).toBe(true);
    });
  });

  describe("Export these first", () => {
    it("downloads the filtered entries counted as JSON, leaving the confirmation in place", async () => {
      render(<PurgeDialog {...FILTERED} />);

      const dialog = await openConfirmation();
      const link = within(dialog).getByRole("link", { name: "Export these first" });
      expect(link.hasAttribute("download")).toBe(true);
      expect(link.getAttribute("href")).toBe(
        "/api/logs/export?format=json&level=warn&level=error&source=auth&readAt=2026-11-17T19%3A30%3A00.000Z"
      );
    });

    it("downloads every entry counted, without the filters, when every entry is chosen", async () => {
      render(<PurgeDialog {...FILTERED} />);

      const dialog = await openConfirmation();
      await userEvent.click(within(dialog).getByRole("radio", { name: /Every log entry/ }));

      expect(
        within(dialog).getByRole("link", { name: "Export these first" }).getAttribute("href")
      ).toBe("/api/logs/export?format=json&readAt=2026-11-17T19%3A30%3A00.000Z");
    });
  });

  describe("purging", () => {
    it("purges the filtered entries counted, then clears the filters", async () => {
      render(<PurgeDialog {...FILTERED} />);

      const dialog = await openConfirmation();
      await userEvent.click(within(dialog).getByRole("button", { name: "Purge 12 entries" }));

      expect(mockPurge).toHaveBeenCalledExactlyOnceWith({
        scope: "filtered",
        q: "",
        level: ["warn", "error"],
        source: ["auth"],
        range: null,
        readAt: READ_AT,
      });
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(toast.success).toHaveBeenCalledWith("Log entries purged");
      expect(push).toHaveBeenCalledExactlyOnceWith("/logs");
    });

    it("purges every entry counted without the filters, and keeps the filters on", async () => {
      render(<PurgeDialog {...FILTERED} />);

      const dialog = await openConfirmation();
      await userEvent.click(within(dialog).getByRole("radio", { name: /Every log entry/ }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Purge 1,204 entries" }));

      expect(mockPurge).toHaveBeenCalledExactlyOnceWith({
        scope: "all",
        q: "",
        level: [],
        source: [],
        range: null,
        readAt: READ_AT,
      });
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(refresh).toHaveBeenCalledOnce();
      expect(push).not.toHaveBeenCalled();
    });

    it("stays open, reporting the error, when the purge fails", async () => {
      mockPurge.mockResolvedValue({ ok: false, error: "Something went wrong. Please try again." });
      render(<PurgeDialog {...FILTERED} />);

      const dialog = await openConfirmation();
      await userEvent.click(within(dialog).getByRole("button", { name: "Purge 12 entries" }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again.")
      );
      expect(screen.getByRole("alertdialog")).toBe(dialog);
      within(dialog).getByRole("button", { name: "Purge 12 entries" });
      expect(push).not.toHaveBeenCalled();
    });

    it("cannot be cancelled or purged twice while the purge runs", async () => {
      const purge = pendingPurge();
      render(<PurgeDialog {...FILTERED} />);

      const dialog = await openConfirmation();
      await userEvent.click(within(dialog).getByRole("button", { name: "Purge 12 entries" }));

      const running = await within(dialog).findByRole("button", { name: "Purging…" });
      expect(running.hasAttribute("disabled")).toBe(true);
      expect(within(dialog).getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(
        true
      );
      await userEvent.keyboard("{Escape}");
      expect(screen.getByRole("alertdialog")).toBe(dialog);

      purge.finish(12);
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(mockPurge).toHaveBeenCalledOnce();
    });
  });

  describe("with a search or a range on", () => {
    it.each([
      ["a search", { q: "milk" }],
      ["a range", { range: "7d" as const }],
    ])("offers and chooses the filtered entries with only %s on", async (_, change) => {
      render(<PurgeDialog page={logPage({ matching: 7 })} filters={filters(change)} />);

      const dialog = await openConfirmation();
      const choice = within(dialog).getByRole("radio", { name: /Entries matching/ });
      expect(choice.hasAttribute("disabled")).toBe(false);
      expect((choice as HTMLInputElement).checked).toBe(true);
      within(dialog).getByRole("button", { name: "Purge 7 entries" });
    });

    it("exports what the search and range match first", async () => {
      render(
        <PurgeDialog
          page={logPage({ matching: 7 })}
          filters={filters({ q: "milk", range: "24h", page: 2 })}
        />
      );

      const dialog = await openConfirmation();
      expect(
        within(dialog).getByRole("link", { name: "Export these first" }).getAttribute("href")
      ).toBe("/api/logs/export?format=json&q=milk&range=24h&readAt=2026-11-17T19%3A30%3A00.000Z");
    });

    it("sends the search and range with a filtered purge, but not the page", async () => {
      render(
        <PurgeDialog
          page={logPage({ matching: 7 })}
          filters={filters({ q: "milk", source: ["tasks"], range: "30d", page: 2 })}
        />
      );

      const dialog = await openConfirmation();
      await userEvent.click(within(dialog).getByRole("button", { name: "Purge 7 entries" }));

      expect(mockPurge).toHaveBeenCalledExactlyOnceWith({
        scope: "filtered",
        q: "milk",
        level: [],
        source: ["tasks"],
        range: "30d",
        readAt: READ_AT,
      });
      await waitFor(() => expect(push).toHaveBeenCalledExactlyOnceWith("/logs"));
    });

    it("sends no search or range with a purge of every entry", async () => {
      render(
        <PurgeDialog
          page={logPage({ matching: 7 })}
          filters={filters({ q: "milk", range: "30d" })}
        />
      );

      const dialog = await openConfirmation();
      await userEvent.click(within(dialog).getByRole("radio", { name: /Every log entry/ }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Purge 1,204 entries" }));

      expect(mockPurge).toHaveBeenCalledExactlyOnceWith({
        scope: "all",
        q: "",
        level: [],
        source: [],
        range: null,
        readAt: READ_AT,
      });
    });
  });

  describe("closing without purging", () => {
    it.each([
      ["Cancel", () => userEvent.click(screen.getByRole("button", { name: "Cancel" }))],
      ["Escape", () => userEvent.keyboard("{Escape}")],
      [
        "a click outside",
        () => userEvent.click(document.querySelector("[data-slot=dialog-overlay]")!),
      ],
    ])("closes on %s, deleting nothing", async (_, close) => {
      render(<PurgeDialog {...FILTERED} />);

      await openConfirmation();
      await close();

      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(mockPurge).not.toHaveBeenCalled();
    });

    it("returns focus to the Purge button", async () => {
      render(<PurgeDialog {...FILTERED} />);

      await openConfirmation();
      await userEvent.keyboard("{Escape}");

      await waitFor(() => expect(document.activeElement).toBe(purgeButton()));
    });
  });
});
