// The landing hero's question, carried across the signup boundary.
//
// Its own module rather than a section of pendingAttribution.ts, which is EAGER:
// App.tsx imports PrivateLayout directly, PrivateLayout uses usePendingAttribution,
// and that pulls pendingAttribution into the chunk every visitor downloads before
// anything renders. Only `hasPendingCoachQuestion` genuinely needs to be there
// (getPostAuthRoute consults it); the write and read/clear pair are used solely by
// CoachPromptBar and AICoach, both of which are lazy routes. Keeping them here lets
// them ride those lazy chunks instead of the entry bundle.
//
// The key string must never change — altering it would orphan a question already
// stashed by a previously deployed client.

import { PENDING_COACH_QUESTION_KEY } from "./pendingAttribution";

export { PENDING_COACH_QUESTION_KEY };

/** Longest question we will carry across the auth gate. */
const COACH_QUESTION_MAX = 2000;

/** Stash the visitor's question for the coach to auto-send after they sign up. */
export function setPendingCoachQuestion(question: string): void {
  const trimmed = question.trim().slice(0, COACH_QUESTION_MAX);
  if (!trimmed) return;
  try {
    localStorage.setItem(PENDING_COACH_QUESTION_KEY, trimmed);
  } catch {
    /* private mode / quota — the visitor still lands on the coach, just empty */
  }
}

/** Is a landing-hero question waiting to be sent? Used by post-auth routing. */
export function hasPendingCoachQuestion(): boolean {
  try {
    return !!localStorage.getItem(PENDING_COACH_QUESTION_KEY);
  } catch {
    return false;
  }
}

/**
 * Read the stashed question WITHOUT clearing it.
 *
 * Read-then-clear in one call would be the bug: the coach refuses to send while
 * a stream is in flight or the visitor is over their daily message limit, so a
 * consuming read would delete the question on a send that never happened —
 * "your question was received" with nothing behind it. The caller clears only
 * once the send has actually been handed to the stream.
 */
export function readPendingCoachQuestion(): string | null {
  try {
    return localStorage.getItem(PENDING_COACH_QUESTION_KEY) || null;
  } catch {
    return null;
  }
}

/** Consume it — called only after the coach has actually sent the message. */
export function clearPendingCoachQuestion(): void {
  try {
    localStorage.removeItem(PENDING_COACH_QUESTION_KEY);
  } catch {
    /* private mode / storage disabled */
  }
}
