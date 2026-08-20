// Trust-boundary validation for the Homeowner Hub's profile writes.
//
// Why this file exists: `POST/PUT /api/homeowner/profile` used to hand `req.body`
// straight to Drizzle. Every field on the Hub's setup form is a controlled text
// input initialised to `""`, so an owner who filled in only the fields they knew
// still posted `purchaseDate: ""` and `originalLoanAmount: ""`. Drizzle maps a
// `timestamp` column by calling `.toISOString()` on the value and a `decimal`
// column by passing the string through to Postgres, so `""` blew up inside the
// driver and the handler's catch-all turned it into a 500 — for every owner, on
// the one button that creates the profile. Nothing downstream was reachable.
//
// The rule encoded here: **a blank control means "not answered", not "this value
// is the empty string"** — it is dropped, so the column stays NULL and stays an
// honest gap. Anything actually malformed now gets a 400 naming the field
// instead of a 500 naming nothing.
import { z } from "zod";
import { insertHomeownerProfileSchema } from "@shared/schema";

/** A control the owner left alone. `""` and `null` both mean "not answered". */
const blankToUndefined = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;

/**
 * `<input type="date">` yields `"2026-08-20"`; the annual-review action yields an
 * ISO date string. Both must reach Drizzle as a `Date`.
 */
const optionalDate = z.preprocess(blankToUndefined, z.coerce.date().optional());

/**
 * Drizzle's `decimal` columns take a string. `<input type="number">` gives one
 * already; a JSON number is accepted and stringified rather than rejected, since
 * the wire format is the caller's choice and the column's is ours.
 */
const optionalDecimal = z.preprocess(
  blankToUndefined,
  z
    .union([z.string(), z.number()])
    .refine((v) => v === "" || !Number.isNaN(Number(v)), "must be a number")
    .transform((v) => String(v))
    .optional(),
);

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().max(max).optional());

/**
 * The fields a homeowner may write on their own profile.
 *
 * `userId` is omitted deliberately: the handler supplies it from the session, so
 * the column cannot be set from the wire at all. Unknown keys are stripped by
 * zod's default object behaviour, which is the mass-assignment defence described
 * in `../validate.ts`.
 */
export const homeownerProfileWriteSchema = insertHomeownerProfileSchema
  .omit({ userId: true })
  .extend({
    propertyAddress: optionalText(500),
    originalLoanAmount: optionalDecimal,
    currentLoanBalance: optionalDecimal,
    interestRate: optionalDecimal,
    monthlyPayment: optionalDecimal,
    propertyValue: optionalDecimal,
    purchasePrice: optionalDecimal,
    purchaseDate: optionalDate,
    loanCloseDate: optionalDate,
    nextReviewDate: optionalDate,
    lastReviewDate: optionalDate,
  });

export type HomeownerProfileWrite = z.infer<typeof homeownerProfileWriteSchema>;
