import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileSignature, 
  CheckCircle2, 
  ChevronRight,
  Clock,
  Shield
} from "lucide-react";

interface Consent {
  id: string;
  consentType: string;
  consentGiven: boolean;
  consentedAt?: string;
  title?: string;
}

interface ConsentStatus {
  consentType: string;
  hasConsented: boolean;
  required: boolean;
  title: string;
  description: string;
}

const CONSENT_DISPLAY_INFO: Record<string, { title: string; description: string; priority: number }> = {
  credit_pull: { 
    title: "Credit Authorization", 
    description: "Authorize us to check your credit report",
    priority: 1 
  },
  econsent: { 
    title: "Electronic Signature Consent", 
    description: "Agree to receive documents electronically",
    priority: 2 
  },
  disclosure: { 
    title: "Initial Disclosures", 
    description: "Review and acknowledge required disclosures",
    priority: 3 
  },
  privacy_policy: { 
    title: "Privacy Policy", 
    description: "Review and accept our privacy policy",
    priority: 4 
  },
  tila_respa: { 
    title: "TILA-RESPA Disclosure", 
    description: "Truth in Lending and RESPA disclosures",
    priority: 5 
  },
};

const REQUIRED_CONSENTS = ["credit_pull", "econsent", "disclosure"];

function ConsentItem({ consent, isPending }: { consent: ConsentStatus; isPending: boolean }) {
  return (
    <div 
      className={`flex items-center justify-between p-4 rounded-lg border ${
        isPending ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/10" : "border-border bg-muted/30"
      }`}
      data-testid={`consent-item-${consent.consentType}`}
    >
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-full ${
          isPending 
            ? "bg-amber-100 dark:bg-amber-900/20" 
            : "bg-emerald-100 dark:bg-emerald-900/20"
        }`}>
          {isPending ? (
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
        <div>
          <h4 className="font-medium">{consent.title}</h4>
          <p className="text-sm text-muted-foreground">{consent.description}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {isPending ? (
          <Link href="/e-consent">
            <Button size="sm" data-testid={`button-consent-${consent.consentType}`}>
              <FileSignature className="h-4 w-4 mr-2" />
              Review
            </Button>
          </Link>
        ) : (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )}
      </div>
    </div>
  );
}

export function ConsentsCard({ applicationId }: { applicationId?: string }) {
  const { data: consents, isLoading } = useQuery<Consent[]>({
    queryKey: ['/api/consents/application', applicationId],
    enabled: !!applicationId,
  });

  const consentStatuses: ConsentStatus[] = REQUIRED_CONSENTS.map(type => {
    const info = CONSENT_DISPLAY_INFO[type] || { title: type, description: "", priority: 99 };
    const existingConsent = consents?.find(c => c.consentType === type && c.consentGiven);
    
    return {
      consentType: type,
      hasConsented: !!existingConsent,
      required: true,
      title: info.title,
      description: info.description,
    };
  }).sort((a, b) => {
    if (a.hasConsented !== b.hasConsented) return a.hasConsented ? 1 : -1;
    return (CONSENT_DISPLAY_INFO[a.consentType]?.priority || 99) - 
           (CONSENT_DISPLAY_INFO[b.consentType]?.priority || 99);
  });

  const pendingConsents = consentStatuses.filter(c => !c.hasConsented);
  const completedConsents = consentStatuses.filter(c => c.hasConsented);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Consents & Authorizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-20">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingConsents.length === 0 && completedConsents.length === 0) {
    return null;
  }

  return (
    <Card data-testid="card-consents">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Consents & Authorizations
            </CardTitle>
            <CardDescription className="mt-1">
              {pendingConsents.length > 0 
                ? `${pendingConsents.length} consent${pendingConsents.length > 1 ? "s" : ""} needed to proceed`
                : "All required consents completed"}
            </CardDescription>
          </div>
          {pendingConsents.length > 0 && (
            <Badge variant="default" className="bg-amber-500">
              {pendingConsents.length} Required
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingConsents.length > 0 && (
          <div className="space-y-2">
            {pendingConsents.map(consent => (
              <ConsentItem key={consent.consentType} consent={consent} isPending={true} />
            ))}
          </div>
        )}

        {completedConsents.length > 0 && (
          <div className="space-y-2">
            {pendingConsents.length > 0 && (
              <h4 className="text-sm font-medium text-muted-foreground mt-4 mb-2">Completed</h4>
            )}
            {completedConsents.map(consent => (
              <ConsentItem key={consent.consentType} consent={consent} isPending={false} />
            ))}
          </div>
        )}

        {pendingConsents.length > 0 && (
          <Link href="/e-consent" className="block mt-4">
            <Button className="w-full" data-testid="button-complete-consents">
              Complete All Consents
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default ConsentsCard;
