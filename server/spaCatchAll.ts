/**
 * Express path pattern for the SPA HTML catch-all — the route that hands every
 * non-API, non-asset URL to the client bundle so wouter can render it.
 *
 * The braces matter. Under Express 5 / path-to-regexp v8 a bare `/*splat`
 * requires at least one path segment, so it matches `/login` but NOT the bare
 * `/` — the homepage 404s while every deep link works. `{...}` marks the
 * wildcard optional, which restores the Express 4 catch-all semantics.
 *
 * Shared by both entrypoints (server/index-dev.ts, server/index-prod.ts) so the
 * dev and prod catch-alls cannot drift apart. Regression test:
 * tests/spaCatchAll.test.ts.
 */
export const SPA_CATCH_ALL_PATTERN = "/{*splat}";
