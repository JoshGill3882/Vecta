import { defineConfig, configDefaults } from "vitest/config";
import { fileURLToPath } from "node:url";

// Shared module aliases — applied to every project so `@/…` and the `server-only`
// stub resolve identically in unit and integration runs.
const alias = {
  // See test/stubs/empty.js — `server-only` only exists inside a Next build, so
  // point it at a no-op module for tests.
  "server-only": fileURLToPath(new URL("./test/stubs/empty.js", import.meta.url)),
  // Mirror the tsconfig `@/*` path alias so modules that import via `@/...`
  // (e.g. the server actions) resolve when loaded by the test runner.
  "@/": fileURLToPath(new URL("./", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          // Fast unit tests: collaborators are mocked, no real database.
          name: "unit",
          environment: "node",
          include: ["test/**/*.test.ts"],
          // Integration specs run under their own project (real DB + setup).
          exclude: [...configDefaults.exclude, "test/integration/**"],
        },
      },
      {
        resolve: { alias },
        test: {
          // Component tests: React rendered into jsdom. Its own project so the
          // unit project keeps a `node` environment and stays quick to run alone.
          name: "component",
          environment: "jsdom",
          include: ["test/**/*.test.tsx"],
          setupFiles: ["test/component/setup.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          // Integration tests: real service + Prisma against an in-memory SQLite
          // DB. `file::memory:` is required (not bare `:memory:`) so the provider
          // resolver detects SQLite; the adapter strips `file:` back to `:memory:`.
          name: "integration",
          environment: "node",
          include: ["test/integration/**/*.int.test.ts"],
          env: { DATABASE_URL: "file::memory:" },
          setupFiles: ["test/integration/setup.ts"],
        },
      },
    ],
  },
});
