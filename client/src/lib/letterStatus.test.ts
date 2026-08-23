import { describe, it, expect } from "vitest";
import { PRE_APPROVAL_LETTER_STATUS } from "@shared/statusVocabularies";
import {
  selectBorrowerLetterState,
  canDownloadLetter,
  canRequestLetter,
  describeUnusableLetter,
} from "./letterStatus";

// The one selector every borrower letter surface derives from. These pin the
// property the surfaces used to break: a letter that is not currently valid
// may never render as "ready to download".

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

describe("selectBorrowerLetterState", () => {
  it("reports no letter when the file has none", () => {
    expect(selectBorrowerLetterState({ hasLetter: false })).toEqual({ kind: "none" });
    expect(selectBorrowerLetterState(undefined)).toEqual({ kind: "none" });
  });

  it("reports an issued, unexpired letter as current", () => {
    const state = selectBorrowerLetterState({
      hasLetter: true,
      letterNumber: "BN-1",
      status: "issued",
      expirationDate: FUTURE,
    });
    expect(state.kind).toBe("current");
    expect(canDownloadLetter(state)).toBe(true);
    expect(canRequestLetter(state)).toBe(false);
  });

  it("never offers a download of an expired letter, and offers a fresh one instead", () => {
    const state = selectBorrowerLetterState({
      hasLetter: true,
      letterNumber: "PQ-1",
      status: "expired",
      expirationDate: PAST,
    });
    expect(state.kind).toBe("expired");
    expect(canDownloadLetter(state)).toBe(false);
    expect(canRequestLetter(state)).toBe(true);
    expect(describeUnusableLetter(state, fmt)).toContain("expired on 2020-01-01");
  });

  it("never lets a borrower re-mint a letter their loan team revoked", () => {
    const state = selectBorrowerLetterState({
      hasLetter: true,
      letterNumber: "BN-2",
      status: "revoked",
      expirationDate: FUTURE,
    });
    expect(state.kind).toBe("withdrawn");
    expect(canDownloadLetter(state)).toBe(false);
    expect(canRequestLetter(state)).toBe(false);
    expect(describeUnusableLetter(state, fmt)).toContain("withdrew");
  });

  it("keeps the staff revocation reason out of borrower copy", () => {
    const state = selectBorrowerLetterState({ hasLetter: true, status: "revoked" });
    const copy = describeUnusableLetter(state, fmt) ?? "";
    expect(copy).not.toMatch(/reason/i);
  });

  it("covers every member of the shared letter vocabulary", () => {
    for (const status of PRE_APPROVAL_LETTER_STATUS) {
      const state = selectBorrowerLetterState({ hasLetter: true, status, expirationDate: FUTURE });
      expect(state.kind).not.toBe("none");
      // Only a live "issued" letter is downloadable, whatever the vocabulary grows to.
      expect(canDownloadLetter(state)).toBe(status === "issued");
    }
  });

  it("fails closed on a status it does not recognise", () => {
    const state = selectBorrowerLetterState({ hasLetter: true, status: "quantum" });
    expect(state).toMatchObject({ kind: "withdrawn", reason: "unrecognized" });
    expect(canDownloadLetter(state)).toBe(false);
    expect(canRequestLetter(state)).toBe(false);
  });

  it("falls back to the expiration date when a payload carries no status", () => {
    expect(selectBorrowerLetterState({ hasLetter: true, expirationDate: PAST }).kind).toBe("expired");
    expect(selectBorrowerLetterState({ hasLetter: true, expirationDate: FUTURE }).kind).toBe("current");
    expect(selectBorrowerLetterState({ hasLetter: true }).kind).toBe("current");
  });

  it("claims nothing when the status query itself failed", () => {
    const state = selectBorrowerLetterState(undefined, true);
    expect(state.kind).toBe("unknown");
    expect(canDownloadLetter(state)).toBe(false);
    expect(canRequestLetter(state)).toBe(false);
  });
});
