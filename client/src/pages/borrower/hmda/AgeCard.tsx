import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { CheckboxRow, DECLINE_LABEL } from "./CheckboxRow";
import { declineAge, setAge, type AgeState } from "./hmdaSelections";

export function AgeCard({
  age,
  ageNotProvided,
  onChange,
}: {
  age: string;
  ageNotProvided: boolean;
  onChange: (next: AgeState) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Age
        </CardTitle>
        <CardDescription>Enter your age as of the application date</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min="18"
            max="120"
            className="max-w-[120px]"
            placeholder="Age"
            value={age}
            onChange={(e) => onChange(setAge(e.target.value))}
            disabled={ageNotProvided}
            data-testid="input-age"
          />
          <span className="text-sm text-muted-foreground">years old</span>
        </div>

        <Separator />

        <CheckboxRow
          id="age-not-provided"
          label={DECLINE_LABEL}
          checked={ageNotProvided}
          onCheckedChange={(c) => onChange(declineAge(c, age))}
          testId="checkbox-age-not-provided"
          muted
        />
      </CardContent>
    </Card>
  );
}
