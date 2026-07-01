import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { getGlossaryEntry } from "@/lib/glossary";

interface TermTooltipProps {
  /** Glossary key, e.g. "dti", "ltv", "piti". */
  term: string;
  /** Override the visible text (defaults to the glossary label). */
  children?: React.ReactNode;
  /** Show a small help icon after the term. Default true. */
  showIcon?: boolean;
  className?: string;
}

/**
 * Wraps a mortgage term with a plain-language tooltip so first-time buyers can
 * decode jargon inline without leaving the page. Relies on the app-level
 * TooltipProvider (already mounted in App.tsx). If the term isn't in the
 * glossary, it renders the text plainly with no tooltip.
 */
export function TermTooltip({ term, children, showIcon = true, className = "" }: TermTooltipProps) {
  const entry = getGlossaryEntry(term);
  const label = children ?? entry?.label ?? term;

  if (!entry) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-0.5 underline decoration-dotted decoration-muted-foreground/60 underline-offset-2 cursor-help ${className}`}
          data-testid={`term-tooltip-${term}`}
          tabIndex={0}
          role="button"
          aria-label={`${entry.label}: ${entry.definition}`}
        >
          {label}
          {showIcon && <HelpCircle className="h-3 w-3 text-muted-foreground/70" />}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left leading-snug">
        {entry.definition}
      </TooltipContent>
    </Tooltip>
  );
}
