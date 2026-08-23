import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Scale, AlertCircle } from "lucide-react";
import { COMPANY_IDENTITY } from "@shared/companyIdentity";

const SECTIONS = [
  {
    title: "Acceptance of Terms",
    content: "These Terms of Use (\"Terms\") govern your access to and use of the Homiquity platform, website, and related services (collectively, the \"Services\"). Please read them carefully before using the Services. By accessing or using the Services, you agree to be bound by these Terms. If you do not agree to all of these Terms, please discontinue using the Services immediately.",
  },
  {
    title: "About This Website and Its Content",
    content: "The Services are owned and operated by Homiquity Mortgage Corporation and its subsidiaries and provide general information about our and our subsidiaries' mortgage products and services. Your eligibility for any particular product or service is subject to our final determination, restrictions, and acceptance. We may modify, discontinue, or make changes to the information, products, licenses, or services described in the Services at any time, and we reserve the right to terminate any or all offerings without prior notice. Any dated information is published as of its publication date only, and we undertake no obligation to update it. Although we strive to provide accurate and timely information, the Services may contain inadvertent technical or factual inaccuracies or typographical errors, and we do not warrant the accuracy, completeness, or timeliness of any content, text, graphics, or links.",
  },
  {
    title: "Eligibility",
    content: "You must be at least 18 years old and a legal U.S. resident to use our Services. By using Homiquity, you represent that you meet these requirements and that all information you provide is accurate, current, and complete.",
  },
  {
    title: "Description of Services",
    content: "Homiquity provides a digital mortgage platform that facilitates pre-approvals, loan applications, document management, and related mortgage services. Our platform connects borrowers with lending products and provides tools to evaluate mortgage options. Homiquity acts as a mortgage broker, arranging loans with third-party wholesale lending partners; Homiquity does not make credit decisions or fund loans. By offering information, products, or services through the Services, we make no solicitation to any person to use them in jurisdictions where doing so is prohibited by law.",
  },
  {
    title: "Your Account",
    content: "To access certain features you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. We recommend signing out and closing your browser after using the Services, especially on a shared device. If you believe your credentials or any information you submitted has been used without your permission, notify us immediately by calling 1-800-HOMIQTY; calling is the fastest way to limit potential losses. If you fail to notify us, you may be responsible for unauthorized activity on your account.",
  },
  {
    title: "Website Availability and Access",
    content: "You are solely responsible for obtaining and maintaining the hardware, software, internet access, and other services necessary to use the Services. From time to time the Services may be unavailable due to maintenance, malfunctions, unusually high transaction volume, or similar reasons. We are not responsible for any loss, damage, cost, or expense you may incur, directly or indirectly, as a result of the unavailability of the Services or your inability to access them, including causes related to your device, your internet service provider, or the capacity or limitations of the internet. We may deny or suspend your access to the Services at any time, with or without cause and without prior notice. If we terminate these Terms, any application you have submitted will continue to be evaluated and any existing transactions you have entered into will remain in effect. The Services are not intended for use where such use would be contrary to applicable law, and you are responsible for compliance with all local laws.",
  },
  {
    title: "Third-Party Links",
    content: "The Services may contain links to third-party websites, including social media, that we do not own or control and that are provided for your convenience. If you follow a link to another website, you do so at your own risk and subject to that website's terms. A link does not mean we endorse, authorize, sponsor, or are affiliated with the linked website or its operators, and we may remove any link at any time. We do not warrant that your use of materials displayed in the Services will not infringe the rights of third parties not owned by or affiliated with us.",
  },
  {
    title: "Accuracy of Information You Provide",
    content: "You agree to provide truthful, accurate, and complete information in all forms, applications, and communications through our platform. Providing false or misleading information may result in denial of your application and termination of your account, and may constitute fraud under applicable federal and state laws.",
  },
  {
    title: "Your Information and License to Use It",
    content: "During your use of the Services you may submit information, documents, feedback, and suggestions (\"Your Information\"). We do not claim ownership of Your Information. However, by submitting it you grant Homiquity, our affiliates, and the vendors necessary to your transaction permission to use Your Information to fulfill your request for services, including to copy, distribute, transmit, reproduce, edit, translate, and reformat it as needed for that purpose. We will never publicly display your non-public personal information. Specific terms provided on the page describing a particular feature or offer may supersede this provision.",
  },
  {
    title: "SMS / Text Message Consent",
    content: `By providing your telephone contact information, you consent in writing to receive SMS text-message communications from Homiquity, our subsidiaries, and our service-provider partners (including title and settlement partners) at any number you provide in connection with your account, application, loan, or closing. These "SMS Account Notifications" may relate to application status, account and loan information, information and document requests, due dates, delinquent accounts, closings, and program updates, and are considered to be "in writing." Message frequency varies based on account activity. There is no service fee for SMS Account Notifications, but message and data rates from your carrier may apply. You may withdraw your consent at any time by replying STOP, END, CANCEL, UNSUBSCRIBE, or QUIT, or by calling ${COMPANY_IDENTITY.contactPhone}; withdrawal becomes effective after we have had a reasonable period of time to process it. To receive SMS Account Notifications you must have an SMS-capable mobile phone, an active account with a wireless carrier, and sufficient storage on your device. We may modify or discontinue text-message services at any time, for any reason, and without notice.`,
  },
  {
    title: "Consent to Employment and Income Verification",
    content: "By providing your employment information, you consent in writing to permit Homiquity and our subsidiaries to contact third parties as necessary to verify your income and employment.",
  },
  {
    title: "Consent to Communicate with Your Real Estate Agent",
    content: "By providing the contact information of your real estate agent, you consent in writing to permit Homiquity and our affiliates to contact your agent to discuss your loan, including its status, milestones, and timelines toward closing.",
  },
  {
    title: "Intellectual Property",
    content: "All content, features, and functionality of the Homiquity platform, including but not limited to text, graphics, logos, icons, software, expressions, and the compilation thereof, are the exclusive property of Homiquity Mortgage Corporation and are protected by U.S. and international copyright, trademark, patent, publicity, and other intellectual property laws. You may print a copy of the information contained in the Services solely for your personal, non-commercial use; this right may be revoked at any time. Any commercial use of the Services or their content is prohibited.",
  },
  {
    title: "Prohibited Uses",
    content: "You may not use the Services for any unlawful purpose, to solicit others to perform unlawful acts, to violate any regulations, to infringe upon our intellectual property rights, to submit false or misleading information, to upload malicious code, to interfere with the security features of the Services, or to use automated systems to access the platform without our express written permission. You also may not post on or transmit through the Services any material that is unlawful, threatening, libelous, defamatory, obscene, inflammatory, pornographic, or profane, or any other content that could give rise to civil or criminal liability under applicable law.",
  },
  {
    title: "Disclaimer of Warranties",
    content: "The Services and their content are provided \"as is\" and \"as available,\" without warranties of any kind, whether express or implied, including but not limited to the implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We assume no responsibility and shall not be liable for any viruses or other harmful components that may infect or damage your computer equipment or other property as a result of your access to, use of, or browsing of the Services or your downloading of any materials from them.",
  },
  {
    title: "Limitation of Liability",
    content: "To the fullest extent permitted by law, Homiquity Mortgage Corporation and its subsidiaries, officers, directors, employees, and agents shall not be liable for any direct, indirect, special, incidental, consequential, or punitive damages arising out of or in connection with the Services or your use of, or inability to use, the Services, including damages arising from any failure of performance, error, omission, interruption, defect, delay in operation or transmission, computer virus, system failure, or disclosure of information, even if we have been advised of the possibility of such damages. Some jurisdictions do not allow the exclusion or limitation of certain damages, in which case our liability is limited to the greatest extent permitted by law. Where liability cannot be excluded, our total liability shall not exceed the fees, if any, you paid to access the Services during the twelve months preceding the claim.",
  },
  {
    title: "Indemnification",
    content: "You agree to indemnify and hold harmless Homiquity Mortgage Corporation and its subsidiaries from and against any and all claims, losses, expenses, demands, or liabilities, including reasonable attorneys' fees and costs, arising out of your use of the Services in violation of these Terms or of any applicable law, or out of any third-party claim (including any intellectual-property claim). You agree to cooperate fully in the defense of any such claim. We reserve the right, at our own expense, to assume the exclusive defense and control of any matter otherwise subject to indemnification by you, and you will not settle any such claim without our written consent.",
  },
  {
    title: "Dispute Resolution",
    content: "Any dispute arising from these Terms shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, conducted in New York, NY. You agree to waive your right to a jury trial and to participate in a class action lawsuit.",
  },
  {
    title: "Governing Law and Severability",
    content: "These Terms are governed by the laws of the United States and the State of New York, without regard to conflict-of-laws principles. You consent to the exclusive jurisdiction of the state and federal courts located in New York County, New York. No failure, omission, or delay by us in exercising any right under these Terms waives that or any other right. If any provision of these Terms is changed by applicable law or held invalid by a court, the remaining provisions will remain in effect and these Terms will be interpreted as if the invalid provision had not been included. Section headings are intended only to help organize these Terms.",
  },
  {
    title: "Changes to These Terms",
    content: "We may amend all or any part of these Terms from time to time, including by establishing, increasing, or decreasing fees and charges for products and services offered through the Services and by changing the features and functionality of the Services. We will notify you electronically of any change as required by applicable law. Your continued use of the Services after the effective date of a change constitutes your agreement to be bound by it. You should also review these Terms periodically for any changes.",
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Terms of Use" description="Read the terms and conditions for using the Homiquity mortgage platform and related services." />
      <Navigation />

      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[hsl(213,52%,18%)] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-info/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-success/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
            <Scale className="h-4 w-4 text-success-subtle-foreground" />
            Legal Agreement
          </div>
          <h1 className="font-display text-3xl font-bold leading-none text-white sm:text-4xl lg:text-5xl" data-testid="text-terms-title">
            Terms of Use
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            Please read these terms carefully before using the Homiquity platform.
          </p>
          <p className="mt-2 text-sm text-white/60">Last updated: July 3, 2026</p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-warning-subtle-foreground" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                These Terms of Use constitute a legally binding agreement between you and Homiquity Mortgage Corporation. 
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
          <a href={`mailto:${COMPANY_IDENTITY.contactEmail}`} className="text-sm text-primary font-medium" data-testid="link-terms-email">
            {COMPANY_IDENTITY.contactEmail}
          </a>
        </section>
      </div>

      <Footer />
    </div>
  );
}
