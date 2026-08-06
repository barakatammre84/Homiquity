import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Check, ChevronLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The funnel's outer shell (extracted from PreApproval.tsx): the standalone
 * intro screen, and the fixed progress bar / step header that frames every
 * question after it. Presentation only.
 */

export function FunnelIntroScreen({
  title,
  subtitle,
  buttonText,
  onStart,
  backToPropertyId,
}: {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  onStart: () => void;
  /** Set only when the borrower arrived from a specific listing, so the intro
   * can offer a way back to it instead of stranding them in the funnel. */
  backToPropertyId?: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl"
    >
      <div className="mb-8 flex justify-center">
        <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center">
          <Home className="h-10 w-10 text-primary" />
        </div>
      </div>
      <h1
        className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-6"
        data-testid="text-intro-title"
      >
        {title}
      </h1>
      <p className="text-xl text-muted-foreground mb-12">{subtitle}</p>
      <Button
        onClick={onStart}
        size="lg"
        className="text-lg px-8 py-6 h-auto rounded-full"
        data-testid="button-start-preapproval"
      >
        {buttonText} <ArrowRight className="ml-2" />
      </Button>
      <p className="mt-8 text-sm text-muted-foreground">
        Have a saved application?{" "}
        <a href="/login" className="text-primary hover:underline">
          Sign in to resume
        </a>
      </p>
      {backToPropertyId && (
        <Link href={`/properties/${backToPropertyId}`}>
          <Button variant="ghost" size="sm" className="mt-4 gap-1.5 text-muted-foreground" data-testid="button-back-to-property">
            <ChevronLeft className="h-3.5 w-3.5" /> Back to property listing
          </Button>
        </Link>
      )}
    </motion.div>
  );
}

function timeRemainingHint(index: number): string {
  if (index <= 4) return "~2 min left";
  if (index <= 8) return "~1 min left";
  return "Almost done";
}

export function FunnelProgressHeader({
  index,
  total,
  percent,
  onBack,
}: {
  index: number;
  total: number;
  percent: number;
  onBack: () => void;
}) {
  const atStart = index === 0;
  return (
    <>
      <div className="fixed top-0 left-0 w-full h-1 bg-muted z-50">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <div className="fixed top-0 w-full p-4 sm:p-6 flex justify-between items-center z-40 bg-background/80 backdrop-blur-sm">
        <button
          onClick={onBack}
          disabled={atStart}
          className={`p-2 rounded-full hover:bg-muted transition-all ${atStart ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          data-testid="button-back"
        >
          <ChevronLeft className="w-6 h-6 text-muted-foreground" />
        </button>
        <div className="flex flex-col items-center" data-testid="text-step-counter">
          <span className="text-sm font-medium text-muted-foreground">
            Step {index} of {total}
          </span>
          <span className="text-[11px] text-muted-foreground/60">
            {timeRemainingHint(index)}
          </span>
        </div>
        <div className="flex items-center gap-1 w-10 justify-end">
          {!atStart && (
            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1" data-testid="text-autosave-indicator">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>
    </>
  );
}
