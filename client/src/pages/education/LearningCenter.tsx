import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { usePageView } from "@/hooks/useActivityTracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  BookOpen,
  ChevronRight,
  Clock,
  Eye,
  GraduationCap,
  FileText,
  Home,
  DollarSign,
  Shield,
  HelpCircle,
} from "lucide-react";
import type { Article, ContentCategory } from "@shared/schema";

const iconMap: Record<string, React.ElementType> = {
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  "file-text": FileText,
  home: Home,
  "dollar-sign": DollarSign,
  shield: Shield,
  "help-circle": HelpCircle,
};

function getIcon(iconName: string | null): React.ElementType {
  if (!iconName) return BookOpen;
  return iconMap[iconName] || BookOpen;
}

function ArticleCard({ article }: { article: Article }) {
  const readTime = Math.max(1, Math.ceil((article.content?.length || 0) / 1000));
  
  return (
    <Link href={`/learn/${article.slug}`}>
      <Card
        className="hover-elevate h-full cursor-pointer"
        data-testid={`card-article-${article.slug}`}
      >
        <CardContent className="flex h-full flex-col p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {article.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <h3 className="font-semibold text-foreground line-clamp-2">
            {article.title}
          </h3>
          <p className="mt-2 flex-1 text-sm text-muted-foreground line-clamp-3">
            {article.excerpt || article.content?.substring(0, 150)}
          </p>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {readTime} min read
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {article.viewCount || 0} views
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CategoryCard({ category, articleCount }: { category: ContentCategory; articleCount: number }) {
  const Icon = getIcon(category.icon);
  
  return (
    <Card
      className="hover-elevate cursor-pointer"
      data-testid={`card-category-${category.slug}`}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg"
          style={{ backgroundColor: category.color ? `${category.color}20` : 'hsl(var(--primary) / 0.1)' }}
        >
          <Icon className="h-6 w-6" style={{ color: category.color || 'hsl(var(--primary))' }} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{category.name}</h3>
          <p className="text-sm text-muted-foreground">
            {articleCount} article{articleCount !== 1 ? 's' : ''}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export default function LearningCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  usePageView("/learn");

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ContentCategory[]>({
    queryKey: ["/api/content-categories"],
  });

  const { data: articles = [], isLoading: articlesLoading } = useQuery<Article[]>({
    queryKey: ["/api/articles", { search: searchQuery, category: selectedCategory }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedCategory) params.set("category", selectedCategory);
      const response = await fetch(`/api/articles?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch articles");
      return response.json();
    },
  });

  const articlesByCategory = categories.reduce((acc, cat) => {
    acc[cat.id] = articles.filter((a) => a.categoryId === cat.id).length;
    return acc;
  }, {} as Record<string, number>);

  const isLoading = categoriesLoading || articlesLoading;

  return (
    <>
      <div className="border-b bg-gradient-to-br from-primary/5 to-primary/10 p-6 sm:p-8 lg:p-12">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                <GraduationCap className="h-4 w-4" />
                Learning Center
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Master Your Mortgage Journey
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Expert guides, tips, and resources to help you navigate the home buying process
              </p>
              
              <div className="relative mx-auto mt-8 max-w-xl">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search articles..."
                  className="h-12 pl-12 pr-4 text-base"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-article-search"
                />
              </div>
            </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
              {!searchQuery && !selectedCategory && (
                <section className="mb-12">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Browse by Topic</h2>
                    <Link href="/faq">
                      <Button variant="ghost" className="gap-1" data-testid="link-view-faq">
                        View FAQs
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  
                  {categoriesLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-20" />
                      ))}
                    </div>
                  ) : categories.length === 0 ? (
                    <Card className="p-8 text-center">
                      <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-4 text-muted-foreground">
                        No categories available yet. Check back soon!
                      </p>
                    </Card>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {categories.map((category) => (
                        <div
                          key={category.id}
                          onClick={() => setSelectedCategory(category.id)}
                        >
                          <CategoryCard
                            category={category}
                            articleCount={articlesByCategory[category.id] || 0}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {selectedCategory && (
                <div className="mb-6 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    data-testid="button-clear-category"
                  >
                    All Topics
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {categories.find((c) => c.id === selectedCategory)?.name}
                  </span>
                </div>
              )}

              <section>
                <h2 className="mb-6 text-xl font-semibold">
                  {searchQuery
                    ? `Search Results for "${searchQuery}"`
                    : selectedCategory
                    ? "Articles"
                    : "Latest Articles"}
                </h2>

                {isLoading ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Skeleton key={i} className="h-48" />
                    ))}
                  </div>
                ) : articles.length === 0 ? (
                  <Card className="p-12 text-center">
                    <FileText className="mx-auto h-16 w-16 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-semibold">No articles found</h3>
                    <p className="mt-2 text-muted-foreground">
                      {searchQuery
                        ? "Try adjusting your search terms"
                        : "Check back soon for new content!"}
                    </p>
                    {(searchQuery || selectedCategory) && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedCategory(null);
                        }}
                        data-testid="button-clear-filters"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </Card>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {articles.map((article) => (
                      <ArticleCard key={article.id} article={article} />
                    ))}
                  </div>
                )}
              </section>
        </div>
      </div>
    </>
  );
}
