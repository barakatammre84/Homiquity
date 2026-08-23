import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  ASSISTANT_NAME,
  ASSISTANT_ROLE_LABEL,
  ASSISTANT_FULL_LABEL,
} from "@shared/assistant/identity";
import { STATIC_COACH_PROMPT } from "../server/services/coachingPrompt";
import { COACH_PROMPT_VERSION } from "../server/services/coachingClient";

/**
 * The assistant has to give the same name as the button that launched it.
 *
 * #595 renamed every piece of UI copy to "Homi" and left the system prompt
 * introducing the model as "the Homiquity AI Intake and Readiness Assistant".
 * Nothing failed — both halves were internally consistent — so a borrower who
 * clicked a button marked Homi and asked "who are you?" was simply told
 * something else. That is the shape of drift these tests exist to catch: not a
 * broken build, a broken introduction.
 */

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("the model and the UI agree on the name", () => {
  it("the prompt introduces the assistant by its actual name", () => {
    expect(STATIC_COACH_PROMPT.startsWith(`You are ${ASSISTANT_FULL_LABEL}.`)).toBe(true);
    expect(STATIC_COACH_PROMPT).toContain(`Your name is ${ASSISTANT_NAME}.`);
  });

  it("the sidebar label and the prompt come from the same name", () => {
    // The nav item a borrower actually clicks. If someone renames one side, the
    // literal here stops matching ASSISTANT_NAME and this fails.
    const sidebar = read("client/src/components/app-sidebar.tsx");
    expect(sidebar).toContain(`title: "${ASSISTANT_NAME}"`);
  });

  it("the prompt never reintroduces the old self-description", () => {
    expect(STATIC_COACH_PROMPT).not.toMatch(/Homiquity AI Intake and Readiness Assistant/);
  });
});

describe("the role descriptor stays the modest one", () => {
  // Homiquity is pre-license — companyNmlsDisplay() returns null until a real
  // NMLS ID exists. "advisor" implies advice; "loan advisor"/"loan officer"
  // reads as MLO activity under the SAFE Act; "counselor" collides with the
  // regulated term HUD-approved housing counselor, which the prompt itself
  // refers borrowers OUT to. Better calls its assistant an "AI loan advisor";
  // this repo deliberately does not copy that.
  it("is 'AI assistant', not an advisor or a counselor", () => {
    expect(ASSISTANT_ROLE_LABEL).toBe("AI assistant");
    expect(ASSISTANT_FULL_LABEL).not.toMatch(/advisor|counselor|loan officer/i);
  });

  it("the prompt forbids the model from claiming any of those titles", () => {
    expect(STATIC_COACH_PROMPT).toMatch(/NOT a loan officer, a loan advisor, or a housing counselor/);
  });

  it("says plainly that it is an AI when asked", () => {
    expect(STATIC_COACH_PROMPT).toMatch(/You are an AI/);
  });
});

describe("the identity module stays a leaf", () => {
  // App.tsx imports PrivateLayout non-lazily and PrivateLayout reaches the
  // sidebar that renders this name, so this file is in the EAGER entry chunk
  // every first-time visitor downloads. A few hundred bytes of strings is a
  // fair price; a single import would drag whatever it pulls onto that path.
  const src = read("shared/assistant/identity.ts");
  // Strip comments before scanning. The first version of this test read the raw
  // source and failed on its own docblock, which cites `pgTable` as the
  // cautionary example — the same shape as the design-token guard matching
  // `text-white` inside a comment. A guard that reads prose as code punishes
  // the explanation of the rule.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("imports nothing", () => {
    expect(code).not.toMatch(/^\s*import\s/m);
    expect(code).not.toMatch(/\brequire\(/);
  });

  it("exports only string constants — no schema, no zod, no runtime", () => {
    const exports = [...code.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
    expect(exports.sort()).toEqual(
      ["ASSISTANT_FULL_LABEL", "ASSISTANT_NAME", "ASSISTANT_ROLE_LABEL"],
    );
    expect(code).not.toMatch(/pgTable|z\.object|function /);
  });
});

describe("prompt-cache discipline survives the interpolation", () => {
  it("the prompt is byte-stable across evaluations", () => {
    // The ${...} in the prompt is module-level, so the cached prefix is
    // identical every call. A clock or a per-borrower value here would cost
    // every user a cache miss on every turn.
    expect(STATIC_COACH_PROMPT).toBe(STATIC_COACH_PROMPT);
    expect(STATIC_COACH_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("the prompt version was bumped past the pre-rename value", () => {
    // ai_interactions.systemPrompt stores only this marker, so a prompt edit
    // that reuses an old version makes the governance ledger describe the
    // wrong prompt (AI_GOVERNANCE_POLICY §5.5).
    expect(COACH_PROMPT_VERSION).not.toBe("coach-2.4.0");
    expect(COACH_PROMPT_VERSION).toMatch(/^homi-/);
  });
});
