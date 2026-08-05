import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { CheckboxRow, DECLINE_LABEL } from "./CheckboxRow";
import {
  declineEthnicity,
  setEthnicityOtherText,
  setEthnicitySubcategory,
  setEthnicityTopLevel,
} from "./hmdaSelections";
import type { EthnicityState } from "./types";

const SUBCATEGORIES = [
  { key: "mexican", label: "Mexican", id: "ethnicity-mexican", testId: "checkbox-ethnicity-mexican" },
  { key: "puertoRican", label: "Puerto Rican", id: "ethnicity-puerto-rican", testId: "checkbox-ethnicity-puerto-rican" },
  { key: "cuban", label: "Cuban", id: "ethnicity-cuban", testId: "checkbox-ethnicity-cuban" },
  { key: "otherHispanicLatino", label: "Other Hispanic or Latino", id: "ethnicity-other", testId: "checkbox-ethnicity-other" },
] as const;

export function EthnicityCard({
  ethnicity,
  onChange,
}: {
  ethnicity: EthnicityState;
  onChange: (next: EthnicityState) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Ethnicity
        </CardTitle>
        <CardDescription>Select one or more categories that apply</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <CheckboxRow
            id="ethnicity-hispanic"
            label="Hispanic or Latino"
            checked={ethnicity.hispanicLatino}
            onCheckedChange={(c) => onChange(setEthnicityTopLevel(ethnicity, "hispanicLatino", c))}
            testId="checkbox-ethnicity-hispanic"
          />

          {ethnicity.hispanicLatino && (
            <div className="ml-6 space-y-2">
              {SUBCATEGORIES.map(({ key, label, id, testId }) => (
                <CheckboxRow
                  key={key}
                  id={id}
                  label={label}
                  checked={ethnicity[key]}
                  onCheckedChange={(c) => onChange(setEthnicitySubcategory(ethnicity, key, c))}
                  testId={testId}
                />
              ))}
              {ethnicity.otherHispanicLatino && (
                <Input
                  className="ml-6 max-w-xs"
                  placeholder="Please specify"
                  value={ethnicity.otherText}
                  onChange={(e) => onChange(setEthnicityOtherText(ethnicity, e.target.value))}
                  data-testid="input-ethnicity-other-text"
                />
              )}
            </div>
          )}

          <CheckboxRow
            id="ethnicity-not-hispanic"
            label="Not Hispanic or Latino"
            checked={ethnicity.notHispanicLatino}
            onCheckedChange={(c) => onChange(setEthnicityTopLevel(ethnicity, "notHispanicLatino", c))}
            testId="checkbox-ethnicity-not-hispanic"
          />

          <Separator />

          <CheckboxRow
            id="ethnicity-not-provided"
            label={DECLINE_LABEL}
            checked={ethnicity.notProvided}
            onCheckedChange={(c) => onChange(declineEthnicity(ethnicity, c))}
            testId="checkbox-ethnicity-not-provided"
            muted
          />
        </div>
      </CardContent>
    </Card>
  );
}
