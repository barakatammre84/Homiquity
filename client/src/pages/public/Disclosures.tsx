import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COMPANY_IDENTITY, isCompanyNmlsPending, LICENSED_STATE_DETAILS } from "@shared/companyIdentity";
import {
  Shield,
  Building,
  MapPin,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Monitor,
  RefreshCw,
  CreditCard,
  Accessibility,
  Scale,
} from "lucide-react";

export default function Disclosures() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Disclosures & Licensing" description="Homiquity Mortgage Corporation disclosures: our role as a mortgage broker, NMLS Consumer Access, licensing status, Equal Housing Opportunity, and affiliated business arrangements." />
      <Navigation />

      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[hsl(213,52%,18%)] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-info/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-success/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
            <Shield className="h-4 w-4 text-success-subtle-foreground" />
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
                <p className="text-sm text-muted-foreground">Homiquity Mortgage Corporation</p>
              </div>
              <div>
                <p className="text-sm font-medium">NMLS ID</p>
                <p className="text-sm text-muted-foreground">{isCompanyNmlsPending() ? "Pending" : COMPANY_IDENTITY.nmlsId}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Mailing Address</p>
                <p className="text-sm text-muted-foreground">Available on request — contact us at the email below.</p>
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
              Homiquity Mortgage Corporation is registered with the Nationwide Multistate Licensing System & Registry (NMLS). 
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
              Homiquity Mortgage Corporation arranges mortgage financing only in the states
              listed below. Every license is independently verifiable through NMLS Consumer
              Access under our NMLS ID{isCompanyNmlsPending() ? "" : ` ${COMPANY_IDENTITY.nmlsId}`}.
            </p>
            <ul className="space-y-2" data-testid="list-licensed-states">
              {LICENSED_STATE_DETAILS.map((state) => (
                <li
                  key={state.code}
                  className="flex items-start justify-between gap-3 rounded-md border p-3"
                  data-testid={`licensed-state-${state.code}`}
                >
                  <div>
                    <p className="text-sm font-medium">{state.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {state.license}
                      {state.licenseNumber ? ` — ${state.licenseNumber}` : ""}
                    </p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success-subtle-foreground" />
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We do not accept applications or provide quotes for properties in states where we
              are not licensed. Additional state licenses will be listed here as they are issued.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-equal-housing">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Shield className="h-5 w-5 text-primary" />
              Equal Housing Opportunity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Homiquity Mortgage Corporation supports Equal Housing Opportunity. We are committed to fair
              practices and do not discriminate on the basis of race, color, religion, national origin, sex,
              marital status, age, disability, familial status, or any other characteristic protected by
              federal, state, or local law.
            </p>
            <div className="flex items-start gap-3 rounded-md border p-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning-subtle-foreground" />
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

        <Card data-testid="card-not-commitment">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <FileText className="h-5 w-5 text-primary" />
              Not a Commitment to Lend
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              The information provided on the Homiquity platform is for general informational purposes and does not
              constitute an offer or commitment to lend, a guarantee of any particular rate or term, or approval of
              any application. All loans are subject to credit approval, income and asset verification, property
              appraisal, and satisfaction of all underwriting conditions.
            </p>
            <p>
              Any rates, payments, or terms shown are illustrative, may not reflect your individual circumstances, and
              are subject to the disclosures presented at the time they are displayed. Receipt of a pre-approval or
              pre-qualification does not guarantee a final loan approval.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-credit-inquiries">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <CreditCard className="h-5 w-5 text-primary" />
              Credit Inquiries
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              With your authorization, we obtain your credit report to evaluate your eligibility. A preliminary rate
              quote or pre-qualification typically uses a soft credit inquiry, which does not affect your credit score.
            </p>
            <p>
              A full mortgage application generally requires a hard credit inquiry, which may affect your credit score.
              We handle credit information in accordance with the Fair Credit Reporting Act (FCRA).
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-electronic-communications">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Monitor className="h-5 w-5 text-primary" />
              Electronic Communications (E-SIGN)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              By using the Services and consenting to electronic records, you agree that we may provide disclosures,
              notices, and documents to you electronically in accordance with the federal Electronic Signatures in
              Global and National Commerce Act (E-SIGN Act). Electronic disclosures are considered to be "in writing."
            </p>
            <p>
              To access electronic disclosures you need a device with internet access, a current web browser, and the
              ability to view and save PDF documents. You may withdraw your consent or request paper copies at any time
              by contacting us; withdrawing consent may affect our ability to serve you online.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-servicing-transfer">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <RefreshCw className="h-5 w-5 text-primary" />
              Transfer of Loan Servicing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              The servicing of your mortgage loan — the collection of your payments — may be assigned, sold, or
              transferred to another party. Your loan terms will not change as a result of a servicing transfer.
            </p>
            <p>
              If servicing of your loan is transferred, you will receive advance written notice as required by the
              Real Estate Settlement Procedures Act (RESPA), including the effective date and the contact information
              for your new servicer.
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
              that Homiquity Mortgage Corporation may have business relationships with title companies, appraisal firms, 
              and insurance providers. These relationships are fully disclosed during the loan application process.
            </p>
            <p>
              You are not required to use any of our affiliated service providers. You are free to shop for 
              and select your own providers for settlement services. Your choice of providers will not affect 
              our decision to approve or deny your loan application.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-complaints">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Scale className="h-5 w-5 text-primary" />
              Complaints & State Regulators
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              If you have a complaint about your loan or our services, please contact our compliance team at
              compliance@homiquity.com so we can work to resolve it.
            </p>
            <p>
              You may also file a complaint with the Consumer Financial Protection Bureau (CFPB) at consumerfinance.gov,
              with the New York State Department of Financial Services, or with the mortgage regulator in your state of
              residence. State-specific complaint and disclosure notices are provided during the application process
              where required by law.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-accessibility">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Accessibility className="h-5 w-5 text-primary" />
              Website Accessibility
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Homiquity is committed to making its website accessible to all users, including people with disabilities,
              and strives to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.
            </p>
            <p>
              If you experience any difficulty accessing part of our website, please contact us at
              accessibility@homiquity.com or 1-800-HOMIQTY so we can assist you and continue to improve the experience
              for everyone.
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
