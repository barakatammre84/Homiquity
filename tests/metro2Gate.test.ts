import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  padNumeric,
  padAlpha,
  assertRecordLength,
  Metro2FormatError,
} from "../shared/lib/metro2/format";
import {
  FIELD_LAYOUT,
  BASE_SEGMENT_LENGTH,
  compileBaseSegment,
  isCompilerReleased,
} from "../shared/lib/metro2/compiler";

/**
 * The Metro 2® citation gate — the mechanical form of "no document, no implementation"
 * for a fixed-width credit-bureau format.
 *
 * This mirrors tests/nonQmProgramGate.test.ts, and it is SELF-RELEASING: it does not
 * assert "the compiler is unimplemented" (which would have to be deleted the moment the
 * manual lands, i.e. exactly when attention is scarcest). It asserts the *implication* —
 * a populated layout requires a local citation — so the manual's arrival releases the
 * compiler and nothing has to be remembered.
 *
 * Pure in-process: no HTTP server, no database.
 */

const ROOT = path.resolve(__dirname, "..");
const METRO2_DOCS = path.join(ROOT, "docs", "cdia-metro2");

const authorityFiles = () =>
  fs.existsSync(METRO2_DOCS)
    ? fs.readdirSync(METRO2_DOCS).filter((f) => f.toLowerCase() !== "readme.md" && !f.startsWith("."))
    : [];

describe("metro2 gate: a populated layout requires a local citation", () => {
  it("FIELD_LAYOUT is non-empty ⇒ docs/cdia-metro2/ holds more than a README", () => {
    if (FIELD_LAYOUT.length === 0) return; // gate closed — nothing to assert
    expect(
      authorityFiles().length,
      "FIELD_LAYOUT was populated while docs/cdia-metro2/ holds only a README. A Metro 2 " +
        "layout may only be transcribed from the CDIA manual — never from memory, a vendor " +
        "blog post, or a sample file.",
    ).toBeGreaterThan(0);
  });

  it("every field carries a citation naming where it was transcribed from", () => {
    for (const field of FIELD_LAYOUT) {
      expect(field.citation?.trim(), `field ${field.name} has no citation`).toBeTruthy();
    }
  });

  it("a released compiler declares a record length; an unreleased one does not fake one", () => {
    // Summing an empty FIELD_LAYOUT would yield a confident 0. null is the honest value.
    expect(isCompilerReleased()).toBe(FIELD_LAYOUT.length > 0 && BASE_SEGMENT_LENGTH !== null);
    if (!isCompilerReleased()) expect(BASE_SEGMENT_LENGTH).toBeNull();
  });

  it("refuses to compile while unreleased, and says why in terms a reader can act on", () => {
    if (isCompilerReleased()) return;
    expect(() => compileBaseSegment({})).toThrow(Metro2FormatError);
    expect(() => compileBaseSegment({})).toThrow(/docs\/cdia-metro2/);
    expect(() => compileBaseSegment({})).toThrow(/not implemented|missing document/i);
  });
});

describe("metro2 gate: the pitched account-type value stays quarantined", () => {
  it("no Metro 2 module hardcodes the uncited '3A' account type", () => {
    // The external pitch asserted 'Account Type 3A (Unsecured rent)'. Nothing in this repo
    // confirms it. Same quarantine as the Appendix A.2 non-QM program numbers: an uncited
    // external figure may be recorded as a claim, never coded against.
    for (const file of ["shared/lib/metro2/format.ts", "shared/lib/metro2/compiler.ts"]) {
      const src = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect(src, `${file} embeds an unverified account-type code`).not.toMatch(
        /["']3A["']|ACCOUNT_TYPE\s*=/,
      );
    }
  });
});

describe("padNumeric — right-justified, zero-filled", () => {
  it("pads to width", () => {
    expect(padNumeric(42, 6)).toBe("000042");
    expect(padNumeric("7", 3)).toBe("007");
    expect(padNumeric(0, 4)).toBe("0000");
  });

  it("fills exactly at width without altering the value", () => {
    expect(padNumeric(123456, 6)).toBe("123456");
  });

  it("refuses to truncate an overflowing amount", () => {
    expect(() => padNumeric(1234567, 6)).toThrow(Metro2FormatError);
    expect(() => padNumeric(1234567, 6)).toThrow(/Refusing to truncate/);
  });

  it("refuses signs, decimals, and separators rather than guessing an implied decimal", () => {
    expect(() => padNumeric(-1, 4)).toThrow(Metro2FormatError);
    expect(() => padNumeric(12.5, 4)).toThrow(Metro2FormatError);
    expect(() => padNumeric("1,200", 8)).toThrow(Metro2FormatError);
    expect(() => padNumeric("12.00", 8)).toThrow(Metro2FormatError);
  });

  it("rejects a nonsensical field width", () => {
    expect(() => padNumeric(1, 0)).toThrow(Metro2FormatError);
    expect(() => padNumeric(1, -3)).toThrow(Metro2FormatError);
  });
});

describe("padAlpha — left-justified, blank-filled", () => {
  it("pads to width", () => {
    expect(padAlpha("ACME", 8)).toBe("ACME    ");
  });

  it("renders absence as an all-blank field", () => {
    expect(padAlpha(null, 4)).toBe("    ");
    expect(padAlpha(undefined, 4)).toBe("    ");
    expect(padAlpha("", 4)).toBe("    ");
  });

  it("refuses to truncate — shortening a name changes who the record is about", () => {
    expect(() => padAlpha("MONTGOMERY-HUTCHINSON", 10)).toThrow(Metro2FormatError);
    expect(() => padAlpha("MONTGOMERY-HUTCHINSON", 10)).toThrow(/Refusing to truncate/);
  });
});

describe("assertRecordLength", () => {
  it("accepts an exact-width record", () => {
    expect(() => assertRecordLength("x".repeat(426), 426)).not.toThrow();
  });

  it("rejects off-by-one in both directions — one position rejects a whole file", () => {
    expect(() => assertRecordLength("x".repeat(425), 426)).toThrow(/425 positions, expected exactly 426/);
    expect(() => assertRecordLength("x".repeat(427), 426)).toThrow(Metro2FormatError);
  });
});
