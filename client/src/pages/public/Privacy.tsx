import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEOHead } from "@/components/SEOHead";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import {
  Shield,
  Lock,
  Eye,
  Server,
  FileCheck,
  Users,
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  Database,
} from "lucide-react";

const SECURITY_FEATURES = [
  {
    icon: Lock,
    title: "256-bit Encryption",
    description: "All data in transit and at rest is encrypted using AES-256 and TLS 1.3, the same standards used by major banks.",
  },
  {
    icon: Fingerprint,
    title: "Secure Authentication",
    description: "Multi-factor authentication with session management ensures only you can access your account.",
  },
  {
    icon: Server,
    title: "SOC 2 Compliant Infrastructure",
    description: "Our systems are hosted on enterprise-grade cloud infrastructure with continuous monitoring and intrusion detection.",
  },
  {
    icon: Database,
    title: "Isolated Data Storage",
    description: "Your financial data is stored in isolated, encrypted databases with strict access controls and audit logging.",
  },
];

const DATA_PRACTICES = [
  {
    title: "What We Collect",
    items: [
      "Personal identification (name, email, SSN for credit checks)",
      "Financial information (income, debts, assets, employment)",
      "Property details for loan qualification",
      "Documents you upload (pay stubs, tax returns, bank statements)",
    ],
  },
  {
    title: "How We Use Your Data",
    items: [
      "Process your mortgage application and determine eligibility",
      "Communicate with you about your loan status",
      "Generate required disclosures and compliance documents",
      "Improve our services and your experience",
    ],
  },
  {
    title: "What We Never Do",
    items: [
      "Sell your personal information to third parties",
      "Share data beyond what's required for your loan",
      "Use your data for advertising or marketing purposes",
      "Store your data longer than legally required",
    ],
  },
];

const COMPLIANCE_ITEMS = [
  { label: "MISMO 3.4 Compliant", description: "Industry-standard data format for mortgage data exchange" },
  { label: "FCRA Compliant", description: "Fair Credit Reporting Act requirements for credit data handling" },
  { label: "TRID Compliant", description: "TILA-RESPA Integrated Disclosures for consumer protection" },
  { label: "ECOA Compliant", description: "Equal Credit Opportunity Act for fair lending practices" },
  { label: "GLBA Compliant", description: "Gramm-Leach-Bliley Act for financial privacy protection" },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Security & Privacy" description="Learn how Homiquity protects your personal and financial data with enterprise-grade encryption and strict regulatory compliance." />
      <Navigation />

      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[hsl(213,52%,18%)] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
        
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
            <Shield className="h-4 w-4 text-emerald-400" />
            Your data is protected
          </div>
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl" data-testid="text-privacy-title">
            Security & Privacy
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            We take the protection of your personal and financial data seriously.
            Here's exactly how we keep your information safe.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">

        <section data-testid="section-security-features">
          <h2 className="text-2xl font-bold mb-6">How We Protect You</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {SECURITY_FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} data-testid={`card-security-${index}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary/20 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{feature.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section data-testid="section-data-practices">
          <h2 className="text-2xl font-bold mb-6">Your Data, Explained Simply</h2>
          <div className="space-y-6">
            {DATA_PRACTICES.map((practice, index) => (
              <Card key={index} data-testid={`card-practice-${index}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    {index === 2 ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : index === 0 ? (
                      <Eye className="h-4 w-4 text-primary" />
                    ) : (
                      <FileCheck className="h-4 w-4 text-emerald-500" />
                    )}
                    {practice.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {practice.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${index === 2 ? "text-destructive" : "text-emerald-500"}`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section data-testid="section-data-rights">
          <h2 className="text-2xl font-bold mb-6">Your Rights</h2>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary/20 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold">You control your data</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                      <span><strong className="text-foreground">Access:</strong> Request a copy of all personal data we hold about you at any time.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                      <span><strong className="text-foreground">Correction:</strong> Ask us to update or correct any inaccurate information.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                      <span><strong className="text-foreground">Deletion:</strong> Request deletion of your data after your loan process is complete, subject to legal retention requirements.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                      <span><strong className="text-foreground">Portability:</strong> Export your data in a standard format to transfer to another provider.</span>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section data-testid="section-compliance">
          <h2 className="text-2xl font-bold mb-6">Regulatory Compliance</h2>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground mb-4">
                We maintain compliance with all applicable federal and state mortgage regulations:
              </p>
              <div className="flex flex-wrap gap-2">
                {COMPLIANCE_ITEMS.map((item, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="gap-1.5"
                    data-testid={`badge-compliance-${index}`}
                  >
                    <Shield className="h-3 w-3" />
                    {item.label}
                  </Badge>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {COMPLIANCE_ITEMS.map((item, index) => (
                  <p key={index} className="text-xs text-muted-foreground">
                    <strong>{item.label}:</strong> {item.description}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="text-center py-8 border-t" data-testid="section-contact">
          <h3 className="text-lg font-semibold mb-2">Questions about your privacy?</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Our team is here to help. Contact us anytime with questions about how we handle your data.
          </p>
          <a href="mailto:privacy@homiquity.com" className="text-sm text-primary font-medium" data-testid="link-privacy-email">
            privacy@homiquity.com
          </a>
        </section>
      </div>

      <Footer />
    </div>
  );
}
