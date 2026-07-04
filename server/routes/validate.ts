import type { Response } from "express";
import type { z } from "zod";

/**
 * Validates a request body against a zod schema at the trust boundary.
 *
 * zod strips unknown keys by default, so a single `safeParse` both type-checks
 * known fields (defeating type-juggling — e.g. an object where a string is
 * expected) and drops keys the schema doesn't define (defeating mass-assignment
 * of columns the caller shouldn't control). At the call site, `.omit()` any
 * server-injected fields (userId, applicationId, status, timestamps) from the
 * schema so the client cannot supply them at all, then spread the trusted
 * server values onto the parsed result.
 *
 * On failure this writes a 400 with per-field errors and returns `undefined`;
 * callers must `if (data === undefined) return;` before using the value.
 */
export function parseBodyOr400<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
  res: Response,
): z.infer<T> | undefined {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten().fieldErrors,
    });
    return undefined;
  }
  return parsed.data;
}
