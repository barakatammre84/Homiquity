// Audit finding F-14 — which channel is Homiquity in?
//
// The codebase was building toward two incompatible answers at once and no
// reader could tell which. These tests pin the declared answer and the
// consequences that hang off it, so the channel cannot drift by accident.
import { describe, it, expect } from "vitest";
import {
  BUSINESS_CHANNEL,
  BUSINESS_CHANNELS,
  deliveryStackApplicability,
  holdsFundingRisk,
  isSellerServicerChannel,
  mersOrgIdApplicable,
} from "../shared/businessChannel";

describe("F-14 — the channel is declared, not implied", () => {
  it("declares broker today", () => {
    // If this test fails, someone changed the company's capital structure.
    // That is a founder decision — see CHANNEL_DECISION.md §3 for what must be
    // true first, and expect the contingent-liability register to be
    // materially incomplete until it is extended.
    expect(BUSINESS_CHANNEL).toBe("broker");
    expect(BUSINESS_CHANNELS).toContain(BUSINESS_CHANNEL);
  });

  it("says a broker is not the seller/servicer and takes no funding risk", () => {
    expect(isSellerServicerChannel("broker")).toBe(false);
    expect(holdsFundingRisk("broker")).toBe(false);
  });

  it("says a correspondent is both", () => {
    expect(isSellerServicerChannel("correspondent")).toBe(true);
    expect(holdsFundingRisk("correspondent")).toBe(true);
  });
});

describe("F-14 — the delivery stack knows it is out of channel", () => {
  it("marks GSE delivery readiness informational for a broker", () => {
    const applicability = deliveryStackApplicability("broker");
    expect(applicability.applicable).toBe(false);
    expect(applicability.message).toMatch(/INFORMATIONAL ONLY/);
    // The two claims that matter: whose obligation it is, and that it gates
    // nothing on our side.
    expect(applicability.message).toMatch(/wholesale lender is the seller\/servicer/i);
    expect(applicability.message).toMatch(/gates a broker submission/i);
  });

  it("makes it binding for a correspondent", () => {
    const applicability = deliveryStackApplicability("correspondent");
    expect(applicability.applicable).toBe(true);
    expect(applicability.message).toMatch(/binding obligations/i);
  });
});

describe("F-14 — MERS follows the channel", () => {
  it("is inapplicable for a broker — no notes held, nothing to register", () => {
    // Previously "PENDING", which read as merely late and kept an annual
    // membership fee on the roadmap for a registry with nothing in it.
    expect(mersOrgIdApplicable("broker")).toBe(false);
  });

  it("becomes required for a correspondent", () => {
    expect(mersOrgIdApplicable("correspondent")).toBe(true);
  });

  it("keeps the company config honest about which it is", async () => {
    const { COMPANY_CONFIG } = await import("../server/config/company");
    expect(COMPANY_CONFIG.mersOrgId).toBe(
      mersOrgIdApplicable() ? "PENDING" : "NOT_APPLICABLE_BROKER_CHANNEL",
    );
  });
});
