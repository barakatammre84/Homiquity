import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  HelpCircle,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  Star,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Faq, ContentCategory } from "@shared/schema";
import { usePageView } from "@/hooks/useActivityTracker";

export default function FAQ() {
  usePageView("/faq");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, boolean>>({});

  const { data: categories = [] } = useQuery<ContentCategory[]>({
    queryKey: ["/api/content-categories"],
  });

  const { data: faqs = [], isLoading } = useQuery<Faq[]>({
    queryKey: ["/api/faqs", { search: searchQuery, category: selectedCategory }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedCategory) params.set("category", selectedCategory);
      const response = await fetch(`/api/faqs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch FAQs");
      return response.json();
    },
  });

  const { data: popularFaqs = [] } = useQuery<Faq[]>({
    queryKey: ["/api/faqs", { popular: true }],
    queryFn: async () => {
      const response = await fetch("/api/faqs?popular=true");
      if (!response.ok) throw new Error("Failed to fetch popular FAQs");
      return response.json();
    },
    enabled: !searchQuery && !selectedCategory,
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ faqId, helpful }: { faqId: string; helpful: boolean }) => {
      await apiRequest("POST", `/api/faqs/${faqId}/feedback`, { helpful });
    },
    onSuccess: (_, { faqId }) => {
      setFeedbackGiven((prev) => ({ ...prev, [faqId]: true }));
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
    },
  });

  const faqsByCategory = categories.reduce((acc, cat) => {
    acc[cat.id] = faqs.filter((f) => f.categoryId === cat.id);
    return acc;
  }, {} as Record<string, Faq[]>);

  const uncategorizedFaqs = faqs.filter((f) => !f.categoryId);

  return (
    <>
      <div className="border-b bg-gradient-to-br from-primary/5 to-primary/10 p-6 sm:p-8 lg:p-12">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <HelpCircle className="h-4 w-4" />
            Frequently Asked Questions
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            How Can We Help You?
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Find answers to common questions about mortgages, the home buying process, and more
          </p>
          
          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search questions..."
              className="h-12 pl-12 pr-4 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-faq-search"
            />
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/learn">
                <Button variant="ghost" size="sm" data-testid="link-learning-center">
                  Learning Center
                </Button>
              </Link>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">FAQs</span>
            </div>
          </div>

          {!searchQuery && !selectedCategory && popularFaqs.length > 0 && (
            <section className="mb-10">
              <div className="mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <h2 className="text-lg font-semibold">Popular Questions</h2>
              </div>
              <Card>
                <Accordion type="multiple" className="w-full">
                  {popularFaqs.slice(0, 5).map((faq) => (
                    <AccordionItem key={faq.id} value={faq.id} data-testid={`faq-popular-${faq.id}`}>
                          <AccordionTrigger className="px-6 text-left hover:no-underline">
                            <span className="pr-4">{faq.question}</span>
                          </AccordionTrigger>
                          <AccordionContent className="px-6 pb-6">
                            <div className="prose prose-sm max-w-none text-muted-foreground">
                              {faq.answer}
                            </div>
                            {!feedbackGiven[faq.id] && (
                              <div className="mt-4 flex items-center gap-4 border-t pt-4">
                                <span className="text-sm text-muted-foreground">
                                  Was this helpful?
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => feedbackMutation.mutate({ faqId: faq.id, helpful: true })}
                                  data-testid={`button-helpful-${faq.id}`}
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                  Yes
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => feedbackMutation.mutate({ faqId: faq.id, helpful: false })}
                                  data-testid={`button-not-helpful-${faq.id}`}
                                >
                                  <ThumbsDown className="h-4 w-4" />
                                  No
                                </Button>
                              </div>
                            )}
                            {feedbackGiven[faq.id] && (
                              <div className="mt-4 border-t pt-4 text-sm text-muted-foreground">
                                Thanks for your feedback!
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </Card>
                </section>
              )}

              {!searchQuery && categories.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2">
                  <Button
                    variant={selectedCategory === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    data-testid="button-category-all"
                  >
                    All
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category.id)}
                      data-testid={`button-category-${category.slug}`}
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              )}

              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : faqs.length === 0 ? (
                <Card className="p-12 text-center">
                  <HelpCircle className="mx-auto h-16 w-16 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No questions found</h3>
                  <p className="mt-2 text-muted-foreground">
                    {searchQuery
                      ? "Try adjusting your search terms"
                      : "Check back soon for answers to common questions!"}
                  </p>
                  {searchQuery && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setSearchQuery("")}
                      data-testid="button-clear-search"
                    >
                      Clear Search
                    </Button>
                  )}
                </Card>
              ) : (
                <div className="space-y-8">
                  {searchQuery || selectedCategory ? (
                    <Card>
                      <Accordion type="multiple" className="w-full">
                        {faqs.map((faq) => (
                          <AccordionItem key={faq.id} value={faq.id} data-testid={`faq-item-${faq.id}`}>
                            <AccordionTrigger className="px-6 text-left hover:no-underline">
                              <span className="pr-4">{faq.question}</span>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6">
                              <div className="prose prose-sm max-w-none text-muted-foreground">
                                {faq.answer}
                              </div>
                              {!feedbackGiven[faq.id] && (
                                <div className="mt-4 flex items-center gap-4 border-t pt-4">
                                  <span className="text-sm text-muted-foreground">
                                    Was this helpful?
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => feedbackMutation.mutate({ faqId: faq.id, helpful: true })}
                                    data-testid={`button-helpful-${faq.id}`}
                                  >
                                    <ThumbsUp className="h-4 w-4" />
                                    Yes
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => feedbackMutation.mutate({ faqId: faq.id, helpful: false })}
                                    data-testid={`button-not-helpful-${faq.id}`}
                                  >
                                    <ThumbsDown className="h-4 w-4" />
                                    No
                                  </Button>
                                </div>
                              )}
                              {feedbackGiven[faq.id] && (
                                <div className="mt-4 border-t pt-4 text-sm text-muted-foreground">
                                  Thanks for your feedback!
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </Card>
                  ) : (
                    <>
                      {categories.map((category) => {
                        const categoryFaqs = faqsByCategory[category.id] || [];
                        if (categoryFaqs.length === 0) return null;
                        
                        return (
                          <section key={category.id}>
                            <h2 className="mb-4 text-lg font-semibold">{category.name}</h2>
                            <Card>
                              <Accordion type="multiple" className="w-full">
                                {categoryFaqs.map((faq) => (
                                  <AccordionItem key={faq.id} value={faq.id} data-testid={`faq-item-${faq.id}`}>
                                    <AccordionTrigger className="px-6 text-left hover:no-underline">
                                      <span className="pr-4">{faq.question}</span>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-6 pb-6">
                                      <div className="prose prose-sm max-w-none text-muted-foreground">
                                        {faq.answer}
                                      </div>
                                      {!feedbackGiven[faq.id] && (
                                        <div className="mt-4 flex items-center gap-4 border-t pt-4">
                                          <span className="text-sm text-muted-foreground">
                                            Was this helpful?
                                          </span>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="gap-1"
                                            onClick={() => feedbackMutation.mutate({ faqId: faq.id, helpful: true })}
                                            data-testid={`button-helpful-${faq.id}`}
                                          >
                                            <ThumbsUp className="h-4 w-4" />
                                            Yes
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="gap-1"
                                            onClick={() => feedbackMutation.mutate({ faqId: faq.id, helpful: false })}
                                            data-testid={`button-not-helpful-${faq.id}`}
                                          >
                                            <ThumbsDown className="h-4 w-4" />
                                            No
                                          </Button>
                                        </div>
                                      )}
                                      {feedbackGiven[faq.id] && (
                                        <div className="mt-4 border-t pt-4 text-sm text-muted-foreground">
                                          Thanks for your feedback!
                                        </div>
                                      )}
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            </Card>
                          </section>
                        );
                      })}
                      
                      {uncategorizedFaqs.length > 0 && (
                        <section>
                          <h2 className="mb-4 text-lg font-semibold">General Questions</h2>
                          <Card>
                            <Accordion type="multiple" className="w-full">
                              {uncategorizedFaqs.map((faq) => (
                                <AccordionItem key={faq.id} value={faq.id} data-testid={`faq-item-${faq.id}`}>
                                  <AccordionTrigger className="px-6 text-left hover:no-underline">
                                    <span className="pr-4">{faq.question}</span>
                                  </AccordionTrigger>
                                  <AccordionContent className="px-6 pb-6">
                                    <div className="prose prose-sm max-w-none text-muted-foreground">
                                      {faq.answer}
                                    </div>
                                    {!feedbackGiven[faq.id] && (
                                      <div className="mt-4 flex items-center gap-4 border-t pt-4">
                                        <span className="text-sm text-muted-foreground">
                                          Was this helpful?
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="gap-1"
                                          onClick={() => feedbackMutation.mutate({ faqId: faq.id, helpful: true })}
                                          data-testid={`button-helpful-${faq.id}`}
                                        >
                                          <ThumbsUp className="h-4 w-4" />
                                          Yes
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="gap-1"
                                          onClick={() => feedbackMutation.mutate({ faqId: faq.id, helpful: false })}
                                          data-testid={`button-not-helpful-${faq.id}`}
                                        >
                                          <ThumbsDown className="h-4 w-4" />
                                          No
                                        </Button>
                                      </div>
                                    )}
                                    {feedbackGiven[faq.id] && (
                                      <div className="mt-4 border-t pt-4 text-sm text-muted-foreground">
                                        Thanks for your feedback!
                                      </div>
                                    )}
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </Accordion>
                          </Card>
                        </section>
                      )}
                    </>
                  )}
                </div>
              )}

          <div className="mt-12 rounded-xl bg-muted/50 p-8 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-primary" />
            <h3 className="mt-4 text-lg font-semibold">Still have questions?</h3>
            <p className="mt-2 text-muted-foreground">
              Check out our Learning Center for in-depth guides and articles
            </p>
            <Link href="/learn">
              <Button className="mt-4" data-testid="button-explore-learning-center">
                Explore Learning Center
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
