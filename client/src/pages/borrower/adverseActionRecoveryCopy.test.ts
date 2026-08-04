import { describe, it, expect } from "vitest";
import { lintOutboundText } from "@shared/compliance/loCommsLint";
import { RECOVERY_CARD } from "./adverseActionRecoveryCopy";

// The recovery card renders alongside the ECOA adverse-action notice, so its
// copy is held to the outbound-comms lexicon plus two structural rules the
// lexicon can't express: no digits at all (rules out every Reg Z trigger-term
// shape), and no denial vocabulary (the notice owns the decision disclosure).

const ALL_STRINGS = [
  RECOVERY_CARD.title,
  RECOVERY_CARD.body,
  RECOVERY_CARD.primaryCta.label,
  RECOVERY_CARD.secondaryCta.label,
];

describe("adverse-action recovery card copy", () => {
  it("passes the outbound-comms lint with nothing to override", () => {
    for (const text of ALL_STRINGS) {
      const result = lintOutboundText(text);
      expect(result.blocked, `blocked: "${text}"`).toBe(false);
      expect(result.requiresOverride, `requiresOverride: "${text}"`).toBe(false);
      expect(result.promiseMatches, `promises in: "${text}"`).toHaveLength(0);
    }
  });

  it("contains no digits (structurally no Reg Z trigger terms)", () => {
    for (const text of ALL_STRINGS) {
      expect(/\d/.test(text), `digit in: "${text}"`).toBe(false);
    }
  });

  it("contains no denial vocabulary or timeline promises", () => {
    for (const text of ALL_STRINGS) {
      expect(/den(y|ial|ied)|reject|declin/i.test(text), `denial word in: "${text}"`).toBe(false);
      expect(/\bdays?\b|\bweeks?\b|\bmonths?\b|soon\b/i.test(text), `timeline in: "${text}"`).toBe(false);
    }
  });

  it("links only to the readiness surfaces", () => {
    expect(RECOVERY_CARD.primaryCta.href).toBe("/dashboard");
    expect(RECOVERY_CARD.secondaryCta.href).toBe("/gap-calculator");
  });
});
