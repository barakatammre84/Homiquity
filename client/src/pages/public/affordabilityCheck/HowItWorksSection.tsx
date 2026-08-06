import { ArrowRight, DollarSign, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** The pre-search explainer — what the visitor sees before looking up a home. */
export function HowItWorksSection() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Paste Any Address</h3>
            <p className="text-sm text-muted-foreground">
              Copy a listing URL from Zillow, Redfin, or Realtor.com — or just type the address.
            </p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">See the Full Picture</h3>
            <p className="text-sm text-muted-foreground">
              Monthly payment, DTI analysis, PMI, taxes — everything calculated for your specific situation.
            </p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <ArrowRight className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Apply in 3 Minutes</h3>
            <p className="text-sm text-muted-foreground">
              Ready to move forward? Start a pre-approval application pre-filled with this property.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
