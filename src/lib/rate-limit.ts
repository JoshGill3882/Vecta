const WINDOW_MS = 60_000;
const MAX_FAILURES = 5;

let failures: number[] = []; // epoch-ms timestamps of recent failed attempts

// True if the caller is currently locked out.
export function isRateLimited(): boolean {
  const now = Date.now();
  failures = failures.filter((t) => now - t < WINDOW_MS); // prune old ones
  return failures.length >= MAX_FAILURES;
}

// Record a failed password attempt.
export function recordFailure(): void {
  failures.push(Date.now());
}
