// Runs once when a new Next.js server instance starts, before any request is
// handled. Throwing here aborts startup, so the app refuses to boot when the
// required environment variables are missing or invalid.
export async function register() {
  // Only start up in the Node.js runtime; env-based secrets are not available
  // (and not meaningful) on the Edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  // Imported here rather than at the top: this file is also built for the Edge
  // runtime, which cannot load the Node-only logger behind start-up.
  const { startUp } = await import("@/src/server/start-up");
  await startUp(process.env);
}
