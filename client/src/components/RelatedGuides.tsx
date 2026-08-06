import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen } from "lucide-react";
import type { LoanProductFamily, TransactionPurpose } from "@shared/loanProducts";
import type { Article } from "@shared/schema";

/**
 * "Related guides" module for the persona conversion pages.
 *
 * Closes the missing half of the content↔conversion wiring. Articles and
 * calculators already funnel visitors INTO /apply, but the persona pages
 * (/va-loans, /refinance, /self-employed, /first-time-buyer) linked to no
 * education content at all — so a high-intent visitor arriving with an
 * objection ("is a VA loan actually better?") had nowhere on the page to go
 * read the answer, even though the answer existed.
 *
 * Renders NOTHING when there are no classified articles for the family. An
 * empty "Related guides" heading is worse than no section, and unclassified
 * content is the expected state until editors tag it.
 */
export function RelatedGuides({
  families = [],
  purposes = [],
  heading = "Related guides",
  limit = 3,
}: {
  /** Match on product family. Coarse — nearly all purchase content is conventional. */
  families?: readonly LoanProductFamily[];
  /**
   * Match on transaction purpose. Use this for refinance pages: filtering them
   * by family would surface purchase content, which is worse than showing
   * nothing. ANDed with `families` when both are given.
   */
  purposes?: readonly TransactionPurpose[];
  heading?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  for (const f of families) params.append("productFamily", f);
  for (const p of purposes) params.append("purpose", p);
  params.set("limit", String(limit));
  const url = `/api/articles?${params.toString()}`;

  const { data: articles } = useQuery<Article[]>({
    queryKey: [url],
    // Content changes on an editorial cadence, not a per-visit one.
    staleTime: 5 * 60 * 1000,
  });

  if (!articles || articles.length === 0) return null;

  return (
    <section className="border-t bg-muted/30 px-4 py-12 sm:px-6 lg:px-8" data-testid="section-related-guides">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <li key={article.id}>
              <Link
                href={`/learn/${article.slug}`}
                className="group flex h-full flex-col rounded-lg border bg-card p-5 transition-colors hover:border-primary/50"
                data-testid={`link-related-guide-${article.slug}`}
              >
                <h3 className="font-medium leading-snug group-hover:text-primary">
                  {article.title}
                </h3>
                {article.excerpt && (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {article.excerpt}
                  </p>
                )}
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Read guide
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
