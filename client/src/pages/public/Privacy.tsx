import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEOHead } from "@/components/SEOHead";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { COMPANY_IDENTITY } from "@shared/companyIdentity";
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
  FileText,
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

const POLICY_SECTIONS = [
  {
    title: "Overview and Scope",
    content: "This Privacy Policy explains how Homiquity Corporation and its subsidiaries (\"Homiquity,\" \"we,\" or \"us\") collect, use, share, and protect your personal information when you use the Homiquity platform, website, and related services (the \"Services\"). It applies to information we collect through the Services and in connection with your mortgage application. By using the Services, you acknowledge the practices described in this Privacy Policy.",
  },
  {
    title: "Information We Collect",
    content: "We collect information you provide directly, information we collect automatically, and information we receive from third parties. Information you provide includes identifiers such as your name, address, email, phone number, date of birth, and Social Security number, as well as financial information such as income, assets, debts, and employment, and documents you upload such as pay stubs, tax returns, and bank statements. Information we collect automatically includes device and usage data such as IP address, browser type, pages viewed, and interactions with the Services. Information from third parties includes credit reports and scores from consumer reporting agencies, verification data from employers and financial institutions, and property and valuation data from real-estate data providers.",
  },
  {
    title: "How We Use Your Information",
    content: "We use your information to process and evaluate your mortgage application and determine your eligibility; to verify your identity, income, employment, and assets; to communicate with you about your account and loan; to generate required disclosures and compliance documents; to detect and prevent fraud; to operate, secure, and improve the Services; and to comply with our legal and regulatory obligations. We do not use your information for third-party advertising.",
  },
  {
    title: "How We Share Your Information",
    content: "We share your information only as needed to provide the Services and as permitted or required by law, including with: service providers and vendors that support your transaction (such as credit bureaus, verification services, title and settlement partners, and document providers); investors, lenders, and warehouse partners in connection with the origination, sale, or servicing of your loan; government agencies and regulators where required; and parties to whom you direct us to send information, such as your real estate agent. We do not sell your personal information, and we do not share it beyond what is necessary for your loan, for our legal obligations, or as otherwise described in this Privacy Policy.",
  },
  {
    title: "Financial Privacy (Gramm-Leach-Bliley Act)",
    content: "As a financial institution, we are required by the Gramm-Leach-Bliley Act (GLBA) to protect the privacy and security of your nonpublic personal information. We collect and disclose such information only as described in this Privacy Policy and as permitted by law. Where the law provides you the right to limit certain types of sharing, we will honor your election; you may contact us using the details below to exercise any applicable opt-out rights.",
  },
  {
    title: "Credit Reports and the Fair Credit Reporting Act (FCRA)",
    content: "With your authorization, we obtain your credit report and score from one or more consumer reporting agencies to evaluate your application. We handle credit information in accordance with the Fair Credit Reporting Act (FCRA). If we take an adverse action based in whole or in part on information contained in a consumer report, we will provide you the notices required by law.",
  },
  {
    title: "Cookies and Tracking Technologies",
    content: "We and our service providers use cookies and similar technologies to operate the Services, remember your preferences, maintain your session, analyze usage, and improve performance. You can control cookies through your browser settings, though disabling them may affect the functionality of the Services. We do not use your data for cross-context behavioral advertising.",
  },
  {
    title: "Data Retention",
    content: "We retain your personal information for as long as necessary to provide the Services, and thereafter as required to comply with our legal, regulatory, tax, and recordkeeping obligations. Mortgage records are subject to retention periods established by federal and state law. When information is no longer required, we securely delete or de-identify it.",
  },
  {
    title: "Your Privacy Rights",
    content: "Depending on your state of residence, you may have the right to request access to the personal information we hold about you, request correction of inaccurate information, request deletion of your information (subject to legal retention requirements), and receive a copy of your information in a portable format. California residents have additional rights under the California Consumer Privacy Act (CCPA), as amended by the CPRA, including the rights to know, delete, and correct personal information and the right to opt out of the sale or sharing of personal information — and we confirm that we do not sell or share your personal information as those terms are defined. To exercise any of these rights, contact us using the details below; we will not discriminate against you for doing so.",
  },
  {
    title: "Children's Privacy",
    content: "The Services are intended for adults and are not directed to children under 18. We do not knowingly collect personal information from children. If we learn that we have collected personal information from a child, we will delete it.",
  },
  {
    title: "Third-Party Links",
    content: "The Services may contain links to third-party websites that we do not own or control. This Privacy Policy does not apply to those websites, and we are not responsible for their privacy practices. We encourage you to review the privacy policy of any third-party website you visit.",
  },
  {
    title: "Changes to This Privacy Policy",
    content: "We may update this Privacy Policy from time to time. When we do, we will revise the \"Last updated\" date below and, where required by law, provide additional notice. Your continued use of the Services after the effective date of any change constitutes your acknowledgment of the updated Privacy Policy.",
  },
  {
    title: "Contact Us",
    content: `If you have questions about this Privacy Policy or wish to exercise your privacy rights, contact us at ${COMPANY_IDENTITY.contactEmail} or by phone at ${COMPANY_IDENTITY.contactPhone}. We will respond within the timeframes required by applicable law.`,
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Security & Privacy" description="Learn how Homiquity protects your personal and financial data with enterprise-grade encryption and strict regulatory compliance." />
      <Navigation />

      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[hsl(213,52%,18%)] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-info/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-success/10 blur-3xl" />
        
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
            <Shield className="h-4 w-4 text-success-subtle-foreground" />
            Your data is protected
          </div>
          <h1 className="font-display text-3xl font-bold leading-none text-white sm:text-4xl lg:text-5xl" data-testid="text-privacy-title">
            Security & Privacy
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            We take the protection of your personal and financial data seriously.
            Here's exactly how we keep your information safe.
          </p>
          <p className="mt-2 text-sm text-white/60">Last updated: July 3, 2026</p>
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
                      <FileCheck className="h-4 w-4 text-success-subtle-foreground" />
                    )}
                    {practice.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {practice.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${index === 2 ? "text-destructive" : "text-success-subtle-foreground"}`} />
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
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-success-subtle-foreground" />
                      <span><strong className="text-foreground">Access:</strong> Request a copy of all personal data we hold about you at any time.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-success-subtle-foreground" />
                      <span><strong className="text-foreground">Correction:</strong> Ask us to update or correct any inaccurate information.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-success-subtle-foreground" />
                      <span><strong className="text-foreground">Deletion:</strong> Request deletion of your data after your loan process is complete, subject to legal retention requirements.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-success-subtle-foreground" />
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

        <section data-testid="section-privacy-policy">
          <h2 className="text-2xl font-bold mb-2">Full Privacy Policy</h2>
          <p className="text-sm text-muted-foreground mb-6">
            The detailed policy below governs how we handle your information and describes your rights under applicable law.
          </p>
          <div className="space-y-6">
            {POLICY_SECTIONS.map((section, index) => (
              <Card key={index} data-testid={`card-policy-${index}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-primary" />
                    {index + 1}. {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="text-center py-8 border-t" data-testid="section-contact">
          <h3 className="text-lg font-semibold mb-2">Questions about your privacy?</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Our team is here to help. Contact us anytime with questions about how we handle your data.
          </p>
          <a href={`mailto:${COMPANY_IDENTITY.contactEmail}`} className="text-sm text-primary font-medium" data-testid="link-privacy-email">
            {COMPANY_IDENTITY.contactEmail}
          </a>
        </section>
      </div>

      <Footer />
    </div>
  );
}
