import { describe, it, expect } from "vitest";

// Pure function — no DB, no env, no mocks needed. We import it straight from the
// .mjs module (Vitest handles JS + TS side by side) and just feed it URLs.
import { detectProvider, MIGRATIONS_DIR } from "../../scripts/db-provider.mjs";

describe("detectProvider", () => {
  describe("PostgreSQL URLs", () => {
    it("detects a postgres:// URL", () => {
      expect(detectProvider("postgres://user:pass@localhost:5432/db")).toBe("postgresql");
    });

    it("detects a postgresql:// URL", () => {
      expect(detectProvider("postgresql://user:pass@localhost:5432/db")).toBe("postgresql");
    });

    it("is case-insensitive on the scheme", () => {
      expect(detectProvider("POSTGRES://localhost/db")).toBe("postgresql");
    });
  });

  describe("SQLite URLs", () => {
    it("detects a file: URL", () => {
      expect(detectProvider("file:./data/app.db")).toBe("sqlite");
    });

    it("is case-insensitive on the scheme", () => {
      expect(detectProvider("FILE:./data/app.db")).toBe("sqlite");
    });
  });

  describe("missing URL", () => {
    it("returns the fallback when one is given", () => {
      expect(detectProvider(undefined, { fallback: "sqlite" })).toBe("sqlite");
      expect(detectProvider(undefined, { fallback: "postgresql" })).toBe("postgresql");
    });

    it("throws when no URL and no fallback", () => {
      expect(() => detectProvider(undefined)).toThrow(/DATABASE_URL is not set/);
    });
  });

  describe("unsupported URLs", () => {
    it("throws on an unrecognised scheme", () => {
      expect(() => detectProvider("mysql://localhost/db")).toThrow(/Unsupported DATABASE_URL/);
    });
  });
});

describe("MIGRATIONS_DIR", () => {
  // A small guard so the detected provider always has a migrations home, and a
  // typo in either constant gets caught. Cheap insurance for a load-bearing map.
  it("maps each provider to its committed migrations directory", () => {
    expect(MIGRATIONS_DIR.sqlite).toBe("prisma/migrations/sqlite");
    expect(MIGRATIONS_DIR.postgresql).toBe("prisma/migrations/postgres");
  });
});
