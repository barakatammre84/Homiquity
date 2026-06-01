import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronRight,
  Calculator,
  Users,
  TrendingUp,
  FileText,
  CheckSquare,
  Home,
} from "lucide-react";
import { usePageView } from "@/hooks/useActivityTracker";

type Category = "all" | "affordability" | "agent" | "offer" | "process";

interface ResourceCard {
  id: string;
  title: string;
  description: string;
  category: Category[];
  type: "tool" | "article";
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  action: string;
  href?: string;
}

const categories: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "affordability", label: "Calculating affordability" },
  { id: "agent", label: "Finding an agent" },
  { id: "offer", label: "Making an offer" },
  { id: "process", label: "Understanding the process" },
];

const resources: ResourceCard[] = [
  {
    id: "pre-approval",
    title: "What is a mortgage pre-approval?",
    description: "Start your search with focus",
    category: ["process"],
    type: "article",
    icon: FileText,
    label: "Pre-approval letter",
    action: "Read more",
    href: "/pre-approval",
  },
  {
    id: "affordability-calc",
    title: "So you're wondering how much house you can afford",
    description: "Figure out how much you can spend",
    category: ["affordability"],
    type: "tool",
    icon: Calculator,
    label: "Mortgage affordability calculator",
    action: "Read more",
    href: "/gap-calculator",
  },
  {
    id: "find-agent",
    title: "How to pick a real estate agent",
    description: "Find the right agent for you",
    category: ["agent"],
    type: "article",
    icon: Users,
    label: "Add agent",
    action: "Read more",
  },
  {
    id: "rates",
    title: "How mortgage rates work",
    description: "Check out your rates for today",
    category: ["process", "affordability"],
    type: "tool",
    icon: TrendingUp,
    label: "Rate table",
    action: "Read more",
    href: "/mortgage-rates",
  },
  {
    id: "total-cost",
    title: "What is the total cost of a mortgage?",
    description: "Understand all the costs involved",
    category: ["affordability", "process"],
    type: "article",
    action: "Read more",
  },
  {
    id: "competitive-offer",
    title: "Making a competitive offer",
    description: "Get ready to put in your offer",
    category: ["offer"],
    type: "article",
    icon: Home,
    label: "Offer letter",
    action: "Read more",
  },
  {
    id: "checklist",
    title: "The definitive home buying checklist",
    description: "Mark your progress one step at a time",
    category: ["process"],
    type: "tool",
    icon: CheckSquare,
    label: "Homebuyer checklist",
    action: "Read more",
  },
  {
    id: "guide",
    title: "The Better guide to buying a home",
    description: "Everything you need to know",
    category: ["process"],
    type: "article",
    action: "Read more",
  },
];

export default function Resources() {
  usePageView("/resources");
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const filteredResources = activeCategory === "all" 
    ? resources 
    : resources.filter(r => r.category.includes(activeCategory));

  return (
    <div className="min-h-full">
      <div className="border-b bg-background">
        <div className="p-6 max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-resources-title">
            Resources
          </h1>
          <p className="mt-1 text-base text-muted-foreground" data-testid="text-resources-subtitle">
            Everything you'll need along the way
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl" data-testid="text-resources-description">
            Our articles, tools, and advice are here to guide you through it all — from understanding the process to figuring out what you can afford.
          </p>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat.id)}
              data-testid={`button-category-${cat.id}`}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {filteredResources.map((resource) => (
            <Card
              key={resource.id}
              className="hover-elevate flex flex-col overflow-visible"
              data-testid={`card-resource-${resource.id}`}
            >
              <CardContent className="flex flex-col p-5">
                {resource.label && (
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {resource.icon && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <resource.icon className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <span className="text-sm text-muted-foreground" data-testid={`text-resource-label-${resource.id}`}>
                      {resource.label}
                    </span>
                  </div>
                )}
                
                {!resource.label && resource.icon && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 mb-3">
                    <resource.icon className="h-4 w-4 text-primary" />
                  </div>
                )}

                <h3 className="font-semibold text-foreground leading-snug" data-testid={`text-resource-title-${resource.id}`}>
                  {resource.title}
                </h3>
                
                <p className="mt-1.5 text-sm text-muted-foreground flex-1" data-testid={`text-resource-desc-${resource.id}`}>
                  {resource.description}
                </p>

                {resource.href ? (
                  <Button
                    variant="link"
                    asChild
                    className="mt-4 w-fit gap-1 p-0"
                    data-testid={`button-resource-${resource.id}`}
                  >
                    <Link href={resource.href}>
                      {resource.action}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="link"
                    className="mt-4 w-fit gap-1 p-0"
                    data-testid={`button-resource-${resource.id}`}
                  >
                    {resource.action}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
