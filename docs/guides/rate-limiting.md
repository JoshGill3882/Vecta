# Rate limiting

A tiny in-memory limiter deters brute-force password guessing. It's used by the
login action and is reusable on other Server Actions.

**Key file:** `src/lib/rate-limit.ts` (used in `app/login/actions.tsx`)

## API

```ts
// True if the caller is currently locked out.
isRateLimited(): boolean

// Record one failed attempt.
recordFailure(): void
```

Defaults (constants at the top of the module): **5 failures per 60-second
sliding window**. `isRateLimited()` prunes timestamps older than the window on
each call, so the window slides rather than resetting on a fixed schedule.

## How it's used

`app/login/actions.tsx` checks the limiter before doing any work and records a
failure only on a wrong password:

```ts
if (isRateLimited()) return { error: "Too many attempts. Retry in a minute" };
// ...verify password...
if (!ok) {
  recordFailure();
  return { error: "Password Invalid" };
}
```

## How to apply it to another action

```ts
"use server";
import { isRateLimited, recordFailure } from "@/src/lib/rate-limit";

export async function sensitiveAction() {
  if (isRateLimited()) return { error: "Too many attempts. Try again shortly." };
  // ...attempt...
  // on failure: recordFailure();
}
```

> Note: the failure log is a **single module-level array shared across all
> callers** — it's a global lockout, not per-IP or per-action. For the
> single-admin login that's the intent; if you need independent buckets, give
> the module a keyed map first.

## Limitations

- **In-memory and per-instance.** State lives in module memory: it resets on
  every redeploy/restart and is **not shared across multiple instances**. It's a
  brute-force speed bump, not a distributed rate limiter.
- **Not a substitute for real protection** at the edge/proxy if you deploy
  multiple replicas. See `docs/PLAN.md` for where this sits in scope.

For how this module is unit-tested (fake timers + module-state reset), see
[Testing patterns](./testing.md).
