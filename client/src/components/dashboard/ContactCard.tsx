import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";
import { COMPANY_IDENTITY, companyNmlsDisplay } from "@shared/companyIdentity";

import { CardLabel } from "./CardLabel";

/**
 * "CONTACT US" — the company contact card (split from the old combined
 * TrustLayer). All real data from COMPANY_IDENTITY; the NMLS line renders only
 * when `companyNmlsDisplay()` is non-null (never a placeholder — 12 CFR 1008).
 */
export function ContactCard() {
  const nmls = companyNmlsDisplay();
  const telHref = `tel:${COMPANY_IDENTITY.contactPhone.replace(/[^\d+]/g, "")}`;

  return (
    <Card className="shadow-card" data-testid="card-contact">
      <CardContent className="p-5">
        <CardLabel>Contact Us</CardLabel>
        <p className="text-sm font-semibold text-foreground" data-testid="text-contact-company">
          {COMPANY_IDENTITY.shortName}
        </p>
        {nmls && (
          <p className="mt-0.5 text-xs text-muted-foreground" data-testid="text-contact-nmls">
            {nmls}
          </p>
        )}
        <div className="mt-3 space-y-2">
          <a
            href={telHref}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            data-testid="link-contact-phone"
          >
            <Phone className="h-4 w-4 shrink-0" />
            {COMPANY_IDENTITY.contactPhone}
          </a>
          <a
            href={`mailto:${COMPANY_IDENTITY.contactEmail}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            data-testid="link-contact-email"
          >
            <Mail className="h-4 w-4 shrink-0" />
            {COMPANY_IDENTITY.contactEmail}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
