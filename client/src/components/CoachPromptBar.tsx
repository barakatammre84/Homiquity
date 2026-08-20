import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Icons, iconSize } from "@/lib/icons";
import { useAuth } from "@/hooks/useAuth";
import { setPendingCoachQuestion } from "@/lib/pendingCoachQuestion";

/**
 * The landing hero's front door to Homi, the Homiquity assistant.
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
 * Colour note: this now renders on the MINT hero, not a dark one. It was styled
 * white-on-dark (`primary-foreground` type, translucent chips); on a light ground
 * every one of those went invisible. It reads from the ordinary light-surface
 * tokens instead — white chips with a hairline on mint, which is also the
 * container treatment used across the page.
 */

/**
 * One opener per door on the home page — renting, self-employed, owner, moving up
 * — phrased the way a visitor would actually ask. Each maps to a real capability;
 * none of them invites a rate, payment or approval answer.
 */
const QUICK_PROMPTS = [
  "What could I afford?",
  "I'm self-employed — how does that work?",
  "Is refinancing worth it for me?",
  "What would I need to stop renting?",
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
        className="flex items-center gap-2 rounded-full border border-border bg-card p-2 shadow-card-lg sm:gap-3 sm:p-3"
      >
        <span
          className="ml-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex"
          aria-hidden="true"
        >
          <Icons.coach className={iconSize.emphasis} />
        </span>

        <label htmlFor="coach-hero-question" className="sr-only">
          Ask Homi, the Homiquity assistant, a question about buying, refinancing, or your equity
        </label>
        <input
          id="coach-hero-question"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask Homi anything about buying a home…"
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
          className="h-11 w-11 shrink-0"
          disabled={!question.trim()}
          aria-label="Ask Homi"
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
            className="min-h-11 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid={`button-coach-prompt-${prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Two things at once. Reg N: Homi explains and estimates, never approves.
          And the broker fact — Homiquity does not make credit decisions or fund
          loans (Footer.tsx), so the page must never leave the impression that the
          assistant, or we, decide anything. */}
      <p className="mt-4 text-center text-sm text-muted-foreground" data-testid="text-coach-disclaimer">
        Homi explains and prepares — lenders make the credit decision. Guidance and
        estimates, not a loan approval, offer, or commitment.
      </p>
    </div>
  );
}
