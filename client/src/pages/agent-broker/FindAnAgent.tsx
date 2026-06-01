import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Search,
  MapPin,
  Star,
  Shield,
  Home,
  Clock,
  Users,
  CheckCircle2,
  ArrowRight,
  Phone,
  Mail,
  Sparkles,
  BadgeCheck,
  TrendingUp,
  Building2,
  DollarSign,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/AddressInput";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SEOHead } from "@/components/SEOHead";

const SPECIALTIES = [
  { value: "first_time_buyers", label: "First-Time Buyers" },
  { value: "luxury", label: "Luxury Homes" },
  { value: "investment", label: "Investment Properties" },
  { value: "commercial", label: "Commercial" },
  { value: "relocation", label: "Relocation" },
  { value: "new_construction", label: "New Construction" },
  { value: "condos", label: "Condos & Townhomes" },
  { value: "foreclosure", label: "Foreclosures & Short Sales" },
];

const TIMELINES = [
  { value: "immediately", label: "As soon as possible" },
  { value: "1_3_months", label: "1-3 months" },
  { value: "3_6_months", label: "3-6 months" },
  { value: "6_12_months", label: "6-12 months" },
  { value: "just_exploring", label: "Just exploring" },
];

const PRICE_RANGES = [
  { value: "under_200k", label: "Under $200K" },
  { value: "200k_400k", label: "$200K - $400K" },
  { value: "400k_600k", label: "$400K - $600K" },
  { value: "600k_800k", label: "$600K - $800K" },
  { value: "800k_1m", label: "$800K - $1M" },
  { value: "1m_2m", label: "$1M - $2M" },
  { value: "over_2m", label: "$2M+" },
];

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family Home" },
  { value: "condo", label: "Condo / Townhome" },
  { value: "multi_family", label: "Multi-Family (2-4 units)" },
  { value: "new_construction", label: "New Construction" },
  { value: "land", label: "Land / Lot" },
];

type AgentResult = {
  id: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  brokerage: string | null;
  specialties: string[] | null;
  serviceArea: string[] | null;
  photoUrl: string | null;
  averageRating: string | null;
  totalReviews: number | null;
  propertiesSold: number | null;
  activeListings: number | null;
  yearsInBusiness: number | null;
  isVerified: boolean | null;
};

function getSpecialtyLabel(value: string): string {
  return SPECIALTIES.find((s) => s.value === value)?.label || value.replace(/_/g, " ");
}

function HeroSection({ onSearch }: { onSearch: (loc: string) => void }) {
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

function AgentCard({
  agent,
  onRequestReferral,
}: {
  agent: AgentResult;
  onRequestReferral: (agentId: string) => void;
}) {
  const rating = agent.averageRating ? parseFloat(agent.averageRating) : 0;

  return (
    <Card className="p-5 hover-elevate transition-all" data-testid={`card-agent-${agent.id}`}>
      <div className="flex gap-4">
        <Avatar className="h-16 w-16 flex-shrink-0">
          <AvatarImage src={agent.photoUrl || undefined} alt={`${agent.firstName} ${agent.lastName}`} />
          <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
            {agent.firstName[0]}
            {agent.lastName?.[0] || ""}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="font-semibold text-foreground text-lg"
              data-testid={`text-agent-name-${agent.id}`}
            >
              {agent.firstName} {agent.lastName}
            </h3>
            {agent.isVerified && (
              <Badge variant="secondary" className="text-xs">
                <BadgeCheck className="w-3 h-3 mr-0.5" />
                Verified
              </Badge>
            )}
          </div>
          {agent.brokerage && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5" data-testid={`text-agent-brokerage-${agent.id}`}>
              <Building2 className="w-3 h-3" />
              {agent.brokerage}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {rating > 0 && (
              <div className="flex items-center gap-1 text-sm" data-testid={`text-agent-rating-${agent.id}`}>
                <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
                {(agent.totalReviews ?? 0) > 0 && (
                  <span className="text-muted-foreground">({agent.totalReviews} reviews)</span>
                )}
              </div>
            )}
            {(agent.propertiesSold ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid={`text-agent-sales-${agent.id}`}>
                <Home className="w-3.5 h-3.5" />
                {agent.propertiesSold} sold
              </div>
            )}
            {(agent.yearsInBusiness ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {agent.yearsInBusiness} years
              </div>
            )}
          </div>
        </div>
      </div>

      {agent.bio && (
        <p className="text-sm text-muted-foreground mt-3 line-clamp-2" data-testid={`text-agent-bio-${agent.id}`}>
          {agent.bio}
        </p>
      )}

      {agent.specialties && agent.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {agent.specialties.slice(0, 4).map((s) => (
            <Badge key={s} variant="outline" className="text-xs">
              {getSpecialtyLabel(s)}
            </Badge>
          ))}
          {agent.specialties.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{agent.specialties.length - 4} more
            </Badge>
          )}
        </div>
      )}

      {agent.serviceArea && agent.serviceArea.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <MapPin className="w-3 h-3" />
          <span>{agent.serviceArea.slice(0, 3).join(", ")}</span>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <Button
          className="flex-1"
          onClick={() => onRequestReferral(agent.id)}
          data-testid={`button-connect-${agent.id}`}
        >
          Connect with Agent
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}

function ReferralRequestDialog({
  open,
  onClose,
  selectedAgentId,
}: {
  open: boolean;
  onClose: () => void;
  selectedAgentId: string | null;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    buyingTimeline: "",
    priceRange: "",
    propertyType: "",
    specialNeeds: "",
    preApproved: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    status: string;
    matchedAgent?: { firstName: string; lastName: string; brokerage: string | null; photoUrl: string | null } | null;
  } | null>(null);

  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData & { preferredAgentId?: string }) => {
      const res = await apiRequest("POST", "/api/agent-referral-requests", data);
      return res.json();
    },
    onSuccess: (result) => {
      setMatchResult(result);
      setSubmitted(true);
      toast({
        title: "Request submitted",
        description: result.status === "matched"
          ? "We found a great agent match for you!"
          : "We'll match you with a top agent within 24 hours.",
      });
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again or call us for help.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.location || !formData.buyingTimeline) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    submitMutation.mutate({
      ...formData,
      preferredAgentId: selectedAgentId || undefined,
    });
  };

  const handleClose = () => {
    setSubmitted(false);
    setMatchResult(null);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      location: "",
      buyingTimeline: "",
      priceRange: "",
      propertyType: "",
      specialNeeds: "",
      preApproved: false,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-referral-request">
        {submitted && matchResult ? (
          <div className="text-center py-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
            >
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            </motion.div>
            <h3 className="text-xl font-bold text-foreground mb-2" data-testid="text-referral-success">
              {matchResult.status === "matched" ? "You've been matched!" : "Request received!"}
            </h3>
            {matchResult.matchedAgent ? (
              <div className="mt-4">
                <p className="text-muted-foreground mb-4">
                  We found a great agent for you. They'll reach out within 24 hours.
                </p>
                <Card className="p-4 inline-flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={matchResult.matchedAgent.photoUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {matchResult.matchedAgent.firstName[0]}
                      {matchResult.matchedAgent.lastName?.[0] || ""}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="font-semibold text-foreground" data-testid="text-matched-agent-name">
                      {matchResult.matchedAgent.firstName} {matchResult.matchedAgent.lastName}
                    </p>
                    {matchResult.matchedAgent.brokerage && (
                      <p className="text-sm text-muted-foreground">{matchResult.matchedAgent.brokerage}</p>
                    )}
                  </div>
                </Card>
              </div>
            ) : (
              <p className="text-muted-foreground">
                We're finding the best agent match for your needs. You'll hear from us within 24 hours.
              </p>
            )}
            <div className="flex flex-col gap-2 mt-6">
              <Button onClick={() => navigate("/apply")} data-testid="button-get-preapproved">
                Get Pre-Approved While You Wait
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button variant="outline" onClick={handleClose} data-testid="button-close-success">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl" data-testid="text-dialog-title">
                Get connected with a top agent
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Tell us about your home search and we'll match you with the right agent.
              </p>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ref-firstName">First name *</Label>
                  <Input
                    id="ref-firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    data-testid="input-referral-firstname"
                  />
                </div>
                <div>
                  <Label htmlFor="ref-lastName">Last name *</Label>
                  <Input
                    id="ref-lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    data-testid="input-referral-lastname"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ref-email">Email *</Label>
                <Input
                  id="ref-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  data-testid="input-referral-email"
                />
              </div>

              <div>
                <Label htmlFor="ref-phone">Phone</Label>
                <Input
                  id="ref-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  data-testid="input-referral-phone"
                />
              </div>

              <div>
                <Label htmlFor="ref-location">Where are you looking to buy? *</Label>
                <AddressInput
                  placeholder="City, state, or neighborhood"
                  defaultValue={formData.location}
                  mode="location"
                  onChange={(val) => setFormData({ ...formData, location: val })}
                  onSelect={(result) => {
                    const loc = result.city && result.state ? `${result.city}, ${result.state}` : result.formattedAddress;
                    setFormData({ ...formData, location: loc });
                  }}
                />
              </div>

              <div>
                <Label>When are you looking to buy? *</Label>
                <Select
                  value={formData.buyingTimeline}
                  onValueChange={(v) => setFormData({ ...formData, buyingTimeline: v })}
                >
                  <SelectTrigger data-testid="select-referral-timeline">
                    <SelectValue placeholder="Select a timeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMELINES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price range</Label>
                  <Select
                    value={formData.priceRange}
                    onValueChange={(v) => setFormData({ ...formData, priceRange: v })}
                  >
                    <SelectTrigger data-testid="select-referral-price">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICE_RANGES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Property type</Label>
                  <Select
                    value={formData.propertyType}
                    onValueChange={(v) => setFormData({ ...formData, propertyType: v })}
                  >
                    <SelectTrigger data-testid="select-referral-property-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="ref-needs">Anything specific you need? (optional)</Label>
                <Textarea
                  id="ref-needs"
                  placeholder="e.g. School district preferences, accessibility needs, must-have features..."
                  value={formData.specialNeeds}
                  onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
                  className="resize-none"
                  rows={3}
                  data-testid="input-referral-needs"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-preapproved">
                <input
                  type="checkbox"
                  checked={formData.preApproved}
                  onChange={(e) => setFormData({ ...formData, preApproved: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm text-muted-foreground">I'm already pre-approved for a mortgage</span>
              </label>

              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending}
                data-testid="button-submit-referral"
              >
                {submitMutation.isPending ? "Submitting..." : "Find My Agent Match"}
                {!submitMutation.isPending && <ArrowRight className="w-4 h-4 ml-1" />}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By submitting, you agree to be contacted by a Homiquity partner agent.
                Your information is secure and never sold to third parties.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      step: 1,
      icon: Search,
      title: "Tell us what you need",
      desc: "Share your location, budget, timeline, and preferences so we can find your ideal match.",
    },
    {
      step: 2,
      icon: Sparkles,
      title: "We match you intelligently",
      desc: "Our algorithm evaluates agent experience, specialties, ratings, and local expertise to find your best fit.",
    },
    {
      step: 3,
      icon: Phone,
      title: "Your agent reaches out",
      desc: "Your matched agent contacts you within 24 hours to discuss your goals and start your search.",
    },
    {
      step: 4,
      icon: Home,
      title: "Find your dream home",
      desc: "Your agent guides you from showings through closing, with our lending team supporting every step.",
    },
  ];

  return (
    <section className="py-16 bg-muted/30" data-testid="section-how-it-works">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3" data-testid="text-how-title">
            How it works
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Getting connected with a top local agent is simple and free.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div
              key={s.step}
              className="text-center"
              data-testid={`step-${s.step}`}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-4">
                <s.icon className="w-6 h-6" />
              </div>
              <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                Step {s.step}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyHomiquitySection() {
  const benefits = [
    {
      icon: Shield,
      title: "Quality guaranteed",
      desc: "Every agent in our network is licensed, vetted, and maintains a minimum 4.5-star rating. If you're not satisfied, we'll re-match you at no cost.",
    },
    {
      icon: DollarSign,
      title: "Save on your purchase",
      desc: "Our partner agents offer competitive commission structures. Combined with Homiquity lending, you could save thousands on your home purchase.",
    },
    {
      icon: Users,
      title: "One seamless team",
      desc: "Your agent works directly with our lending team. No more back-and-forth between separate companies — one unified experience from offer to close.",
    },
  ];

  return (
    <section className="py-16" data-testid="section-why-homiquity">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Why find your agent through Homiquity?
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            We're not just a directory. We actively match you based on your needs and
            back every referral with our quality guarantee.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {benefits.map((b) => (
            <Card key={b.title} className="p-6" data-testid={`card-why-${b.title.toLowerCase().replace(/ /g, "-")}`}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
                <b.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-2">{b.title}</h3>
              <p className="text-sm text-muted-foreground">{b.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ onOpenForm }: { onOpenForm: () => void }) {
  return (
    <section className="py-16 bg-primary/5" data-testid="section-cta">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
          Ready to find your perfect agent?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Answer a few questions and we'll match you with a top-rated local agent
          who specializes in exactly what you're looking for. It's free and takes
          less than 2 minutes.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={onOpenForm} data-testid="button-cta-find-agent">
            <Users className="w-4 h-4 mr-2" />
            Find My Agent
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => window.location.href = "/apply"}
            data-testid="button-cta-preapproval"
          >
            Get Pre-Approved First
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function FindAnAgent() {
  const [searchLocation, setSearchLocation] = useState("");
  const [searchSpecialty, setSearchSpecialty] = useState("");
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const agentsQuery = useQuery<AgentResult[]>({
    queryKey: ["/api/agents/search", searchLocation, searchSpecialty],
    enabled: hasSearched,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchLocation) params.set("location", searchLocation);
      if (searchSpecialty) params.set("specialty", searchSpecialty);
      const res = await fetch(`/api/agents/search?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
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
