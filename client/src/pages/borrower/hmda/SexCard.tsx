import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckboxRow, DECLINE_LABEL } from "./CheckboxRow";
import { setSex } from "./hmdaSelections";
import type { SexState } from "./types";

export function SexCard({
  sex,
  onChange,
}: {
  sex: SexState;
  onChange: (next: SexState) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Sex
        </CardTitle>
        <CardDescription>Select one option</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <CheckboxRow
          id="sex-female"
          label="Female"
          checked={sex.female}
          onCheckedChange={(c) => onChange(setSex("female", c))}
          testId="checkbox-sex-female"
        />
        <CheckboxRow
          id="sex-male"
          label="Male"
          checked={sex.male}
          onCheckedChange={(c) => onChange(setSex("male", c))}
          testId="checkbox-sex-male"
        />

        <Separator />

        <CheckboxRow
          id="sex-not-provided"
          label={DECLINE_LABEL}
          checked={sex.notProvided}
          onCheckedChange={(c) => onChange(setSex("notProvided", c))}
          testId="checkbox-sex-not-provided"
          muted
        />
      </CardContent>
    </Card>
  );
}
