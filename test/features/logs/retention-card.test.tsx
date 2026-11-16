import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import { RetentionCard } from "@/src/features/logs/components/retention-card";
import { removeOldLogsAction, setLogRetentionAction } from "@/src/features/logs/actions";
import type { RetentionStatusDTO } from "@/src/shared/lib/dtos/settings";
import type { ActionResult } from "@/src/shared/lib/result";

// `useServerAction` refreshes through the router and reports through sonner,
// neither of which exists in a test; the actions are stood in for, so only
// the card is tested.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/src/features/logs/actions", () => ({
  setLogRetentionAction: vi.fn(),
  removeOldLogsAction: vi.fn(),
}));

const mockSetRetention = vi.mocked(setLogRetentionAction);
const mockRemoveNow = vi.mocked(removeOldLogsAction);

/** Mid-afternoon on the page's day, in local time. */
const NOW = new Date(2026, 10, 16, 17, 0);

/** Ninety days before `NOW`, the cut-off for the default retention. */
const CUTOFF = new Date(2026, 7, 18, 17, 0).toISOString();

/** The retention status before anything has run, for a test to change what it needs.
 *
 * @param change The fields that differ.
 * @returns The status.
 */
function status(change: Partial<RetentionStatusDTO> = {}): RetentionStatusDTO {
  return { logRetentionDays: 90, lastAgeOut: null, cutoff: CUTOFF, dueForRemoval: 0, ...change };
}

/** Finds the element whose whole text is a sentence, however it is split into elements.
 *
 * @param text The sentence.
 * @returns The innermost element that reads exactly that.
 */
function sentence(text: string): HTMLElement {
  return screen.getByText(
    (_, element) =>
      element?.textContent === text &&
      Array.from(element.children).every((child) => child.textContent !== text)
  );
}

/** The radio for one choice.
 *
 * @param name The choice's label.
 * @returns Its radio.
 */
function choice(name: string): HTMLElement {
  return screen.getByRole("radio", { name });
}

/** Presses an arrow key and lets it go, as a person does.
 *
 * The group moves focus a moment after the key goes down, and picks the
 * choice it lands on only while the key is still held, so the key has to
 * stay down until focus has moved, as it does for anyone typing.
 *
 * @param user The user typing.
 * @param key The arrow key's name, such as `ArrowRight`.
 */
async function pressArrow(user: ReturnType<typeof userEvent.setup>, key: string): Promise<void> {
  await user.keyboard(`{${key}>}`);
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  await user.keyboard(`{/${key}}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSetRetention.mockImplementation(async (days) => ({ ok: true, data: days as never }));
  mockRemoveNow.mockResolvedValue({ ok: true, data: 12 });
});

describe("RetentionCard", () => {
  it("is headed Retention, and says when old entries go", () => {
    render(<RetentionCard status={status()} now={NOW} />);

    expect(screen.getByRole("region", { name: "Retention" })).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: "Retention" })).toBeDefined();
    expect(
      screen.getByText("Entries older than this are deleted automatically every night at 03:00.")
    ).toBeDefined();
  });

  it("offers the five retentions, in order, as one labelled choice", () => {
    render(<RetentionCard status={status()} now={NOW} />);

    const group = screen.getByRole("radiogroup", { name: "Keep log entries for" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual(["7 days", "30 days", "90 days", "1 year", "Forever"]);
  });

  it.each([
    [7, "7 days"],
    [90, "90 days"],
    [365, "1 year"],
    [0, "Forever"],
  ] as const)("shows %i as %s, and only that, picked", (days, name) => {
    render(
      <RetentionCard
        status={status({ logRetentionDays: days, cutoff: days === 0 ? null : CUTOFF })}
        now={NOW}
      />
    );

    const checked = screen
      .getAllByRole("radio")
      .filter((radio) => radio.getAttribute("aria-checked") === "true");
    expect(checked).toEqual([choice(name)]);
  });

  describe("what is due to go", () => {
    it("says entries are kept until purged when kept forever, with no Remove now", () => {
      render(<RetentionCard status={status({ logRetentionDays: 0, cutoff: null })} now={NOW} />);

      expect(sentence("Entries are kept until you purge them.")).toBeDefined();
      expect(screen.queryByRole("button", { name: "Remove now" })).toBeNull();
    });

    it("says nothing is that old yet, with no Remove now, when nothing is due", () => {
      render(<RetentionCard status={status()} now={NOW} />);

      expect(sentence("Nothing is older than 18 Aug 2026 yet.")).toBeDefined();
      expect(screen.queryByRole("button", { name: "Remove now" })).toBeNull();
    });

    it("counts what will go tonight, with Remove now, when entries are due", () => {
      render(<RetentionCard status={status({ dueForRemoval: 1204 })} now={NOW} />);

      expect(
        sentence("1,204 entries older than 18 Aug 2026 will be removed tonight.")
      ).toBeDefined();
      expect(screen.getByText("1,204 entries").tagName).toBe("STRONG");
      expect(screen.getByRole("button", { name: "Remove now" })).toBeDefined();
    });

    it("counts a single entry as one", () => {
      render(<RetentionCard status={status({ dueForRemoval: 1 })} now={NOW} />);

      expect(sentence("1 entry older than 18 Aug 2026 will be removed tonight.")).toBeDefined();
    });

    it("gives the cut-off as a machine-readable time", () => {
      render(<RetentionCard status={status()} now={NOW} />);

      expect(screen.getByText("18 Aug 2026").closest("time")?.getAttribute("dateTime")).toBe(
        CUTOFF
      );
    });
  });

  describe("the last run", () => {
    it("says when it ran and how many it removed", () => {
      const ranAt = new Date(2026, 10, 16, 3, 0).toISOString();
      render(<RetentionCard status={status({ lastAgeOut: { ranAt, removed: 12 } })} now={NOW} />);

      expect(sentence("Last run removed 12 entries at 03:00 today.")).toBeDefined();
      expect(screen.getByText("03:00 today").closest("time")?.getAttribute("dateTime")).toBe(ranAt);
    });

    it("says so when it removed nothing", () => {
      const ranAt = new Date(2026, 10, 15, 3, 0).toISOString();
      render(<RetentionCard status={status({ lastAgeOut: { ranAt, removed: 0 } })} now={NOW} />);

      expect(sentence("Last run removed 0 entries at 03:00 yesterday.")).toBeDefined();
    });

    it("says nothing about a run before there has been one", () => {
      render(<RetentionCard status={status()} now={NOW} />);

      expect(screen.queryByText(/Last run/)).toBeNull();
    });
  });

  describe("choosing a retention", () => {
    it("saves the choice as a number, and confirms it", async () => {
      const user = userEvent.setup();
      render(<RetentionCard status={status()} now={NOW} />);

      await user.click(choice("30 days"));

      expect(mockSetRetention).toHaveBeenCalledExactlyOnceWith(30);
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith("Keeping log entries for 30 days")
      );
      expect(refresh).toHaveBeenCalled();
    });

    it("confirms forever in words", async () => {
      const user = userEvent.setup();
      render(<RetentionCard status={status()} now={NOW} />);

      await user.click(choice("Forever"));

      expect(mockSetRetention).toHaveBeenCalledExactlyOnceWith(0);
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith("Keeping log entries forever")
      );
    });

    it("shows the choice as picked while it saves", async () => {
      let finish: (result: ActionResult<never>) => void = () => {};
      mockSetRetention.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
      const user = userEvent.setup();
      render(<RetentionCard status={status()} now={NOW} />);

      await user.click(choice("7 days"));

      expect(choice("7 days").getAttribute("aria-checked")).toBe("true");
      expect(choice("90 days").getAttribute("aria-checked")).toBe("false");
      await act(async () => finish({ ok: true, data: 7 as never }));
    });

    it("goes back to the saved choice, and says why, when saving fails", async () => {
      mockSetRetention.mockResolvedValue({
        ok: false,
        error: "Something went wrong. Please try again.",
      });
      const user = userEvent.setup();
      render(<RetentionCard status={status()} now={NOW} />);

      await user.click(choice("1 year"));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again.")
      );
      await waitFor(() => expect(choice("90 days").getAttribute("aria-checked")).toBe("true"));
      expect(choice("1 year").getAttribute("aria-checked")).toBe("false");
      expect(refresh).not.toHaveBeenCalled();
    });

    it("is one tab stop, landing on the saved choice", async () => {
      const user = userEvent.setup();
      render(<RetentionCard status={status()} now={NOW} />);

      await user.tab();

      expect(document.activeElement).toBe(choice("90 days"));
      const tabbable = screen
        .getAllByRole("radio")
        .filter((radio) => radio.getAttribute("tabindex") === "0");
      expect(tabbable).toEqual([choice("90 days")]);
    });

    it("moves to and saves the next choice with the arrow keys", async () => {
      const user = userEvent.setup();
      render(<RetentionCard status={status()} now={NOW} />);

      await user.tab();
      await pressArrow(user, "ArrowRight");

      expect(document.activeElement).toBe(choice("1 year"));
      await waitFor(() => expect(mockSetRetention).toHaveBeenCalledWith(365));
    });

    it("moves back with the arrow keys too", async () => {
      const user = userEvent.setup();
      render(<RetentionCard status={status()} now={NOW} />);

      await user.tab();
      await pressArrow(user, "ArrowLeft");

      expect(document.activeElement).toBe(choice("30 days"));
      await waitFor(() => expect(mockSetRetention).toHaveBeenCalledWith(30));
    });
  });

  describe("Remove now", () => {
    it("removes the old entries, and confirms it", async () => {
      const user = userEvent.setup();
      render(<RetentionCard status={status({ dueForRemoval: 12 })} now={NOW} />);

      await user.click(screen.getByRole("button", { name: "Remove now" }));

      expect(mockRemoveNow).toHaveBeenCalledOnce();
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Old log entries removed"));
      expect(refresh).toHaveBeenCalled();
    });

    it("cannot be pressed again while it runs", async () => {
      let finish: (result: ActionResult<number>) => void = () => {};
      mockRemoveNow.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
      const user = userEvent.setup();
      render(<RetentionCard status={status({ dueForRemoval: 12 })} now={NOW} />);

      await user.click(screen.getByRole("button", { name: "Remove now" }));

      const button = screen.getByRole("button", { name: "Removing…" });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      await user.click(button);
      expect(mockRemoveNow).toHaveBeenCalledOnce();

      await act(async () => finish({ ok: true, data: 12 }));
      expect(
        (screen.getByRole("button", { name: "Remove now" }) as HTMLButtonElement).disabled
      ).toBe(false);
    });

    it("says why, when removing fails", async () => {
      mockRemoveNow.mockResolvedValue({
        ok: false,
        error: "Something went wrong. Please try again.",
      });
      const user = userEvent.setup();
      render(<RetentionCard status={status({ dueForRemoval: 12 })} now={NOW} />);

      await user.click(screen.getByRole("button", { name: "Remove now" }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again.")
      );
      expect(toast.success).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
