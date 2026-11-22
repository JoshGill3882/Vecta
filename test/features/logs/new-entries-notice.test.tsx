import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import type { LogFilters } from "@/src/shared/lib/schemas/logs";
import {
  CHECK_INTERVAL,
  NewEntriesNotice,
} from "@/src/features/logs/components/new-entries-notice";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

/** When the page's counts were read, as the page hands it over. */
const READ_AT = "2026-11-20T08:15:42.123Z";

/** No filters, on the first page. */
const NO_FILTERS: LogFilters = { q: "", level: [], source: [], range: null, page: 1 };

/** Whether the tab is visible, as the notice reads it from `document.visibilityState`. */
let visibility: DocumentVisibilityState;

/** Stands in for the browser's fetch, so each test says what a check is answered with. */
const fetchMock = vi.fn<typeof fetch>();

/** Answers a check with a count, as the route does.
 *
 * @param count How many new entries.
 * @returns The response.
 */
function counted(count: number): Response {
  return Response.json({ count });
}

/** Shows or hides the tab, firing the event the browser fires.
 *
 * @param next Whether the tab is now visible or hidden.
 */
function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

/** Lets time pass, and lets any check it started be answered.
 *
 * @param ms How long, in milliseconds.
 */
async function wait(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

/** Lets a check started without time passing be answered. */
async function settle() {
  await wait(0);
}

/** The addresses each check asked, in order. */
function asked(): string[] {
  return fetchMock.mock.calls.map(([href]) => String(href));
}

beforeEach(() => {
  vi.useFakeTimers();
  push.mockReset();
  refresh.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(counted(0));
  vi.stubGlobal("fetch", fetchMock);
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NewEntriesNotice", () => {
  it("shows nothing, and asks nothing, as the page loads", async () => {
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Show" })).toBeNull();
  });

  it(`asks every ${CHECK_INTERVAL / 1000} seconds while the tab is visible`, async () => {
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);

    await wait(CHECK_INTERVAL - 1);
    expect(fetchMock).not.toHaveBeenCalled();
    await wait(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await wait(CHECK_INTERVAL * 2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("checks every 15 seconds", () => {
    expect(CHECK_INTERVAL).toBe(15_000);
  });

  it("asks for what the page's filters match since the moment its counts were read, uncached", async () => {
    const filters: LogFilters = {
      q: "milk",
      level: ["error", "warn"],
      source: ["auth"],
      range: "7d",
      page: 3,
    };
    render(<NewEntriesNotice filters={filters} readAt={READ_AT} page={3} />);
    await wait(CHECK_INTERVAL);

    expect(asked()).toEqual([
      "/api/logs/new?q=milk&level=warn&level=error&source=auth&range=7d&readAt=2026-11-20T08%3A15%3A42.123Z",
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });

  it.each([
    [1, "1 new entry"],
    [3, "3 new entries"],
    [1204, "1,204 new entries"],
  ])("says how many there are when a check finds %i", async (count, text) => {
    fetchMock.mockResolvedValue(counted(count));
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);
    await wait(CHECK_INTERVAL);

    expect(screen.getByRole("status").textContent).toBe(`${text}Show`);
    expect(screen.getByRole("button", { name: "Show" })).toBeDefined();
  });

  it("shows nothing while a check finds none", async () => {
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);
    await wait(CHECK_INTERVAL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("updates the number as later checks find more", async () => {
    fetchMock.mockResolvedValueOnce(counted(1)).mockResolvedValueOnce(counted(4));
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);

    await wait(CHECK_INTERVAL);
    expect(screen.getByRole("status").textContent).toContain("1 new entry");
    await wait(CHECK_INTERVAL);
    expect(screen.getByRole("status").textContent).toContain("4 new entries");
  });

  it("keeps its live region on the page while there is nothing new, so the notice is announced when it appears", async () => {
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);
    const region = screen.getByRole("status");

    fetchMock.mockResolvedValue(counted(2));
    await wait(CHECK_INTERVAL);

    // The same element, so a screen reader was already watching it.
    expect(screen.getByRole("status")).toBe(region);
    expect(region.textContent).toContain("2 new entries");
  });

  it("does not move focus when the notice appears", async () => {
    render(
      <>
        <button type="button">Reading here</button>
        <NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />
      </>
    );
    const reading = screen.getByRole("button", { name: "Reading here" });
    reading.focus();

    fetchMock.mockResolvedValue(counted(2));
    await wait(CHECK_INTERVAL);

    expect(document.activeElement).toBe(reading);
  });

  it("stops asking while the tab is hidden", async () => {
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);
    setVisibility("hidden");

    await wait(CHECK_INTERVAL * 4);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks straight away when the tab is shown again, then every interval from there", async () => {
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);
    setVisibility("hidden");
    await wait(CHECK_INTERVAL * 2);

    fetchMock.mockResolvedValue(counted(5));
    setVisibility("visible");
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toContain("5 new entries");

    await wait(CHECK_INTERVAL);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not ask twice as often after the tab is shown while already visible", async () => {
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);
    setVisibility("visible");
    await settle();
    fetchMock.mockClear();

    await wait(CHECK_INTERVAL * 2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("asks nothing while it opens in a hidden tab, until the tab is shown", async () => {
    visibility = "hidden";
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);

    await wait(CHECK_INTERVAL * 2);
    expect(fetchMock).not.toHaveBeenCalled();

    setVisibility("visible");
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an error from the server", () => Promise.resolve(new Response("", { status: 500 }))],
    [
      "an error whose body holds a count",
      () => Promise.resolve(Response.json({ count: 9 }, { status: 502 })),
    ],
    ["no connection", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["an answer that is not JSON", () => Promise.resolve(new Response("<html>"))],
  ])("shows nothing for %s, and asks again at the next interval", async (_, failure) => {
    fetchMock.mockImplementationOnce(failure).mockResolvedValueOnce(counted(2));
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);

    await wait(CHECK_INTERVAL);
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();

    await wait(CHECK_INTERVAL);
    expect(screen.getByRole("status").textContent).toContain("2 new entries");
  });

  it("keeps the last count shown when a later check fails", async () => {
    fetchMock
      .mockResolvedValueOnce(counted(2))
      .mockResolvedValueOnce(new Response("", { status: 503 }));
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);

    await wait(CHECK_INTERVAL * 2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toContain("2 new entries");
  });

  it("stops asking once a check is answered as signed out, even when the tab is shown again", async () => {
    fetchMock.mockResolvedValue(new Response("Sign in to check the log.", { status: 401 }));
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);

    await wait(CHECK_INTERVAL);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await wait(CHECK_INTERVAL * 3);
    setVisibility("hidden");
    setVisibility("visible");
    await wait(CHECK_INTERVAL * 2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("reloads the page when Show is pressed on the first page", async () => {
    fetchMock.mockResolvedValue(counted(2));
    render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);
    await wait(CHECK_INTERVAL);

    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the first page of the same filters when Show is pressed on a later page", async () => {
    fetchMock.mockResolvedValue(counted(2));
    const filters: LogFilters = { ...NO_FILTERS, level: ["warn"], q: "milk", page: 3 };
    render(<NewEntriesNotice filters={filters} readAt={READ_AT} page={3} />);
    await wait(CHECK_INTERVAL);

    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(push).toHaveBeenCalledWith("/logs?q=milk&level=warn");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("goes once the page has been read again, and counts from the new moment", async () => {
    fetchMock.mockResolvedValue(counted(2));
    const { rerender } = render(
      <NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />
    );
    await wait(CHECK_INTERVAL);
    expect(screen.getByRole("status").textContent).toContain("2 new entries");

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(counted(0));
    rerender(<NewEntriesNotice filters={NO_FILTERS} readAt="2026-11-20T08:20:00.000Z" page={1} />);
    expect(screen.getByRole("status").textContent).toBe("");

    await wait(CHECK_INTERVAL);
    expect(asked()).toEqual(["/api/logs/new?readAt=2026-11-20T08%3A20%3A00.000Z"]);
  });

  it("drops a check still on its way when the page is read again, so its count is never shown", async () => {
    // A check that is never answered, so it is still on its way.
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}));
    const { rerender } = render(
      <NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />
    );
    await wait(CHECK_INTERVAL);
    const signal = fetchMock.mock.calls[0][1]?.signal;

    rerender(<NewEntriesNotice filters={NO_FILTERS} readAt="2026-11-20T08:20:00.000Z" page={1} />);

    expect(signal?.aborted).toBe(true);
  });

  it("moves focus to the list's first entry once Show has brought the new entries in", async () => {
    fetchMock.mockResolvedValue(counted(1));
    /** The notice beside a list with two entries, as the page lays them out.
     *
     * @param readAt When the page's counts were read.
     * @returns The elements.
     */
    const page = (readAt: string) => (
      <>
        <NewEntriesNotice filters={NO_FILTERS} readAt={readAt} page={1} />
        <div data-log-list="">
          <details>
            <summary>Newest</summary>
          </details>
          <details>
            <summary>Older</summary>
          </details>
        </div>
      </>
    );
    const { rerender } = render(page(READ_AT));
    await wait(CHECK_INTERVAL);

    const show = screen.getByRole("button", { name: "Show" });
    show.focus();
    fireEvent.click(show);
    rerender(page("2026-11-20T08:20:00.000Z"));

    expect(document.activeElement?.textContent).toBe("Newest");
  });

  it("leaves focus where it is when the page is read again for another reason", async () => {
    render(<button type="button">Purge</button>);
    const purge = screen.getByRole("button", { name: "Purge" });
    const { rerender } = render(
      <>
        <NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />
        <div data-log-list="">
          <details>
            <summary>Newest</summary>
          </details>
        </div>
      </>
    );
    purge.focus();

    rerender(
      <>
        <NewEntriesNotice filters={NO_FILTERS} readAt="2026-11-20T08:20:00.000Z" page={1} />
        <div data-log-list="">
          <details>
            <summary>Newest</summary>
          </details>
        </div>
      </>
    );

    expect(document.activeElement).toBe(purge);
  });

  it("stops asking once it leaves the page", async () => {
    const { unmount } = render(<NewEntriesNotice filters={NO_FILTERS} readAt={READ_AT} page={1} />);
    unmount();

    await wait(CHECK_INTERVAL * 3);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
