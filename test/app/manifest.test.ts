import { readFileSync } from "node:fs";

import sharp from "sharp";
import { describe, it, expect, vi } from "vitest";

// proxy.ts imports the session module for its cookie read; only its `config`
// is wanted here.
vi.mock("@/src/shared/lib/session", () => ({
  getSessionFromRequest: vi.fn(),
}));

import manifest from "@/app/manifest";
import { config } from "@/proxy";
import { APP_DESCRIPTION, APP_NAME } from "@/src/shared/lib/app-identity";

const served = manifest();

/** The `--background` token from the dark block of app/globals.css.
 *
 * @returns The token's hex value, lower-cased.
 */
function backgroundToken() {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const dark = css.slice(css.indexOf(".dark {"));
  const value = /--background:\s*(#[0-9a-f]{6})/i.exec(dark)?.[1];
  if (!value) throw new Error("No --background in the .dark block of app/globals.css");
  return value.toLowerCase();
}

describe("the web app manifest", () => {
  it("names and describes the app as the document metadata does", () => {
    expect(served.name).toBe(APP_NAME);
    expect(served.short_name).toBe(APP_NAME);
    expect(served.description).toBe(APP_DESCRIPTION);
  });

  // "browser" is a valid display mode, and the one that stops the app being
  // installable at all.
  it("opens in a window of its own", () => {
    expect(served.display).toBe("standalone");
    expect(served.start_url).toBe("/");
  });

  // A seam shows above the installed app if the status bar is tinted with any
  // colour other than the page's own background.
  it("uses the page's background token for both colours", () => {
    const token = backgroundToken();
    expect(served.theme_color?.toLowerCase()).toBe(token);
    expect(served.background_color?.toLowerCase()).toBe(token);
  });

  // The manifest is public and cacheable, so nothing in it may belong to one
  // instance: no host, and no absolute URL that would carry one.
  it("holds no absolute URL", () => {
    expect(JSON.stringify(served)).not.toMatch(/[a-z][a-z0-9+.-]*:\/\//i);
  });

  describe("icons", () => {
    const icons = served.icons ?? [];

    it.each([
      ["any", "192x192"],
      ["any", "512x512"],
      ["maskable", "192x192"],
      ["maskable", "512x512"],
    ])("declares a %s icon at %s", (purpose, sizes) => {
      expect(icons.some((icon) => icon.purpose === purpose && icon.sizes === sizes)).toBe(true);
    });

    // A declared icon that is missing, or not the size it claims, is only
    // reported by the browser at install time.
    it.each(icons.map((icon) => [icon.src, icon.sizes] as const))(
      "serves %s at its declared %s",
      async (src, sizes) => {
        const file = readFileSync(new URL(`../../public${src}`, import.meta.url));
        const { width, height } = await sharp(file).metadata();
        expect(`${width}x${height}`).toBe(sizes);
      }
    );
  });
});

describe("the manifest and the auth perimeter", () => {
  // Browsers fetch the manifest and its icons without the session cookie, so
  // the login redirect must not reach them or the app silently stops being
  // installable. See the health-route test for why the matcher is anchored.
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it.each(["/manifest.webmanifest", ...(served.icons ?? []).map((icon) => icon.src)])(
    "leaves %s outside the matcher",
    (path) => {
      expect(matcher.test(path)).toBe(false);
    }
  );
});
