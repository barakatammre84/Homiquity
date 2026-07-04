import { describe, it, expect } from "vitest";
import {
  WHOLESALE_LENDERS,
  getWholesaleLender,
  isValidSubmissionTransition,
} from "../shared/wholesaleLenders";
import { simulateLenderAcknowledgment } from "../server/services/lenderSubmission";

describe("wholesale lender catalog", () => {
  it("carries the Target-5 shortlist with unique ids", () => {
    expect(WHOLESALE_LENDERS).toHaveLength(5);
    const ids = WHOLESALE_LENDERS.map(l => l.id);
    expect(new Set(ids).size).toBe(5);
    expect(getWholesaleLender("uwm")?.name).toBe("United Wholesale Mortgage");
  });

  it("no lender is marked approved until a broker agreement exists", () => {
    expect(WHOLESALE_LENDERS.every(l => l.approvalStatus === "target")).toBe(true);
  });
});

describe("submission status machine", () => {
  it("allows the happy path forward", () => {
    expect(isValidSubmissionTransition("submitted", "acknowledged")).toBe(true);
    expect(isValidSubmissionTransition("acknowledged", "in_underwriting")).toBe(true);
    expect(isValidSubmissionTransition("in_underwriting", "conditions_issued")).toBe(true);
    expect(isValidSubmissionTransition("conditions_issued", "conditions_cleared")).toBe(true);
    expect(isValidSubmissionTransition("conditions_cleared", "clear_to_close")).toBe(true);
    expect(isValidSubmissionTransition("clear_to_close", "funded")).toBe(true);
  });

  it("blocks skipping and backwards moves that make no operational sense", () => {
    expect(isValidSubmissionTransition("submitted", "funded")).toBe(false);
    expect(isValidSubmissionTransition("funded", "in_underwriting")).toBe(false);
    expect(isValidSubmissionTransition("withdrawn", "submitted")).toBe(false);
    expect(isValidSubmissionTransition("submitted", "submitted")).toBe(false);
  });

  it("permits escape to denied/withdrawn/suspended from any non-terminal status", () => {
    expect(isValidSubmissionTransition("submitted", "withdrawn")).toBe(true);
    expect(isValidSubmissionTransition("clear_to_close", "denied")).toBe(true);
    expect(isValidSubmissionTransition("in_underwriting", "suspended")).toBe(true);
    expect(isValidSubmissionTransition("suspended", "in_underwriting")).toBe(true);
    // ...but not out of terminal states.
    expect(isValidSubmissionTransition("funded", "withdrawn")).toBe(false);
    expect(isValidSubmissionTransition("denied", "suspended")).toBe(false);
  });

  it("clear_to_close can fall back to conditions_issued (lender reopens conditions)", () => {
    expect(isValidSubmissionTransition("clear_to_close", "conditions_issued")).toBe(true);
  });
});

describe("simulated lender acknowledgment", () => {
  it("is deterministic: same file + lender always yields the same confirmation", () => {
    const a = simulateLenderAcknowledgment("uwm", "app-123");
    const b = simulateLenderAcknowledgment("uwm", "app-123");
    expect(a).toEqual(b);
    expect(a.simulated).toBe(true);
  });

  it("differs across lenders and applications", () => {
    const uwm = simulateLenderAcknowledgment("uwm", "app-123");
    const rocket = simulateLenderAcknowledgment("rocket-pro-tpo", "app-123");
    const other = simulateLenderAcknowledgment("uwm", "app-456");
    expect(uwm.confirmationId).not.toBe(rocket.confirmationId);
    expect(uwm.confirmationId).not.toBe(other.confirmationId);
  });

  it("shapes the confirmation like a lender-side loan number", () => {
    const { confirmationId } = simulateLenderAcknowledgment("rocket-pro-tpo", "app-123");
    expect(confirmationId).toMatch(/^ROCK-\d{9}$/);
  });
});
