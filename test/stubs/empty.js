// No-op stand-in for the `server-only` marker package.
//
// `server-only` is provided by Next's bundler at build time (it aliases the
// bare specifier to its own compiled copy). Outside of a Next build the
// specifier doesn't resolve, so in tests we alias it to this empty module via
// vitest.config.ts. It exists purely so `import "server-only"` is a harmless
// no-op when session.ts is loaded by the test runner.
export {};
