import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, Sparkles, Shield, Calculator } from "lucide-react";
import { useTrackCta } from "@/hooks/useActivityTracker";

interface ConversionCTAProps {
  context: "calculator" | "rates" | "article" | "property" | "coach";
  purchasePrice?: string;
  state?: string;
  propertyType?: string;
}

export function ConversionCTA({ context, purchasePrice, state, propertyType }: ConversionCTAProps) {
  const trackCta = useTrackCta();

  const buildApplyUrl = () => {
    const params = new URLSearchParams();
    params.set("source", context);
    if (purchasePrice) params.set("price", purchasePrice);
    if (state) params.set("state", state);
    if (propertyType) params.set("propertyType", propertyType);
    const qs = params.toString();
    return qs ? `/apply?${qs}` : "/apply";
  };

  const applyUrl = buildApplyUrl();

  const contextMessages: Record<string, { heading: string; subtext: string; coachPrompt: string }> = {
    calculator: {
      heading: "Start your pre-approval",
      subtext: "Get a verified pre-approval letter in about 3 minutes.",
      coachPrompt: "Have questions about your results? Chat with our AI Coach first.",
    },
    rates: {
      heading: "Like what you see?",
      subtext: "Start a pre-approval to lock in today's rates. Takes about 3 minutes.",
      coachPrompt: "Have questions about rates? Our AI Coach can help.",
    },
    article: {
      heading: "Put your knowledge into action",
      subtext: "Start a pre-approval application. Takes about 3 minutes.",
      coachPrompt: "Still have questions? Our AI Coach can help.",
    },
    property: {
      heading: "Interested in this property?",
      subtext: "Get a pre-approval letter in about 3 minutes.",
      coachPrompt: "Have questions about this property? Ask our AI Coach.",
    },
    coach: {
      heading: "Next step: Pre-approval",
      subtext: "Start your pre-approval application.",
      coachPrompt: "",
    },
  };

  const msg = contextMessages[context] || contextMessages.calculator;

  return (
    <Card className="border-primary/20" data-testid="conversion-cta">
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold" data-testid="text-cta-heading">{msg.heading}</h3>
            <p className="text-sm text-muted-foreground mt-1">{msg.subtext}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Link href={applyUrl}>
              <Button
                size="lg"
                className="gap-2 w-full sm:w-auto"
                onClick={() => trackCta("conversion-cta-apply", `/${context}`)}
                data-testid="button-cta-apply"
              >
                Get Pre-Approved
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {context !== "coach" && (
              <Link href="/ai-coach">
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 w-full sm:w-auto"
                  onClick={() => trackCta("conversion-cta-coach", `/${context}`)}
                  data-testid="button-cta-coach"
                >
                  <Bot className="h-4 w-4" />
                  Talk to Coach
                </Button>
              </Link>
            )}
          </div>
          {msg.coachPrompt && (
            <p className="text-xs text-muted-foreground" data-testid="text-cta-coach-prompt">{msg.coachPrompt}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              No hard credit check
            </span>
            <span className="flex items-center gap-1">
              <Calculator className="h-3 w-3" />
              3-minute process
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
