// Sets the datasource `provider` in prisma/schema.prisma to match DATABASE_URL
// before any Prisma CLI command runs. Prisma cannot read the provider from an
// env var, so we patch the single provider line here. The committed default is
// SQLite; a `postgres://` DATABASE_URL flips it to PostgreSQL for that command.
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { detectProvider } from "./db-provider.mjs";

const schemaPath = fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url));
// The Docker build runs `prisma generate` with no DATABASE_URL (an image must
// never bake one in), so fall back to SQLite rather than throwing. This only
// decides which provider the schema is patched to — no connection is made, and
// a real DATABASE_URL at container start re-patches it before migrating.
const provider = detectProvider(process.env.DATABASE_URL, { fallback: "sqlite" });

const schema = await readFile(schemaPath, "utf8");
const providerLine = /provider = "(?:sqlite|postgresql)"/;
if (!providerLine.test(schema)) {
  throw new Error(
    `Could not find a datasource provider line in ${schemaPath}. ` +
      'Expected `provider = "sqlite"` or `provider = "postgresql"`.'
  );
}

const next = schema.replace(providerLine, `provider = "${provider}"`);
if (next !== schema) {
  await writeFile(schemaPath, next);
  console.log(`prisma: datasource provider set to "${provider}" (from DATABASE_URL)`);
} else {
  console.log(`prisma: datasource provider already "${provider}"`);
}
