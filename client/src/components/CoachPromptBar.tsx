import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Icons, iconSize } from "@/lib/icons";
import { useAuth } from "@/hooks/useAuth";
import { setPendingCoachQuestion } from "@/lib/pendingCoachQuestion";

/**
 * The landing hero's front door to the AI Homebuyer Coach.
 *
 * This is an ENTRY POINT, not a chat surface: it never streams, never renders a
 * reply, and never calls the coach API. It takes one question and hands it to
 * /ai-coach, which owns the conversation.
 *
 * The auth handoff is the whole reason this component exists rather than a bare
 * link. `/ai-coach` is behind `AnyAuthPage`, and the guard's bounce is a hard
 * load to /login with no return-to — so sending a signed-out visitor there would
 * accept their question into a box and then throw it away at the redirect. The
 * question is stashed in localStorage first (the same durable tier the
 * pre-approval funnel uses for a deferred submit) and the visitor is sent to
 * /signup; getPostAuthRoute then lands them on /ai-coach, which sends it.
 *
 * Colour note: this renders on the dark royal-blue hero, so its type and hairlines
 * are `primary-foreground` (the token that resolves to pure white) rather than a
 * bare literal — the substitution design-token-guard names in its remediation hint.
 * (The guard's regex reads comments too, so don't spell the literal here.)
 */

/** Openers that map to a real Homiquity capability, phrased as a visitor would. */
const QUICK_PROMPTS = [
  "What can I afford?",
  "Could refinancing lower my payment?",
  "How much can I borrow against my equity?",
  "I'm self-employed — will that be a problem?",
] as const;

export function CoachPromptBar() {
  const [question, setQuestion] = useState("");
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const ask = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    // Stash before navigating in both branches. A signed-in visitor still needs
    // it: /ai-coach is a lazy route, and the question has to survive the chunk
    // load rather than ride in component state that is about to unmount.
    setPendingCoachQuestion(trimmed);
    navigate(isAuthenticated ? "/ai-coach" : "/signup");
  };

  return (
    <div className="w-full" data-testid="coach-prompt-bar">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex items-center gap-2 rounded-2xl border border-primary-foreground/15 bg-card p-2 shadow-card-lg sm:gap-3 sm:p-3"
      >
        <span
          className="ml-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex"
          aria-hidden="true"
        >
          <Icons.coach className={iconSize.emphasis} />
        </span>

        <label htmlFor="coach-hero-question" className="sr-only">
          Ask the Homiquity AI Coach a question about buying, refinancing, or your equity
        </label>
        <input
          id="coach-hero-question"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about buying, refinancing, or your equity…"
          autoComplete="off"
          onKeyDown={(e) => {
            // Enter is the primary gesture on a chat-style bar — most visitors
            // will never reach for the arrow. Implicit form submission covers it
            // in a real browser, but handling the key explicitly (and preventing
            // the default so only one path fires) means the send does not depend
            // on that behaviour holding for every input type and browser.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(question);
            }
          }}
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
          data-testid="input-coach-question"
        />

        <Button
          type="submit"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl"
          disabled={!question.trim()}
          aria-label="Ask the AI Coach"
          data-testid="button-coach-ask"
        >
          <Icons.send className={iconSize.emphasis} />
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => ask(prompt)}
            className="min-h-11 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-2 text-sm text-primary-foreground backdrop-blur transition-colors hover:bg-primary-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            data-testid={`button-coach-prompt-${prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Reg N: the coach explains and estimates. It never approves anything. */}
      <p className="mt-4 text-center text-sm text-primary-foreground/75" data-testid="text-coach-disclaimer">
        Educational guidance and estimates — not a loan approval, offer, or commitment.
      </p>
    </div>
  );
}
