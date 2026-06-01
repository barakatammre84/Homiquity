import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Building, MapPin, FileCheck, CheckCircle2, AlertCircle } from "lucide-react";

const LICENSING_STATES = [
  "Alabama", "Arizona", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
  "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska",
  "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "South Carolina", "Tennessee", "Texas", "Utah", "Virginia",
  "Washington", "West Virginia", "Wisconsin",
];

export default function Disclosures() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Disclosures & Licensing" description="View Homiquity Corporation licensing information, NMLS details, state licensing, equal housing lender disclosure, and affiliated business arrangements." />
      <Navigation />

      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[hsl(213,52%,18%)] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
            <Shield className="h-4 w-4 text-emerald-400" />
            Transparency
          </div>
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl" data-testid="text-disclosures-title">
            Disclosures & Licensing
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            Full transparency about our licensing, affiliations, and regulatory compliance.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <Card data-testid="card-company-info">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Building className="h-5 w-5 text-primary" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Legal Entity</p>
                <p className="text-sm text-muted-foreground">Homiquity Corporation</p>
              </div>
              <div>
                <p className="text-sm font-medium">NMLS ID</p>
                <p className="text-sm text-muted-foreground">#123456</p>
              </div>
              <div>
                <p className="text-sm font-medium">Headquarters</p>
                <p className="text-sm text-muted-foreground">World Trade Center, 200 State Street, New York, NY 10000</p>
              </div>
              <div>
                <p className="text-sm font-medium">Contact</p>
                <p className="text-sm text-muted-foreground">1-800-HOMIQTY | hello@homiquity.com</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-nmls">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <FileCheck className="h-5 w-5 text-primary" />
              NMLS Consumer Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Homiquity Corporation is registered with the Nationwide Multistate Licensing System & Registry (NMLS). 
              You can verify our licensing status, view public filings, and access consumer resources through the 
              NMLS Consumer Access portal.
            </p>
            <a
              href="https://www.nmlsconsumeraccess.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
              data-testid="link-nmls-access"
            >
              Visit NMLS Consumer Access
              <CheckCircle2 className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>

        <Card data-testid="card-licensing">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <MapPin className="h-5 w-5 text-primary" />
              State Licensing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Homiquity Corporation is licensed to originate mortgage loans in the following states. 
              Licensing requirements and available products may vary by state.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {LICENSING_STATES.map((state) => (
                <Badge key={state} variant="secondary" className="text-xs">
                  {state}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-equal-housing">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Shield className="h-5 w-5 text-primary" />
              Equal Housing Lender
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Homiquity Corporation is an Equal Housing Lender. We are committed to fair lending practices and 
              do not discriminate on the basis of race, color, religion, national origin, sex, marital status, 
              age, disability, familial status, or any other characteristic protected by federal, state, or local law.
            </p>
            <div className="flex items-start gap-3 rounded-md border p-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                If you believe you have been discriminated against in a credit transaction, you may file a complaint 
                with the Consumer Financial Protection Bureau (CFPB) at consumerfinance.gov or contact the 
                U.S. Department of Housing and Urban Development (HUD) at 1-800-669-9777.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-rate-disclosure">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <FileCheck className="h-5 w-5 text-primary" />
              Rate & Fee Disclosures
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Rates displayed on the Homiquity platform are subject to change without notice and are not guaranteed 
              until locked. Actual rates may vary based on your credit profile, loan amount, property type, 
              occupancy status, and other factors.
            </p>
            <p>
              APR (Annual Percentage Rate) represents the total cost of credit as a yearly rate, including 
              interest and certain fees. The APR may be higher than the stated interest rate because it includes 
              additional costs such as origination fees, discount points, and mortgage insurance.
            </p>
            <p>
              Pre-approval is based on preliminary information and does not constitute a commitment to lend. 
              Final loan approval is subject to full underwriting review, property appraisal, and satisfaction 
              of all conditions.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-affiliated-business">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Building className="h-5 w-5 text-primary" />
              Affiliated Business Arrangement Disclosure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              In accordance with Section 8 of the Real Estate Settlement Procedures Act (RESPA), we disclose 
              that Homiquity Corporation may have business relationships with title companies, appraisal firms, 
              and insurance providers. These relationships are fully disclosed during the loan application process.
            </p>
            <p>
              You are not required to use any of our affiliated service providers. You are free to shop for 
              and select your own providers for settlement services. Your choice of providers will not affect 
              our decision to approve or deny your loan application.
            </p>
          </CardContent>
        </Card>

        <section className="text-center py-8 border-t">
          <h3 className="text-lg font-semibold mb-2">Need more information?</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Contact our compliance team for any questions about our licensing or disclosures.
          </p>
          <a href="mailto:compliance@homiquity.com" className="text-sm text-primary font-medium" data-testid="link-disclosures-email">
            compliance@homiquity.com
          </a>
        </section>
      </div>

      <Footer />
    </div>
  );
}
