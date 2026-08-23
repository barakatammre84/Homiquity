import { Link } from "wouter";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/brand/Logo";

export interface SearchHeroProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  notFound: string | null;
}

export function SearchHero({ query, onQueryChange, onSubmit, isPending, notFound }: SearchHeroProps) {
  return (
    <div className="bg-primary/5 dark:bg-primary/10 border-b">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16 text-center">
        <Link href="/">
          <Logo size="lg" tone="brand" data-testid="text-brand-logo" />
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold mt-6 mb-3" data-testid="text-page-title">
          Can I Afford This Home?
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
          Found a home you love on Zillow, Redfin, or Realtor.com?
          Paste the address or listing URL below to get a complete affordability picture.
        </p>
        <form onSubmit={onSubmit} className="max-w-2xl mx-auto">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Paste a Zillow/Redfin URL or type an address..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                className="pl-10 h-12 text-base"
                data-testid="input-property-search"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={isPending || !query.trim()}
              data-testid="button-search-property"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Analyze"
              )}
            </Button>
          </div>
        </form>
        {notFound && (
          <p className="text-destructive text-sm mt-4" data-testid="text-not-found">{notFound}</p>
        )}
      </div>
    </div>
  );
}
