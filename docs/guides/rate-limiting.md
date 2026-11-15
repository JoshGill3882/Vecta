# Rate limiting

A tiny in-memory limiter deters brute-force password guessing.
Signing in uses it, and it is reusable wherever repeated failures should be slowed down.

**Key file:** `src/server/rate-limit.ts` (used in `src/server/services/auth.ts`)

## API

```ts
// True if the caller is currently locked out.
isRateLimited(): boolean

// Record one failed attempt.
recordFailure(): void
```

Defaults (constants at the top of the module): **5 failures per 60-second sliding window**.
`isRateLimited()` prunes timestamps older than the window on each call, so the window slides rather than resetting on a fixed schedule.

## How it's used

`signIn()` in `src/server/services/auth.ts` checks the limiter before doing any work, and records a failure only on a wrong password.
Each outcome is returned to the login action, which turns it into the message the form shows, and each is recorded as activity:

```ts
if (isRateLimited()) {
  logger.activity.warn("auth.sign_in_failed", "Sign-in failed", { reason: "rate_limited" });
  return "rate_limited";
}
// ...verify password...
if (!ok) {
  recordFailure();
  logger.activity.warn("auth.sign_in_failed", "Sign-in failed", { reason: "wrong_password" });
  return "wrong_password";
}
```

A refused attempt is recorded as well as a wrong one, because a burst of them is the clearest sign that someone is guessing.

## How to apply it elsewhere

Call it from the server-side code that decides whether an attempt failed, as `signIn()` does:

```ts
import { isRateLimited, recordFailure } from "@/src/server/rate-limit";

export async function sensitiveOperation(): Promise<"ok" | "failed" | "rate_limited"> {
  if (isRateLimited()) return "rate_limited";
  // ...attempt...
  // on failure: recordFailure(); return "failed";
}
```

> Note: the failure log is a **single module-level array shared across all callers** — it's a global lockout, not per-IP or per-operation.
> For the single-admin sign-in that's the intent; if you need independent buckets, give the module a keyed map first.

## Limitations

- **In-memory and per-instance.** State lives in module memory:
  it resets on every redeploy/restart and is **not shared across multiple instances**.
  It's a brute-force speed bump, not a distributed rate limiter.
- **Not a substitute for real protection** at the edge/proxy if you deploy multiple replicas.

For how this module is unit-tested (fake timers + module-state reset), see [Testing patterns](./testing.md).
