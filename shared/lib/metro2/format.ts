/**
 * Metro 2® fixed-width formatting primitives.
 *
 * WHAT THIS FILE IS. The *mechanics* of a fixed-width record: justification, fill,
 * and length assertion. These are properties of fixed-width encoding itself, so they
 * can be written and tested without the CDIA manual.
 *
 * WHAT THIS FILE IS NOT. It contains no field names, no offsets, no lengths, and no
 * enumerations. Those live in the manual, which this repo does not have — see
 * docs/cdia-metro2/README.md. `compiler.ts` holds the (empty) layout and throws.
 *
 * WHY EVERY OVERFLOW THROWS. In a fixed-width format a value that does not fit has
 * exactly two possible handlings — truncate or reject — and they are not
 * interchangeable: truncating a numeric field changes an amount, and truncating a
 * name field changes who the record is about. Which one Metro 2® prescribes, per
 * field, is a manual question. Until it is answered, refusing is the only option that
 * cannot silently corrupt a statement about a consumer. A thrown error is a bug
 * report; a truncated field is a credit-report defect nobody sees.
 */

/** One field's position in a record. Populated only from the manual, never from memory. */
export interface FieldSpec {
  /** Field name exactly as the manual spells it. */
  readonly name: string;
  /** 1-based start position, per the manual's own convention. */
  readonly start: number;
  readonly length: number;
  readonly type: "numeric" | "alphanumeric";
  /** Manual section and page this spec was transcribed from. Required — no citation, no field. */
  readonly citation: string;
}

export class Metro2FormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Metro2FormatError";
  }
}

/**
 * Numeric field: right-justified, zero-filled.
 *
 * Accepts a non-negative integer or a string of digits. Rejects signs, decimal points,
 * separators, and anything longer than the field — a numeric field that overflows is an
 * amount that would be reported wrongly.
 */
export function padNumeric(value: string | number, length: number): string {
  assertLength(length);

  let digits: string;
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new Metro2FormatError(
        `padNumeric: expected a non-negative integer, received ${value}. Scale a currency ` +
          `amount to its smallest unit before formatting — this function will not guess where ` +
          `an implied decimal belongs.`,
      );
    }
    digits = String(value);
  } else {
    if (!/^\d+$/.test(value)) {
      throw new Metro2FormatError(
        `padNumeric: expected digits only, received ${JSON.stringify(value)}.`,
      );
    }
    digits = value;
  }

  if (digits.length > length) {
    throw new Metro2FormatError(
      `padNumeric: value ${digits} needs ${digits.length} positions but the field is ${length}. ` +
        `Refusing to truncate a numeric field.`,
    );
  }
  return digits.padStart(length, "0");
}

/**
 * Alphanumeric field: left-justified, blank-filled.
 *
 * An empty/undefined value yields an all-blank field, which is how fixed-width formats
 * express absence. Overflow throws — see the file header on why truncation is not this
 * module's decision to make.
 */
export function padAlpha(value: string | null | undefined, length: number): string {
  assertLength(length);

  const text = value == null ? "" : String(value);
  if (text.length > length) {
    throw new Metro2FormatError(
      `padAlpha: value of ${text.length} characters exceeds the ${length}-position field. ` +
        `Refusing to truncate: the manual's per-field truncation rule is not in this repo ` +
        `(docs/cdia-metro2/README.md), and silently shortening a consumer's name or address ` +
        `changes who a record is about.`,
    );
  }
  return text.padEnd(length, " ");
}

/**
 * Assert an assembled record is exactly the expected width.
 *
 * The last line of defence: bureaus reject a whole file when one record is off by a
 * single position, and a length that is merely *plausible* is the failure mode this
 * catches.
 */
export function assertRecordLength(record: string, expected: number): void {
  assertLength(expected);
  if (record.length !== expected) {
    throw new Metro2FormatError(
      `assertRecordLength: record is ${record.length} positions, expected exactly ${expected}.`,
    );
  }
}

function assertLength(length: number): void {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Metro2FormatError(`field length must be a positive integer, received ${length}`);
  }
}
