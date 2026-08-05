import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicQueryFn } from "@/lib/queryClient";
import { Search, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AddressInput } from "@/components/AddressInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEOHead } from "@/components/SEOHead";
import { SPECIALTIES, type AgentResult } from "./findAnAgent/types";
import { HeroSection } from "./findAnAgent/HeroSection";
import { AgentCard } from "./findAnAgent/AgentCard";
import { ReferralRequestDialog } from "./findAnAgent/ReferralRequestDialog";
import { HowItWorksSection, WhyHomiquitySection, CTASection } from "./findAnAgent/MarketingSections";

export default function FindAnAgent() {
  const [searchLocation, setSearchLocation] = useState("");
  const [searchSpecialty, setSearchSpecialty] = useState("");
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const agentsQuery = useQuery<AgentResult[]>({
    // Params live in the key, so the cache entry and the request agree.
    queryKey: [
      "/api/agents/search",
      { location: searchLocation, specialty: searchSpecialty },
    ],
    enabled: hasSearched,
    queryFn: getPublicQueryFn<AgentResult[]>(),
  });

  const handleHeroSearch = (loc: string) => {
    setSearchLocation(loc);
    setHasSearched(true);
    setTimeout(() => {
      document.getElementById("agent-results")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleRequestReferral = (agentId?: string) => {
    setSelectedAgentId(agentId || null);
    setShowReferralDialog(true);
  };

  const agents = agentsQuery.data || [];

  return (
    <div className="min-h-screen bg-background" data-testid="page-find-agent">
      <SEOHead
        title="Find a Trusted Real Estate Agent"
        description="Get matched with a top-rated local real estate agent who knows your market. Our verified network of professionals helps you buy or sell with confidence."
      />

      <HeroSection onSearch={handleHeroSearch} />

      <div id="agent-results" className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground mb-1" data-testid="text-search-heading">
              {hasSearched
                ? `Agents${searchLocation ? ` in ${searchLocation}` : ""}`
                : "Search for agents in your area"
              }
            </h2>
            {hasSearched && (
              <p className="text-sm text-muted-foreground">
                {agents.length} agent{agents.length !== 1 ? "s" : ""} found
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="w-52">
              <AddressInput
                placeholder="City, state, or ZIP"
                defaultValue={searchLocation}
                mode="location"
                onChange={(val) => setSearchLocation(val)}
                onSelect={(result) => {
                  const loc = result.city && result.state ? `${result.city}, ${result.state}` : result.formattedAddress;
                  setSearchLocation(loc);
                  setHasSearched(true);
                }}
              />
            </div>
            <Select
              value={searchSpecialty}
              onValueChange={(v) => {
                setSearchSpecialty(v === "all" ? "" : v);
                setHasSearched(true);
              }}
            >
              <SelectTrigger className="w-44" data-testid="select-search-specialty">
                <SelectValue placeholder="Specialty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specialties</SelectItem>
                {SPECIALTIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => setHasSearched(true)}
              data-testid="button-search-agents"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {hasSearched && agentsQuery.isLoading && (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {hasSearched && !agentsQuery.isLoading && agents.length === 0 && (
          <Card className="p-8 text-center" data-testid="card-no-agents">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground text-lg mb-2">
              No agents found in this area yet
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Don't worry — submit a referral request and we'll personally match you
              with a top agent in your area within 24 hours.
            </p>
            <Button onClick={() => handleRequestReferral()} data-testid="button-request-match">
              <Sparkles className="w-4 h-4 mr-2" />
              Request a Personal Match
            </Button>
          </Card>
        )}

        {hasSearched && agents.length > 0 && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onRequestReferral={() => handleRequestReferral(agent.id)}
                />
              ))}
            </div>

            <Card className="p-6 text-center bg-primary/5 border-primary/20" data-testid="card-cant-find">
              <h3 className="font-semibold text-foreground mb-2">
                Can't find exactly what you're looking for?
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Tell us your specific needs and we'll hand-pick an agent match for you.
              </p>
              <Button
                variant="outline"
                onClick={() => handleRequestReferral()}
                data-testid="button-custom-match"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Request a Custom Match
              </Button>
            </Card>
          </div>
        )}

        {!hasSearched && (
          <Card className="p-8 text-center" data-testid="card-start-search">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground text-lg mb-2">
              Search by location to find local agents
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Enter a city, state, or ZIP code above to discover vetted agents in your area.
              Or skip the search and let us match you directly.
            </p>
            <Button onClick={() => handleRequestReferral()} data-testid="button-skip-search">
              <Sparkles className="w-4 h-4 mr-2" />
              Skip Search — Match Me with an Agent
            </Button>
          </Card>
        )}
      </div>

      <HowItWorksSection />
      <WhyHomiquitySection />
      <CTASection onOpenForm={() => handleRequestReferral()} />

      <ReferralRequestDialog
        open={showReferralDialog}
        onClose={() => setShowReferralDialog(false)}
        selectedAgentId={selectedAgentId}
      />
    </div>
  );
}
