/** Generates one Prisma client per supported provider, into generated/prisma-<provider>.
 * Both ship in the bundle; src/server/db.ts and prisma/seed.ts pick between them at
 * runtime based on the DATABASE_URL environment variable.
 */
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const base = await readFile(join(root, "prisma/schema.prisma"), "utf8");

for (const provider of ["sqlite", "postgresql"]) {
  const dir = await mkdtemp(join(tmpdir(), "prisma-gen-"));
  const schema = join(dir, "schema.prisma");
  await writeFile(
    schema,
    base
      .replace(/provider = "(?:sqlite|postgresql)"/, `provider = "${provider}"`)
      .replace(/output\s+=\s+"[^"]*"/, `output  = "${join(root, `generated/prisma-${provider}`)}"`)
  );
  console.log(`prisma: generating ${provider} client`);
  execFileSync("npx", ["prisma", "generate", "--schema", schema], { stdio: "inherit", cwd: root });
}
