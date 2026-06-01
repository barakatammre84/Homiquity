import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Scale, AlertCircle } from "lucide-react";

const SECTIONS = [
  {
    title: "Acceptance of Terms",
    content: "By accessing or using the Homiquity platform, website, and related services (collectively, the \"Services\"), you agree to be bound by these Terms of Use. If you do not agree to these terms, do not use our Services. We may update these terms at any time, and your continued use constitutes acceptance of any changes.",
  },
  {
    title: "Eligibility",
    content: "You must be at least 18 years old and a legal U.S. resident to use our Services. By using Homiquity, you represent that you meet these requirements and that all information you provide is accurate, current, and complete.",
  },
  {
    title: "Services Description",
    content: "Homiquity provides a digital mortgage platform that facilitates pre-approvals, loan applications, document management, and related mortgage services. Our platform connects borrowers with lending products and provides tools to evaluate mortgage options. Homiquity acts as a mortgage broker and/or direct lender depending on the product and state.",
  },
  {
    title: "User Accounts",
    content: "To access certain features, you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.",
  },
  {
    title: "Accuracy of Information",
    content: "You agree to provide truthful, accurate, and complete information in all forms, applications, and communications through our platform. Providing false or misleading information may result in denial of your application and termination of your account, and may constitute fraud under applicable federal and state laws.",
  },
  {
    title: "Intellectual Property",
    content: "All content, features, and functionality of the Homiquity platform, including but not limited to text, graphics, logos, icons, software, and the compilation thereof, are the exclusive property of Homiquity Corporation and are protected by U.S. and international copyright, trademark, and other intellectual property laws.",
  },
  {
    title: "Prohibited Uses",
    content: "You may not use the Services for any unlawful purpose, to solicit others to perform unlawful acts, to violate any regulations, to infringe upon our intellectual property rights, to submit false or misleading information, to upload malicious code, to interfere with the security features of the Services, or to use automated systems to access the platform without our express written permission.",
  },
  {
    title: "Limitation of Liability",
    content: "Homiquity Corporation, its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Services. Our total liability shall not exceed the fees paid by you, if any, for accessing the Services during the twelve months preceding the claim.",
  },
  {
    title: "Dispute Resolution",
    content: "Any dispute arising from these Terms shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, conducted in New York, NY. You agree to waive your right to a jury trial and to participate in a class action lawsuit.",
  },
  {
    title: "Governing Law",
    content: "These Terms are governed by the laws of the State of New York, without regard to its conflict of laws principles. You consent to the exclusive jurisdiction of the state and federal courts located in New York County, New York.",
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Terms of Use" description="Read the terms and conditions for using the Homiquity mortgage platform and related services." />
      <Navigation />

      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[hsl(213,52%,18%)] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
            <Scale className="h-4 w-4 text-emerald-400" />
            Legal Agreement
          </div>
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl" data-testid="text-terms-title">
            Terms of Use
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            Please read these terms carefully before using the Homiquity platform.
          </p>
          <p className="mt-2 text-sm text-white/60">Last updated: January 15, 2026</p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                These Terms of Use constitute a legally binding agreement between you and Homiquity Corporation. 
                By using our services, you acknowledge that you have read, understood, and agree to be bound by these terms.
              </p>
            </div>
          </CardContent>
        </Card>

        {SECTIONS.map((section, index) => (
          <Card key={index} data-testid={`card-terms-${index}`}>
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

        <section className="text-center py-8 border-t">
          <h3 className="text-lg font-semibold mb-2">Questions about these terms?</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Contact our legal team for clarification on any of these terms.
          </p>
          <a href="mailto:legal@homiquity.com" className="text-sm text-primary font-medium" data-testid="link-terms-email">
            legal@homiquity.com
          </a>
        </section>
      </div>

      <Footer />
    </div>
  );
}
