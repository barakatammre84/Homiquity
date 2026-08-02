import type { Request } from "express";

/**
 * Express 5 widened `req.params` values from `string` to `string | string[]`.
 *
 * The reason is path-to-regexp v8: a wildcard capture (`/objects/*objectPath`)
 * comes back as an ARRAY of path segments — `/objects/a/b.pdf` yields
 * `["a", "b.pdf"]` — whereas a named param (`/:id`) is always a single string.
 * Because the widening lives on the shared index signature, it applies to every
 * param, named or not.
 *
 * These helpers narrow at the read boundary. The array case is rejoined into
 * the path it was captured from rather than cast away, so a wildcard route that
 * later starts reading its capture gets a usable value instead of a silent
 * `"a,b.pdf"` from implicit Array#toString.
 *
 * Behaviour is otherwise identical to the Express 4 reads these replaced: for a
 * named param the value is returned exactly as before.
 */

function narrow(value: string | string[]): string {
  return Array.isArray(value) ? value.join("/") : value;
}

/** Read one route param as a string. Replaces `req.params.foo`. */
export function routeParam(req: Request, name: string): string {
  return narrow(req.params[name]);
}

/** All route params as strings. Replaces destructuring `req.params` directly. */
export function routeParams(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.params)) {
    out[key] = narrow(value);
  }
  return out;
}
