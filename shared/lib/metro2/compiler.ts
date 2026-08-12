import { type FieldSpec, Metro2FormatError, assertRecordLength, padAlpha, padNumeric } from "./format";

/**
 * Metro 2® base-segment compiler — DELIBERATELY UNIMPLEMENTED.
 *
 * This file is the seam, not the implementation. It exists so the shape of the work is
 * visible and so a single, well-named error explains why no record can be produced.
 *
 * WHY IT IS EMPTY RATHER THAN GUESSED. The CDIA Metro 2® Format Manual is not in this
 * repo (docs/cdia-metro2/README.md), and unlike the Reg Z blocker it cannot be fetched
 * at all — CDIA licenses it to members and vetted furnishers. Writing the layout from
 * memory would not fail loudly: it would produce a well-formed file whose fields land in
 * the wrong columns. Downstream that is not a broken build, it is inaccurate information
 * on a real person's credit report, which they can only remove by filing a dispute.
 *
 * This is the same pattern as the other unimplemented vendor legs in this repo — live DU
 * throws "not implemented" in server/services/ausSubmission.ts, and a set CRS/iSoftpull
 * key throws in server/mcp/vendors.ts. An empty layout that throws is a working gate; a
 * plausible layout is a liability.
 *
 * RELEASE. Populate FIELD_LAYOUT one field at a time from the manual, each with its
 * `citation`. tests/metro2Gate.test.ts fails if the layout is populated while no
 * citation file exists under docs/cdia-metro2/, so the manual's arrival — never a
 * developer's recollection — is what releases this compiler.
 */

/**
 * The base segment's fields, in order.
 *
 * EMPTY BY DESIGN. Every entry must carry a `citation` naming the manual section and
 * page it was transcribed from.
 */
export const FIELD_LAYOUT: readonly FieldSpec[] = [];

/**
 * The base segment's fixed record width, in positions.
 *
 * `null` because it is a manual fact, not a derivable one. Deriving it by summing an
 * empty FIELD_LAYOUT would produce a confident `0`.
 */
export const BASE_SEGMENT_LENGTH: number | null = null;

/** Values a caller supplies for one tradeline. Keys are intentionally untyped against the */
/** manual's field names — those names are not known here. */
export type BaseSegmentInput = Readonly<Record<string, string | number | null | undefined>>;

/** True once the layout has been transcribed from the manual. */
export function isCompilerReleased(): boolean {
  return FIELD_LAYOUT.length > 0 && BASE_SEGMENT_LENGTH !== null;
}

/**
 * Compile one Metro 2® base segment.
 *
 * @throws {Metro2FormatError} always, until the manual lands.
 */
export function compileBaseSegment(input: BaseSegmentInput): string {
  if (!isCompilerReleased()) {
    throw new Metro2FormatError(
      "Metro 2 base-segment compilation is not implemented: the CDIA Metro 2 Format Manual " +
        "is not present in docs/cdia-metro2/, so no field position, length, or enumeration " +
        "in this repo is verifiable. This is a missing document, not a missing feature — " +
        "acquisition is a CDIA membership/procurement action a human must complete. " +
        "Do not populate FIELD_LAYOUT from memory, a vendor blog post, or a sample file: " +
        "a wrong offset yields a well-formed record whose fields land in the wrong columns, " +
        "i.e. inaccurate information on a real consumer's credit file. " +
        "See docs/cdia-metro2/README.md and ledger entry cdia-metro2-base-segment-layout.",
    );
  }

  // Unreachable today. Kept whole so that populating FIELD_LAYOUT is the ONLY step
  // needed to release the compiler — assembly must not be a second thing to invent
  // under time pressure once the manual is finally in hand.
  const positions = [...FIELD_LAYOUT].sort((a, b) => a.start - b.start);
  let record = "";
  for (const field of positions) {
    if (record.length !== field.start - 1) {
      throw new Metro2FormatError(
        `FIELD_LAYOUT is inconsistent: ${field.name} declares start ${field.start} but the ` +
          `record is ${record.length} positions long. Gaps and overlaps are both defects — ` +
          `a fixed-width layout must tile the record exactly.`,
      );
    }
    const value = input[field.name];
    record +=
      field.type === "numeric"
        ? padNumeric(value == null ? 0 : (value as string | number), field.length)
        : padAlpha(value == null ? "" : String(value), field.length);
  }

  assertRecordLength(record, BASE_SEGMENT_LENGTH as number);
  return record;
}
