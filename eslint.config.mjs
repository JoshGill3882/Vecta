import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Don't flag a variable destructured only to omit it from a `...rest` sibling
  // (the "object without property X" idiom, e.g. `const { status, ...rest } = obj`).
  // `^_`-prefixed names stay ignored too, matching the usual convention.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // The Prisma client never leaves the server boundary. Application code
  // (app/, src/lib, components, …) must reach the database only through a
  // service in src/server/services — never by importing the client or the
  // `prisma` singleton directly. Enforced everywhere EXCEPT:
  //   - src/server/**  the boundary itself (db.ts + services live here)
  //   - test/**        Node-only specs that mock the singleton / build Prisma errors
  //   - prisma/**      the seed script, a server-side tool that needs the client
  {
    files: ["**/*.{ts,tsx,mts}"],
    ignores: ["src/server/**", "test/**", "prisma/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // The generated client + the raw Prisma runtime. Model *types*
              // (generated/prisma/models, …/enums) are deliberately NOT banned —
              // DTOs map from them via `import type`.
              group: [
                "@prisma/client",
                "@prisma/client/*",
                "**/generated/prisma/client",
                "**/generated/prisma/client/*",
                "**/generated/prisma/internal",
                "**/generated/prisma/internal/*",
              ],
              message:
                "Don't import the Prisma client outside src/server/. Call a service from src/server/services/ instead (model types from generated/prisma/models are fine).",
            },
            {
              group: ["@/src/server/db", "**/src/server/db"],
              message:
                "The `prisma` singleton is server-only. Call a service from src/server/services/ instead of importing src/server/db.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
