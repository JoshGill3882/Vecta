import { DomainError } from "@/src/server/errors";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

export function toActionError(e: unknown): ActionResult<never> {
  // Anticipated: safe to surface a friendly message + machine-readable code
  if (e instanceof DomainError) {
    return { ok: false, error: e.message, code: e.code };
  }
  // Unanticipated: record for observability, return a generic message
  console.error("[action] unexpected error", e); // or your logger
  return { ok: false, error: "Something went wrong. Please try again." };
}
