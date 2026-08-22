/**
 * The assistant's name, in ONE place.
 *
 * Why this file exists: #595 renamed every piece of UI copy to "Homi" but left
 * the system prompt introducing the model as "the Homiquity AI Intake and
 * Readiness Assistant". A borrower who pressed a button labelled Homi and asked
 * "what's your name?" got a different answer from the thing they had just
 * clicked. The name was correct in 5 files and hardcoded in each of them, which
 * is exactly how the next rename drifts the same way.
 *
 * 🚨 KEEP THIS FILE A LEAF — no imports, ever.
 *
 * `App.tsx` imports `PrivateLayout` non-lazily, and `PrivateLayout` reaches the
 * sidebar that renders this name, so every byte here lands in the EAGER entry
 * chunk that every first-time visitor downloads before anything renders. A few
 * hundred bytes of string constants is a fair price for a name that cannot
 * drift. A single `import` would put whatever it pulls in on that same path —
 * see the identical warning on `client/src/lib/pendingCoachQuestion.ts`, and
 * `shared/loanApplicationStatus.ts`'s note that one `import { pgTable }`
 * re-opened the schema leak.
 *
 * ROLE DESCRIPTOR — "AI assistant", deliberately. Not "advisor" (implies
 * advice), not "loan advisor"/"loan officer" (reads as MLO activity under the
 * SAFE Act), and not "counselor" (collides with the regulated term
 * HUD-approved housing counselor, which the prompt itself refers borrowers out
 * to). Homiquity is pre-license — `companyNmlsDisplay()` returns null until a
 * real NMLS ID exists — so the descriptor has to stay the modest one.
 */

/** The assistant's name, as the borrower sees it and as the model says it. */
export const ASSISTANT_NAME = "Homi";

/** What it is. See the role-descriptor note above before changing this. */
export const ASSISTANT_ROLE_LABEL = "AI assistant";

/** First-contact / disclosure form: never just the bare name on introduction. */
export const ASSISTANT_FULL_LABEL = `${ASSISTANT_NAME}, Homiquity's ${ASSISTANT_ROLE_LABEL}`;
