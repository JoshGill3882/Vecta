import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Server-side code: run in plain Node, not a browser-like (jsdom) env.
    environment: "node",
  },
  resolve: {
    alias: {
      // See test/stubs/empty.js — `server-only` only exists inside a Next
      // build, so point it at a no-op module for tests.
      "server-only": fileURLToPath(new URL("./test/stubs/empty.js", import.meta.url)),
    },
  },
});
