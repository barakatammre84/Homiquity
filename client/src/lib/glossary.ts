// Inline-tooltip definitions for mortgage jargon, DERIVED from the single
// canonical glossary (pages/education/glossaryData.ts). Any term there that
// carries a `tooltip` becomes an entry here, keyed by its tooltip key, so the
// full (page) and short (tooltip) definitions live in one place and can't drift.
// Consumed by the TermTooltip component via getGlossaryEntry().
import { glossaryTerms } from "@/pages/education/glossaryData";

export interface GlossaryEntry {
  label: string;
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = Object.fromEntries(
  glossaryTerms
    .filter((term) => term.tooltip)
    .map((term) => [
      term.tooltip!.key,
      { label: term.tooltip!.label, definition: term.tooltip!.short },
    ]),
);

export function getGlossaryEntry(term: string): GlossaryEntry | undefined {
  return GLOSSARY[term];
}
