import { ArrowRight, DollarSign, Home, Phone, Search, Shield, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function HowItWorksSection() {
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

export function WhyHomiquitySection() {
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

export function CTASection({ onOpenForm }: { onOpenForm: () => void }) {
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
