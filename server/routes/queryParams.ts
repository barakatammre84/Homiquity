/**
 * Collapse an Express query-string value to a scalar.
 *
 * Express parses query strings with `qs`, so a parameter a handler expects to
 * be a scalar can arrive as an array (`?x=a&x=b`, `?x[]=a`) or a nested object
 * (`?x[a]=b`). The old `req.query.x as string` casts handed those straight to
 * string methods (`.trim()`, `.split()`, …), which throws a TypeError inside an
 * async handler — an unhandled rejection / 500 that is attacker-reachable on
 * unauthenticated routes.
 *
 * Contract:
 * - string           → returned unchanged (scalar behavior is identical)
 * - array            → its first string element, else undefined (repeated key: first wins)
 * - object / missing → undefined
 *
 * Read every scalar query param through this instead of casting `as string`.
 */
export function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first: unknown = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
}
