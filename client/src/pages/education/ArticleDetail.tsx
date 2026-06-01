import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default function ArticleDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data: article, isLoading, error } = useQuery<Article>({
    queryKey: ["/api/articles", slug],
    queryFn: async () => {
      const response = await fetch(`/api/articles/${slug}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error("Article not found");
        throw new Error("Failed to fetch article");
      }
      return response.json();
    },
    enabled: !!slug,
  });

  const { data: categories = [] } = useQuery<ContentCategory[]>({
    queryKey: ["/api/content-categories"],
  });

  const category = categories.find((c) => c.id === article?.categoryId);
  const readTime = Math.max(1, Math.ceil((article?.content?.length || 0) / 1000));
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

            <div 
              className="prose prose-lg max-w-none dark:prose-invert"
              data-testid="article-content"
            >
              {article.content?.split('\n').map((paragraph, index) => {
                if (!paragraph.trim()) return null;
                
                if (paragraph.startsWith('# ')) {
                  return <h1 key={index}>{paragraph.slice(2)}</h1>;
                }
                if (paragraph.startsWith('## ')) {
                  return <h2 key={index}>{paragraph.slice(3)}</h2>;
                }
                if (paragraph.startsWith('### ')) {
                  return <h3 key={index}>{paragraph.slice(4)}</h3>;
                }
                if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
                  return <li key={index}>{paragraph.slice(2)}</li>;
                }
                if (paragraph.match(/^\d+\.\s/)) {
                  return <li key={index}>{paragraph.replace(/^\d+\.\s/, '')}</li>;
                }
                
                return <p key={index}>{paragraph}</p>;
              })}
            </div>

            <div className="mt-12 border-t pt-8">
              <h3 className="text-lg font-semibold mb-4">Continue Learning</h3>
              <div className="flex flex-wrap gap-4">
                <Link href="/learn">
                  <Button variant="outline" data-testid="button-more-articles">
                    <BookOpen className="mr-2 h-4 w-4" />
                    More Articles
                  </Button>
                </Link>
                <Link href="/faq">
                  <Button variant="outline" data-testid="button-view-faqs">
                    View FAQs
                  </Button>
                </Link>
                <Link href="/apply">
                  <Button data-testid="button-get-preapproved">
                    Get Pre-Approved
                  </Button>
                </Link>
              </div>
            </div>
      </article>
    </>
  );
}
