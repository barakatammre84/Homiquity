import { Link } from "wouter";
import { Bot, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { AffordabilityDetail } from "@/components/AffordabilityBadge";

export function PersonalizedAffordabilityCard({ price, address }: { price: number; address: string }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <Card data-testid="card-personalized-affordability-anon">
        <CardContent className="p-5 text-center">
          <TrendingUp className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Can you afford this home?</p>
          <p className="mt-1 text-xs text-muted-foreground">Sign in to see a personalized affordability check</p>
          <Button asChild variant="outline" className="mt-3 w-full gap-2" size="sm" data-testid="button-signin-affordability">
            <Link href="/login">
              Sign In to Check
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-personalized-affordability">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5" />
          Your Affordability
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AffordabilityDetail price={price} />
        <Separator className="my-3" />
        <Button asChild variant="outline" className="w-full gap-2" data-testid="button-check-with-coach">
          <Link href={`/ai-coach?propertyPrice=${price}&propertyAddress=${encodeURIComponent(address)}`}>
            <Bot className="h-4 w-4" />
            Discuss with AI Coach
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
