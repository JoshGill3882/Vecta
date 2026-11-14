import "server-only";

import { detectProvider } from "@/scripts/db-provider.mjs";
import { flushLogs, isLogLevel, logger } from "@/src/server/logger";
import { LOG_LEVELS } from "@/src/shared/lib/schemas/logs";

// What the server does once as it starts, before handling any request: refuse
// to start on invalid configuration, saying why, and record that it started.

/** The environment variables start-up reads. */
type Environment = Record<string, string | undefined>;

/** Finds the first problem with the configuration, if there is one.
 *
 * Checked in a fixed order, so the same environment always reports the same
 * problem.
 *
 * @param env The environment to check.
 * @returns A sentence saying what is wrong and how to fix it, or null when nothing is.
 */
export function configurationProblem(env: Environment): string | null {
  if (env.ADMIN_PASSWORD == null) return "ADMIN_PASSWORD environment variable is required.";
  if (env.SESSION_SECRET == null) return "SESSION_SECRET environment variable is required.";
  if (env.SESSION_SECRET.length < 32) return "SESSION_SECRET must be at least 32 characters long.";
  // Empty counts as unset, since Compose passes an unset variable through as "".
  if (env.LOG_LEVEL && !isLogLevel(env.LOG_LEVEL))
    return `LOG_LEVEL must be one of ${LOG_LEVELS.join(", ")}, or unset for info.`;
  return null;
}

/** Which database engine the configured URL points at, for the start-up entry.
 *
 * A missing or unrecognised URL is reported where the database is opened, not
 * here, so this only names it.
 *
 * @param url The configured `DATABASE_URL`.
 * @returns `sqlite`, `postgresql`, or `unknown`.
 */
function providerOf(url: string | undefined): string {
  try {
    return detectProvider(url);
  } catch {
    return "unknown";
  }
}

/** Checks the configuration and records that the server started.
 *
 * @param env The environment to start with.
 * @throws Error naming the problem when the configuration is invalid, after
 *   logging it, which stops the server from starting.
 */
export async function startUp(env: Environment): Promise<void> {
  const problem = configurationProblem(env);
  if (problem !== null) {
    logger.error("server.config_invalid", "Vecta cannot start: its configuration is invalid.", {
      problem,
    });
    // Give the table write its chance before the process stops; stdout already has it.
    await flushLogs();
    throw new Error(problem);
  }

  logger.info("server.started", "Vecta started", {
    version: env.VECTA_BUILD_VERSION || "dev",
    revision: env.VECTA_BUILD_REVISION || "unknown",
    provider: providerOf(env.DATABASE_URL),
  });
}
