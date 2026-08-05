import { useState } from "react";
import { BadgeCheck, Clock, DollarSign, Home, Search, Shield, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddressInput } from "@/components/AddressInput";

export function HeroSection({ onSearch }: { onSearch: (loc: string) => void }) {
  const [searchLoc, setSearchLoc] = useState("");

  return (
    <div className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="secondary" className="mb-4" data-testid="badge-hero">
              <Sparkles className="w-3 h-3 mr-1" />
              Smart Agent Matching
            </Badge>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-4"
              data-testid="text-hero-title"
            >
              Find a trusted agent who saves you money
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg" data-testid="text-hero-subtitle">
              Get matched with a top-rated local agent who knows your market. Our
              network of verified professionals helps you buy or sell with
              confidence.
            </p>

            <div className="flex gap-2 max-w-md">
              <div className="flex-1">
                <AddressInput
                  placeholder="City, state, or ZIP code"
                  mode="location"
                  onChange={(val) => setSearchLoc(val)}
                  onSelect={(result) => {
                    const loc = result.city && result.state ? `${result.city}, ${result.state}` : result.formattedAddress;
                    setSearchLoc(loc);
                    onSearch(loc);
                  }}
                />
              </div>
              <Button
                onClick={() => {
                  if (searchLoc.trim()) onSearch(searchLoc.trim());
                }}
                data-testid="button-hero-search"
              >
                <Search className="w-4 h-4 mr-1" />
                Search
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-primary" />
                <span>Verified agents</span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-primary" />
                <span>Save on closing costs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                <span>Matched in 24 hours</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: BadgeCheck,
                  title: "Vetted Professionals",
                  desc: "Every agent is licensed, reviewed, and backed by our quality guarantee",
                },
                {
                  icon: TrendingUp,
                  title: "Market Expertise",
                  desc: "Local agents with deep knowledge of your neighborhood market",
                },
                {
                  icon: Home,
                  title: "Full Support",
                  desc: "From first showing to closing day, your agent guides every step",
                },
                {
                  icon: DollarSign,
                  title: "Save Money",
                  desc: "Competitive commission rates and potential closing cost savings",
                },
              ].map((item) => (
                <Card
                  key={item.title}
                  className="p-4"
                  data-testid={`card-benefit-${item.title.toLowerCase().replace(/ /g, "-")}`}
                >
                  <item.icon className="w-6 h-6 text-primary mb-2" />
                  <h3 className="font-semibold text-foreground text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
