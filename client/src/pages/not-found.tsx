import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Home, FileText, Search, Percent, ArrowRight, HelpCircle } from "lucide-react";

const recoveryLinks = [
  { href: "/", label: "Go Home", description: "Back to the homepage", icon: Home },
  { href: "/apply", label: "Get Pre-Approved", description: "Start your mortgage application", icon: FileText },
  { href: "/rates", label: "See Today's Rates", description: "View current mortgage rates", icon: Percent },
  { href: "/faq", label: "Help & FAQ", description: "Find answers to common questions", icon: HelpCircle },
];

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="text-center max-w-xl">
          <p className="text-6xl font-bold text-primary" data-testid="text-404-code">404</p>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl" data-testid="text-404-title">
            Page not found
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Sorry, we couldn't find the page you're looking for. Let's get you back on track.
          </p>
        </div>

        <div className="mt-10 grid w-full max-w-lg gap-3 sm:grid-cols-2">
          {recoveryLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <button
                  className="flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover-elevate"
                  data-testid={`link-404-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{link.label}</p>
                    <p className="text-xs text-muted-foreground">{link.description}</p>
                  </div>
                </button>
              </Link>
            );
          })}
        </div>

        <div className="mt-8">
          <Link href="/">
            <Button variant="outline" className="gap-2" data-testid="button-404-home">
              Back to Homiquity
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
