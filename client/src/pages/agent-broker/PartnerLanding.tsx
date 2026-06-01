import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  Phone,
  Globe,
  Shield,
  ArrowRight,
  Home,
  Calculator,
  Clock,
  Award,
} from "lucide-react";

interface PublicProfile {
  brandName: string;
  tagline: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  accentColor: string;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  nmlsId: string | null;
  licenseNumber: string | null;
  disclaimerText: string | null;
  bio: string | null;
  specialties: string[] | null;
  serviceAreas: string[] | null;
  loName: string;
  loProfileImage: string | null;
}

const BENEFITS = [
  { icon: Clock, title: "3-Minute Pre-Approval", description: "Get a clear answer in minutes, not days." },
  { icon: Shield, title: "Soft Credit Check", description: "Soft pull pre-qualification protects your score." },
  { icon: Calculator, title: "True Numbers", description: "See real rates, fees, and monthly payments upfront." },
  { icon: Award, title: "Transparent Process", description: "Track every step from application to closing." },
];

export default function PartnerLanding() {
  const [, params] = useRoute("/partner/:profileId");
  const profileId = params?.profileId;

  const { data: profile, isLoading, error } = useQuery<PublicProfile>({
    queryKey: ['/api/co-brand/public', profileId],
    enabled: !!profileId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" data-testid="partner-not-found">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <Home className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <h2 className="text-lg font-bold text-foreground mb-1">Page Not Found</h2>
            <p className="text-sm text-muted-foreground mb-4">This partner landing page is not available.</p>
            <Button asChild data-testid="button-go-home">
              <Link href="/">Go to Homepage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="partner-landing-page">
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${profile.primaryColor}, ${profile.primaryColor}cc)` }}
      >
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-3xl mx-auto px-4 py-12 md:py-16 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 text-white/80 text-xs">
              <span>Powered by</span>
              <span className="font-semibold text-white">Homiquity</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold md:text-4xl" data-testid="text-brand-name">{profile.brandName}</h1>
          {profile.tagline && <p className="text-base opacity-90 mt-2 md:text-lg">{profile.tagline}</p>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="text-base" style={{ backgroundColor: profile.accentColor, borderColor: profile.accentColor }} asChild data-testid="button-apply">
              <Link href="/apply">
                Get Pre-Approved
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base border-white/30 text-white backdrop-blur-sm bg-white/10" asChild data-testid="button-learn">
              <Link href="/first-time-buyer">
                First-Time Buyer Guide
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="benefits-grid">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <Card key={benefit.title}>
                <CardContent className="py-4 flex items-start gap-3">
                  <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${profile.accentColor}15` }}>
                    <Icon className="h-4 w-4" style={{ color: profile.accentColor }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{benefit.title}</p>
                    <p className="text-xs text-muted-foreground">{benefit.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {(profile.bio || profile.loName) && (
          <Card data-testid="card-about">
            <CardContent className="py-5">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full shrink-0 text-white font-bold text-lg" style={{ backgroundColor: profile.primaryColor }}>
                  {profile.loName.split(" ").map(n => n[0]).join("").substring(0, 2)}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground" data-testid="text-lo-name">{profile.loName}</h3>
                  <p className="text-xs text-muted-foreground">Your Mortgage Partner at {profile.brandName}</p>
                  {profile.bio && <p className="text-sm text-muted-foreground mt-2">{profile.bio}</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {profile.contactEmail && (
                      <a href={`mailto:${profile.contactEmail}`} className="flex items-center gap-1 hover:text-foreground" data-testid="link-contact-email">
                        <Mail className="h-3 w-3" /> {profile.contactEmail}
                      </a>
                    )}
                    {profile.contactPhone && (
                      <a href={`tel:${profile.contactPhone}`} className="flex items-center gap-1 hover:text-foreground" data-testid="link-contact-phone">
                        <Phone className="h-3 w-3" /> {profile.contactPhone}
                      </a>
                    )}
                    {profile.websiteUrl && (
                      <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground" data-testid="link-website">
                        <Globe className="h-3 w-3" /> Website
                      </a>
                    )}
                  </div>
                  {profile.nmlsId && (
                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> NMLS #{profile.nmlsId}
                      {profile.licenseNumber && <> | License: {profile.licenseNumber}</>}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-how-it-works">
          <CardContent className="py-5">
            <h3 className="text-base font-semibold text-foreground mb-4">How It Works</h3>
            <div className="space-y-3">
              {[
                { step: "1", title: "Answer a few questions", desc: "Simple, conversational form — no financial jargon." },
                { step: "2", title: "Get your pre-approval", desc: "Real numbers based on MISMO 3.4 underwriting in under 3 minutes." },
                { step: "3", title: "Start shopping", desc: "Use your letter to make confident offers on properties." },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 text-white text-sm font-bold" style={{ backgroundColor: profile.accentColor }}>
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-center py-4">
          <Button size="lg" className="text-base" style={{ backgroundColor: profile.accentColor, borderColor: profile.accentColor }} asChild data-testid="button-apply-bottom">
            <Link href="/apply">
              Get Started Now
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>

        {profile.disclaimerText && (
          <p className="text-[10px] text-muted-foreground text-center max-w-xl mx-auto" data-testid="text-disclaimer">
            {profile.disclaimerText}
          </p>
        )}

        <div className="border-t pt-4 text-center">
          <p className="text-[10px] text-muted-foreground">
            Powered by <span className="font-semibold">Homiquity</span> — Clear answers. Confident approvals.
          </p>
        </div>
      </div>
    </div>
  );
}
