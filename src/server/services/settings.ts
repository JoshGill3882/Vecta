import "server-only";

import { prisma } from "@/src/server/db";
import { LogRetentionDays, SettingsDTO, toSettingsDTO } from "@/src/shared/lib/dtos/settings";
import { logRetentionDaysSchema } from "@/src/shared/lib/schemas/settings";

// Settings service - the only code that reads or writes the Settings table.
// The table holds one row, created the first time anything is saved to it, so
// a read copes with there being none yet. Each write sets only its own columns,
// so a change of retention and an age-out run finishing together both stick.

/** The id of the one row of settings. */
const SETTINGS_ID = 1;

/** Reads the app-wide settings.
 *
 * @returns The settings, with the defaults for anything never saved.
 */
export async function getSettings(): Promise<SettingsDTO> {
  const row = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
  return toSettingsDTO(row);
}

/** Chooses how long the log keeps its entries.
 *
 * Nothing is deleted here: the next age-out run uses the new choice.
 *
 * @param days How many days to keep entries for, or 0 to keep them forever.
 * @returns The settings, as saved.
 * @throws ZodError when `days` is not one of the choices.
 */
export async function setLogRetention(days: LogRetentionDays): Promise<SettingsDTO> {
  const checked = logRetentionDaysSchema.parse(days);
  const row = await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, logRetentionDays: checked },
    update: { logRetentionDays: checked },
  });
  return toSettingsDTO(row);
}

/** Records an age-out run, so the Logs page can say when it ran and what it removed.
 *
 * @param ranAt When the run happened.
 * @param removed How many entries it removed.
 */
export async function recordAgeOut(ranAt: Date, removed: number): Promise<void> {
  const run = { logAgeOutRanAt: ranAt, logAgeOutRemoved: removed };
  await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...run },
    update: run,
  });
}
