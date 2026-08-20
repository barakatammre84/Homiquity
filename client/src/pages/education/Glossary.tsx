import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PRELAUNCH_GATED } from "@/lib/prelaunch";
import { Input } from "@/components/ui/input";
import {
  Search,
  BookOpen,
  ChevronRight,
  ArrowUp,
  X,
  Link2,
} from "lucide-react";
import { usePageView } from "@/hooks/useActivityTracker";
import { SEOHead } from "@/components/SEOHead";
import { definedTermSetSchema, breadcrumbSchema } from "@/lib/structuredData";
import { glossaryTerms, slugifyTerm, type GlossaryTerm } from "./glossaryData";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** First-letter bucket for a term, uppercased (digits/symbols fall under "#"). */
function letterOf(term: string): string {
  const c = term.trim().charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

/** Terms sorted alphabetically by display name, computed once. */
const sortedTerms: GlossaryTerm[] = [...glossaryTerms].sort((a, b) =>
  a.term.localeCompare(b.term),
);

/** Map of slug -> display name, for rendering cross-links. */
const termNameBySlug: Record<string, string> = sortedTerms.reduce(
  (acc, t) => {
    acc[slugifyTerm(t.term)] = t.term;
    return acc;
  },
  {} as Record<string, string>,
);

export default function Glossary() {
  usePageView("/glossary");
  const [searchQuery, setSearchQuery] = useState("");
  // When a jump is requested while a search filter is active, we clear the
  // search first, then scroll on the next render once the target is mounted.
  const pendingScroll = useRef<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const query = searchQuery.trim().toLowerCase();

  const filteredTerms = useMemo(() => {
    if (!query) return sortedTerms;
    return sortedTerms.filter(
      (t) =>
        t.term.toLowerCase().includes(query) ||
        t.definition.toLowerCase().includes(query),
    );
  }, [query]);

  // Group the (possibly filtered) terms by first letter, preserving order.
  const groups = useMemo(() => {
    const map = new Map<string, GlossaryTerm[]>();
    for (const t of filteredTerms) {
      const l = letterOf(t.term);
      if (!map.has(l)) map.set(l, []);
      map.get(l)!.push(t);
    }
    return map;
  }, [filteredTerms]);

  // Letters that have at least one term across the full glossary (for the A–Z
  // rail — disabled letters stay visible but greyed out).
  const populatedLetters = useMemo(() => {
    const s = new Set<string>();
    for (const t of sortedTerms) s.add(letterOf(t.term));
    return s;
  }, []);

  // Scroll an anchor into view, offsetting for the stacked sticky bars (the site
  // nav + this page's A–Z rail). Both heights are measured live because the rail
  // wraps to more rows on narrow viewports, so a fixed CSS scroll-margin can't
  // keep the target clear of the bars across breakpoints.
  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const navH = document.querySelector("nav")?.getBoundingClientRect().height ?? 0;
    const railH = railRef.current?.getBoundingClientRect().height ?? 0;
    const y = el.getBoundingClientRect().top + window.scrollY - navH - railH - 12;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }, []);

  // Jump to an anchor, clearing any active search first so the target renders.
  const jumpTo = useCallback(
    (id: string) => {
      if (query) {
        pendingScroll.current = id;
        setSearchQuery("");
      } else {
        scrollToId(id);
      }
    },
    [query, scrollToId],
  );

  // Fire a pending jump once the search has been cleared and the DOM updated.
  useEffect(() => {
    if (!query && pendingScroll.current) {
      const id = pendingScroll.current;
      pendingScroll.current = null;
      // Defer to next frame so the now-unfiltered list is mounted.
      requestAnimationFrame(() => scrollToId(id));
    }
  }, [query, scrollToId]);

  // Honor a deep link (e.g. /glossary#appraisal) on first load.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      requestAnimationFrame(() => scrollToId(hash));
    }
  }, [scrollToId]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <>
      <SEOHead
        title="Mortgage Glossary — Plain-English Definitions of Home Loan Terms"
        description="Understand mortgage and homebuying terminology, from APR and escrow to PMI and underwriting — clear definitions with related terms and cross-references."
        canonical="/glossary"
        jsonLd={[
          definedTermSetSchema(glossaryTerms, "/glossary"),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Glossary", path: "/glossary" },
          ]),
        ]}
      />
      {/* Hero */}
      <div className="border-b bg-gradient-to-br from-primary/5 to-primary/10 p-6 sm:p-8 lg:p-12">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <BookOpen className="h-4 w-4" />
            Glossary
          </div>
          <h1
            className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
            data-testid="text-glossary-title"
          >
            Homeownership and mortgage terms
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Whether you're a first-time homebuyer or a third-time refinancer,
            you're likely to come across some terms in your home loan process
            that need clarification. We think jargon has no place in the
            homeownership journey, so we created this helpful glossary to fill
            you in on every term you need to know—from what a real estate agent
            actually does, to what closing means, and more.
          </p>

          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search terms..."
              className="h-12 pl-12 pr-4 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-glossary-search"
            />
          </div>
        </div>
      </div>

      {/* Sticky A–Z rail — offset below the site nav (sticky top-0, ~65px). */}
      <div
        ref={railRef}
        className="sticky top-16 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-1 px-4 py-3">
          {ALPHABET.map((letter) => {
            const enabled = populatedLetters.has(letter);
            return (
              <button
                key={letter}
                type="button"
                disabled={!enabled}
                onClick={() => jumpTo(`letter-${letter}`)}
                className={
                  "flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors " +
                  (enabled
                    ? "text-foreground/80 hover:bg-primary/10 hover:text-primary"
                    : "cursor-not-allowed text-muted-foreground/30")
                }
                data-testid={`button-letter-${letter}`}
                aria-label={`Jump to ${letter}`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl">
          {/* Breadcrumb / result count */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <Button asChild variant="ghost" size="sm" className="touch-target" data-testid="link-resources">
                <Link href="/resources">
                  Resources
                </Link>
              </Button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Glossary</span>
            </div>
            <span
              className="text-sm text-muted-foreground"
              data-testid="text-glossary-count"
            >
              {filteredTerms.length}{" "}
              {filteredTerms.length === 1 ? "term" : "terms"}
              {query ? ` matching "${searchQuery.trim()}"` : ""}
            </span>
          </div>

          {filteredTerms.length === 0 ? (
            <Card className="p-12 text-center">
              <Search className="mx-auto h-16 w-16 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No terms found</h3>
              <p className="mt-2 text-muted-foreground">
                Try a different search term.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setSearchQuery("")}
                data-testid="button-clear-search"
              >
                <X className="mr-1 h-4 w-4" />
                Clear search
              </Button>
            </Card>
          ) : (
            <div className="space-y-10">
              {ALPHABET.filter((l) => groups.has(l)).map((letter) => (
                <section
                  key={letter}
                  id={`letter-${letter}`}
                  className="scroll-mt-32"
                  data-testid={`section-letter-${letter}`}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                      {letter}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="space-y-4">
                    {groups.get(letter)!.map((t) => {
                      const slug = slugifyTerm(t.term);
                      const related = (t.related || []).filter(
                        (s) => termNameBySlug[s],
                      );
                      return (
                        <Card
                          key={slug}
                          id={slug}
                          className="scroll-mt-36 p-5"
                          data-testid={`card-term-${slug}`}
                        >
                          <div className="group flex items-start gap-2">
                            <h3
                              className="font-semibold text-foreground"
                              data-testid={`text-term-${slug}`}
                            >
                              {t.term}
                            </h3>
                            <button
                              type="button"
                              onClick={() => jumpTo(slug)}
                              className="mt-0.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/60 hover:!text-primary"
                              aria-label={`Link to ${t.term}`}
                              data-testid={`button-anchor-${slug}`}
                            >
                              <Link2 className="h-4 w-4" />
                            </button>
                          </div>

                          {t.see ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                              See{" "}
                              <button
                                type="button"
                                onClick={() => jumpTo(t.see!)}
                                className="font-medium text-primary hover:underline"
                                data-testid={`link-see-${t.see}`}
                              >
                                {termNameBySlug[t.see] || t.see}
                              </button>
                              .
                            </p>
                          ) : (
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                              {t.definition}
                            </p>
                          )}

                          {related.length > 0 && (
                            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Related
                              </span>
                              {related.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => jumpTo(s)}
                                  className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                                  data-testid={`chip-related-${slug}-${s}`}
                                >
                                  {termNameBySlug[s]}
                                </button>
                              ))}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-12 rounded-xl bg-muted/50 p-8 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-primary" />
            <h3 className="mt-4 text-lg font-semibold">
              Ready to put these terms to work?
            </h3>
            <p className="mt-2 text-muted-foreground">
              {PRELAUNCH_GATED
                ? "Explore our guides and tools."
                : "Explore our guides and tools, or get pre-approved in about 3 minutes."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button asChild variant="outline" data-testid="button-explore-resources">
                <Link href="/resources">
                  Explore Resources
                </Link>
              </Button>
              {!PRELAUNCH_GATED && (
                <Button asChild data-testid="button-get-preapproved">
                  <Link href="/apply">
                    Get Pre-Approved
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Back to top */}
      <Button
        variant="secondary"
        size="icon"
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 z-40 h-11 w-11 rounded-full shadow-lg"
        aria-label="Back to top"
        data-testid="button-back-to-top"
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
    </>
  );
}
