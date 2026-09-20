/** How far back a failed attempt counts, in milliseconds. */
const WINDOW_MS = 60_000;
/** Failures allowed inside the window before sign-in is refused. */
const MAX_FAILURES = 5;

/** Epoch-ms timestamps of recent failed attempts, oldest first. */
let failures: number[] = []; // epoch-ms timestamps of recent failed attempts

// True if the caller is currently locked out.
/** Whether sign-in is currently refused.
 *
 * @returns True once the window holds too many failures.
 */
export function isRateLimited(): boolean {
  const now = Date.now();
  failures = failures.filter((t) => now - t < WINDOW_MS); // prune old ones
  return failures.length >= MAX_FAILURES;
}

// Record a failed password attempt.
/** Records a failed attempt against the window. */
export function recordFailure(): void {
  failures.push(Date.now());
}
