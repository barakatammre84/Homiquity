import { useQuery } from "@tanstack/react-query";
import { getPublicQueryFn } from "@/lib/queryClient";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRELAUNCH_GATED } from "@/lib/prelaunch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  Clock,
  Eye,
  Calendar,
  BookOpen,
  Share2,
} from "lucide-react";
import type { Article, ContentCategory } from "@shared/schema";
import { SEOHead } from "@/components/SEOHead";
import { articleSchema, breadcrumbSchema } from "@/lib/structuredData";
import { MarkdownContent } from "@/components/MarkdownContent";
import { personaRoutesForArticle } from "./articlePersonaRoutes";

export default function ArticleDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data: article, isLoading, error } = useQuery<Article>({
    queryKey: ["/api/articles", slug],
    // ["/api/articles", slug] joins to /api/articles/<slug>.
    queryFn: getPublicQueryFn<Article>(),
    enabled: !!slug,
  });

  const { data: categories = [] } = useQuery<ContentCategory[]>({
    queryKey: ["/api/content-categories"],
  });

  const { data: allArticles = [] } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
  });

  const category = categories.find((c) => c.id === article?.categoryId);

  // Related-by-category/tag (falls back to nothing) — adds internal crawl paths
  // and keeps readers moving through the content hub instead of a generic CTA.
  const relatedArticles = article
    ? allArticles
        .filter((a) => a.slug !== article.slug)
        .filter(
          (a) =>
            a.categoryId === article.categoryId ||
            (a.tags || []).some((t) => (article.tags || []).includes(t)),
        )
        .slice(0, 3)
    : [];
  const readTime = article?.readTimeMinutes || Math.max(1, Math.ceil((article?.content?.length || 0) / 1000));
  const publishDate = article?.publishedAt 
    ? new Date(article.publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article?.title,
          text: article?.excerpt || "",
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (isLoading) {
    return (
      <>
        <div className="mx-auto max-w-3xl p-6 sm:p-8 lg:p-12">
              <Skeleton className="mb-6 h-6 w-32" />
              <Skeleton className="mb-4 h-12 w-full" />
              <Skeleton className="mb-8 h-6 w-48" />
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
        </div>
      </>
    );
  }

  if (error || !article) {
    return (
      <>
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <BookOpen className="h-16 w-16 text-muted-foreground/50" />
              <h1 className="mt-6 text-2xl font-bold">Article Not Found</h1>
              <p className="mt-2 text-muted-foreground">
                The article you're looking for doesn't exist or has been removed.
              </p>
              <Link href="/learn">
                <Button className="mt-6" data-testid="button-back-to-learning">
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back to Learning Center
                </Button>
              </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title={article.title}
        description={article.excerpt || `${article.title} — mortgage guidance from Homiquity's Learning Center.`}
        ogType="article"
        ogImage={article.featuredImage || undefined}
        canonical={`/learn/${article.slug}`}
        jsonLd={[
          articleSchema(article, category, `/learn/${article.slug}`),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Learning Center", path: "/learn" },
            { name: article.title, path: `/learn/${article.slug}` },
          ]),
        ]}
      />
      <article className="mx-auto max-w-3xl p-6 sm:p-8 lg:p-12">
            <div className="mb-8">
              <Link href="/learn">
                <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-4" data-testid="button-back">
                  <ChevronLeft className="h-4 w-4" />
                  Back to Learning Center
                </Button>
              </Link>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                {category && (
                  <Badge variant="secondary" style={{ backgroundColor: category.color ? `${category.color}20` : undefined, color: category.color || undefined }}>
                    {category.name}
                  </Badge>
                )}
                {article.tags?.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" data-testid="article-title">
                {article.title}
              </h1>

              {article.excerpt && (
                <p className="mt-4 text-lg text-muted-foreground">
                  {article.excerpt}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {publishDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {publishDate}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {readTime} min read
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {article.viewCount || 0} views
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={handleShare}
                  data-testid="button-share"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>

            {article.featuredImage && (
              <img
                src={article.featuredImage}
                alt={article.title}
                className="mb-8 w-full rounded-lg object-cover"
                loading="lazy"
                data-testid="article-featured-image"
              />
            )}

            <div
              className="prose prose-lg max-w-none dark:prose-invert"
              data-testid="article-content"
            >
              <MarkdownContent content={article.content || ""} />
            </div>

            {relatedArticles.length > 0 && (
              <div className="mt-12 border-t pt-8">
                <h2 className="text-xl font-semibold mb-4">Related articles</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedArticles.map((related) => (
                    <Link
                      key={related.slug}
                      href={`/learn/${related.slug}`}
                      data-testid={`link-related-${related.slug}`}
                    >
                      <div className="group h-full rounded-lg border p-4 transition-colors hover:border-primary hover:shadow-sm">
                        <h3 className="font-medium line-clamp-2 group-hover:text-primary">
                          {related.title}
                        </h3>
                        {related.excerpt && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {related.excerpt}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-12 border-t pt-8">
              <h2 className="text-lg font-semibold mb-4">Continue learning</h2>
              <div className="flex flex-wrap gap-4">
                <Link href="/learn">
                  <Button variant="outline" data-testid="button-more-articles">
                    <BookOpen className="mr-2 h-4 w-4" />
                    All articles
                  </Button>
                </Link>
                <Link href="/faq">
                  <Button variant="outline" data-testid="button-view-faqs">
                    View FAQs
                  </Button>
                </Link>
                {!PRELAUNCH_GATED &&
                  personaRoutesForArticle(article.loanProductFamilies, article.transactionPurposes).map(
                    (route) => (
                      <Link key={route.href} href={route.href}>
                        <Button variant="outline" data-testid={route.testid}>
                          {route.label}
                        </Button>
                      </Link>
                    ),
                  )}
                {!PRELAUNCH_GATED && (
                  <Link href="/apply">
                    <Button data-testid="button-get-preapproved">
                      Get Pre-Approved
                    </Button>
                  </Link>
                )}
              </div>
            </div>
      </article>
    </>
  );
}
