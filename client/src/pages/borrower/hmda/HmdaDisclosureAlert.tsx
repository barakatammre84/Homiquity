import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * The federal government monitoring notice.
 *
 * This wording is the standard HMDA/Reg C disclosure that accompanies the
 * demographic collection — it states that furnishing is optional, that the
 * lender may not discriminate on the information or on the applicant's choice
 * to withhold it, and that visual observation applies when collection happens
 * in person. Do not paraphrase, shorten, or "improve" it.
 */
export function HmdaDisclosureAlert() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription data-testid="text-hmda-disclosure">
        The following information is requested by the Federal Government for certain types of loans
        related to a dwelling in order to monitor the lender's compliance with equal credit
        opportunity, fair housing, and home mortgage disclosure laws. You are not required to furnish
        this information, but are encouraged to do so. The law provides that a lender may not
        discriminate either on the basis of this information, or on whether you choose to furnish it.
        If you furnish the information, please provide both ethnicity and race. If you do not furnish
        ethnicity, race, or sex, the lender is required to note the information on the basis of visual
        observation or surname if done in person. If you do not wish to furnish the information,
        please check the box below each category.
      </AlertDescription>
    </Alert>
  );
}
