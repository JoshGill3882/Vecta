import type { SettingsModel } from "@/generated/prisma-sqlite/models";
import {
  DEFAULT_LOG_RETENTION_DAYS,
  type LOG_RETENTION_DAYS,
  logRetentionDaysSchema,
} from "@/src/shared/lib/schemas/settings";

/** How long the log keeps its entries, in days, or 0 for forever. */
export type LogRetentionDays = (typeof LOG_RETENTION_DAYS)[number];

/** The last time old entries were aged out of the log. */
export interface AgeOutRunDTO {
  /** ISO 8601 timestamp of when it ran. */
  ranAt: string;
  /** How many entries it removed. */
  removed: number;
}

/** The app-wide settings as they cross to the client: plain, serialisable, no Prisma types. */
export interface SettingsDTO {
  /** How long the log keeps its entries, in days, or 0 for forever. */
  logRetentionDays: LogRetentionDays;
  /** The last age-out run, or null when there has not been one. */
  lastAgeOut: AgeOutRunDTO | null;
}

/** What the Logs page shows about retention: the choice, what is due to go, and the last run. */
export interface RetentionStatusDTO extends SettingsDTO {
  /** ISO 8601 timestamp an entry must be older than to be removed, or null when kept forever. */
  cutoff: string | null;
  /** How many entries are older than the cut-off; 0 when kept forever. */
  dueForRemoval: number;
}

/** Converts the settings row into the shape a client can receive.
 *
 * A stored retention that is not one of the choices reads as the default, so
 * a row edited by hand cannot stop the Logs page from showing.
 *
 * @param model The settings row as Prisma returns it, or null when none has been saved.
 * @returns The settings, with the defaults for anything never saved.
 */
export function toSettingsDTO(model: SettingsModel | null): SettingsDTO {
  if (model === null) return { logRetentionDays: DEFAULT_LOG_RETENTION_DAYS, lastAgeOut: null };

  const days = logRetentionDaysSchema.safeParse(model.logRetentionDays);
  const ranAt = model.logAgeOutRanAt;
  const removed = model.logAgeOutRemoved;
  return {
    logRetentionDays: days.success ? days.data : DEFAULT_LOG_RETENTION_DAYS,
    lastAgeOut: ranAt === null || removed === null ? null : { ranAt: ranAt.toISOString(), removed },
  };
}
