import { describe, it, expect, afterEach, vi } from "vitest";

// The dev-origin list is assembled when `next.config.ts` is evaluated, so each
// case re-imports the module against a stubbed environment rather than calling a
// function. `resetModules` is what makes that re-evaluation happen — without it
// the first import is cached and every later case sees the first one's list.
/** Loads the Next config with a given environment and reads the dev origins.
 *
 * The list is assembled once when the module evaluates, so the module registry
 * is reset and the config re-imported for each case.
 *
 * @param value The environment variable, or undefined to leave it unset.
 * @returns The assembled list of allowed dev origins.
 */
async function loadDevOrigins(value?: string) {
  vi.stubEnv("ALLOWED_DEV_ORIGINS", value);
  vi.resetModules();
  const config = (await import("@/next.config")).default;
  return config.allowedDevOrigins;
}

// The LAN ranges committed to the config: reachable from the home network
// without anyone setting anything.
const lanDefaults = ["192.168.*.*", "10.*.*.*", "*.local"];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("allowedDevOrigins", () => {
  it("is the committed LAN defaults when no extra origins are set", async () => {
    await expect(loadDevOrigins(undefined)).resolves.toEqual(lanDefaults);
  });

  it("is the committed LAN defaults when the variable is set but empty", async () => {
    // An empty string splits to [""], which would otherwise sit in the list as
    // an entry matching nothing.
    await expect(loadDevOrigins("")).resolves.toEqual(lanDefaults);
  });

  it("appends a single extra origin to the defaults", async () => {
    await expect(loadDevOrigins("dev.example.com")).resolves.toEqual([
      ...lanDefaults,
      "dev.example.com",
    ]);
  });

  it("appends every origin in a comma-separated list, in order", async () => {
    await expect(loadDevOrigins("dev.example.com,*.trycloudflare.com")).resolves.toEqual([
      ...lanDefaults,
      "dev.example.com",
      "*.trycloudflare.com",
    ]);
  });

  it("trims whitespace around entries", async () => {
    // Hostnames are matched literally, so a stray space would silently stop an
    // otherwise correct entry from ever matching.
    await expect(loadDevOrigins("  dev.example.com ,\t*.trycloudflare.com  ")).resolves.toEqual([
      ...lanDefaults,
      "dev.example.com",
      "*.trycloudflare.com",
    ]);
  });

  it("drops empty entries, so a trailing or doubled comma is harmless", async () => {
    await expect(loadDevOrigins("dev.example.com,,")).resolves.toEqual([
      ...lanDefaults,
      "dev.example.com",
    ]);
  });
});
