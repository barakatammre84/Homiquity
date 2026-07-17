import { describe, expect, it } from "vitest";
import {
  detectSensitiveInput,
  SENSITIVE_INPUT_MESSAGES,
  SENSITIVE_INPUT_REDACTED_PLACEHOLDER,
} from "../server/services/sensitiveInputGuard";

/**
 * Coach input-side sensitive-data guard (2026-07-17 adjudication gap B).
 * The matrix below is the contract: dashed/spaced SSN shapes always trip,
 * bare 9-digit runs trip only without a non-SSN context word, and dates trip
 * only alongside a birth-date keyword. False positives redact a borrower
 * message (annoying); false negatives put an SSN in model context and logs
 * (unacceptable) — so ambiguity resolves toward detection.
 */

describe("detectSensitiveInput — SSN shapes", () => {
  it.each([
    "my ssn is 123-45-6789",
    "SSN: 987-65-4321 thanks",
    "it's 123 45 6789",
    "123456789",
    "sure — 123456789 is the number you asked about",
    "the number is 123456789.",
  ])("detects %j", (text) => {
    expect(detectSensitiveInput(text)?.kind).toBe("ssn");
  });

  it.each([
    "my account number is 123456789",
    "acct # 123456789",
    "routing number: 123456789",
    "ABA 123456789",
    "NMLS# 123456789",
    "case id 123456789",
    "loan number 123456789",
    "confirmation 123456789",
    "reference: 123456789",
    "call me at 5551234567", // 10 digits — not an SSN run
    "the price is $123,456,789", // commas break the run
    "order 1234567890123", // longer run — not 9 exact
  ])("allows %j", (text) => {
    expect(detectSensitiveInput(text)).toBeNull();
  });
});

describe("detectSensitiveInput — DOB shapes", () => {
  it.each([
    "my date of birth is 01/02/1990",
    "DOB: 1-2-90",
    "d.o.b. 12.31.1985",
    "I was born on 3/4/1985",
    "my birthday is 06/07/1992",
  ])("detects %j", (text) => {
    expect(detectSensitiveInput(text)?.kind).toBe("dob");
  });

  it.each([
    "we're closing on 01/02/2026",
    "the lease runs 1/1/2025 to 12/31/2025",
    "rate as of 07/17/2026",
    "born in Chicago", // keyword without a date shape
  ])("allows %j", (text) => {
    expect(detectSensitiveInput(text)).toBeNull();
  });
});

describe("detectSensitiveInput — precedence and edges", () => {
  it("classifies a message containing both shapes as ssn (the sharper exposure)", () => {
    expect(
      detectSensitiveInput("ssn 123-45-6789, dob 01/02/1990")?.kind,
    ).toBe("ssn");
  });

  it("handles empty and non-string-ish input", () => {
    expect(detectSensitiveInput("")).toBeNull();
    expect(detectSensitiveInput("hello, what documents do I need?")).toBeNull();
  });
});

describe("guard constants", () => {
  it("the redacted placeholder contains no digits (nothing sensitive survives)", () => {
    expect(SENSITIVE_INPUT_REDACTED_PLACEHOLDER).not.toMatch(/\d/);
  });

  it("the canned replies never guarantee anything and point to the secure channel", () => {
    for (const message of Object.values(SENSITIVE_INPUT_MESSAGES)) {
      expect(message.toLowerCase()).toContain("secure");
      expect(message.toLowerCase()).not.toContain("approved");
      expect(message.toLowerCase()).not.toContain("guarantee");
    }
  });
});
