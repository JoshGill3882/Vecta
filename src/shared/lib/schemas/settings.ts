import { z } from "zod";

/** How long the log may keep its entries, in days, from shortest to longest.
 *
 * 0 keeps them forever. The order is the order the Logs page offers them in.
 */
export const LOG_RETENTION_DAYS = [7, 30, 90, 365, 0] as const;

/** How long the log keeps its entries until a retention is chosen. */
export const DEFAULT_LOG_RETENTION_DAYS = 90;

/** Checks a retention against the choices, both when it is chosen and when it is read back. */
export const logRetentionDaysSchema = z.literal(LOG_RETENTION_DAYS);
