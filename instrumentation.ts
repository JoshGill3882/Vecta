// Runs once when a new Next.js server instance starts, before any request is
// handled. Throwing here aborts startup, so the app refuses to boot when the
// required environment variables are missing or invalid.
export function register() {
  // Only validate in the Node.js runtime; env-based secrets are not available
  // (and not meaningful) on the Edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { ADMIN_PASSWORD, SESSION_SECRET } = process.env;

  if (ADMIN_PASSWORD == null) {
    throw new Error("ADMIN_PASSWORD environment variable is required.");
  }

  if (SESSION_SECRET == null) {
    throw new Error("SESSION_SECRET environment variable is required.");
  }

  if (SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long.");
  }
}
