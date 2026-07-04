import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale } from "lucide-react";
import type { DemographicsState } from "./types";

interface DemographicsSectionProps {
  demographics: DemographicsState;
  onChange: (value: DemographicsState) => void;
  activeSeq: number;
}

export function DemographicsSection({ demographics, onChange, activeSeq }: DemographicsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Demographic Information
        </CardTitle>
        <CardDescription>
          This information is requested by the federal government (HMDA) to monitor
          compliance with fair lending laws. You are not required to provide it
          {activeSeq === 1 ? " (Primary Borrower)" : " (Co-Borrower)"}. Answering — or
          declining to answer — never affects your loan decision.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Ethnicity</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.ethnicityHispanicLatino}
                onCheckedChange={(c) => onChange({ ...demographics, ethnicityHispanicLatino: !!c })}
                data-testid="checkbox-ethnicity-hispanic"
              />
              Hispanic or Latino
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.ethnicityNotHispanicLatino}
                onCheckedChange={(c) => onChange({ ...demographics, ethnicityNotHispanicLatino: !!c })}
                data-testid="checkbox-ethnicity-not-hispanic"
              />
              Not Hispanic or Latino
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.ethnicityNotProvided}
                onCheckedChange={(c) => onChange({ ...demographics, ethnicityNotProvided: !!c })}
                data-testid="checkbox-ethnicity-not-provided"
              />
              Prefer not to provide
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Race</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.raceAmericanIndian}
                onCheckedChange={(c) => onChange({ ...demographics, raceAmericanIndian: !!c })}
                data-testid="checkbox-race-american-indian"
              />
              American Indian or Alaska Native
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.raceAsian}
                onCheckedChange={(c) => onChange({ ...demographics, raceAsian: !!c })}
                data-testid="checkbox-race-asian"
              />
              Asian
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.raceBlack}
                onCheckedChange={(c) => onChange({ ...demographics, raceBlack: !!c })}
                data-testid="checkbox-race-black"
              />
              Black or African American
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.raceNativeHawaiian}
                onCheckedChange={(c) => onChange({ ...demographics, raceNativeHawaiian: !!c })}
                data-testid="checkbox-race-native-hawaiian"
              />
              Native Hawaiian or Pacific Islander
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.raceWhite}
                onCheckedChange={(c) => onChange({ ...demographics, raceWhite: !!c })}
                data-testid="checkbox-race-white"
              />
              White
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.raceNotProvided}
                onCheckedChange={(c) => onChange({ ...demographics, raceNotProvided: !!c })}
                data-testid="checkbox-race-not-provided"
              />
              Prefer not to provide
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Sex</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.sexFemale}
                onCheckedChange={(c) => onChange({ ...demographics, sexFemale: !!c })}
                data-testid="checkbox-sex-female"
              />
              Female
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.sexMale}
                onCheckedChange={(c) => onChange({ ...demographics, sexMale: !!c })}
                data-testid="checkbox-sex-male"
              />
              Male
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.sexNotProvided}
                onCheckedChange={(c) => onChange({ ...demographics, sexNotProvided: !!c })}
                data-testid="checkbox-sex-not-provided"
              />
              Prefer not to provide
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Age</Label>
          <div className="flex flex-wrap items-center gap-4">
            <Input
              type="number"
              min="0"
              className="w-28"
              placeholder="Age"
              value={demographics.ageNotProvided ? "" : demographics.age}
              disabled={demographics.ageNotProvided}
              onChange={(e) => onChange({ ...demographics, age: e.target.value })}
              data-testid="input-demographics-age"
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={demographics.ageNotProvided}
                onCheckedChange={(c) => onChange({ ...demographics, ageNotProvided: !!c, age: c ? "" : demographics.age })}
                data-testid="checkbox-age-not-provided"
              />
              Prefer not to provide
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
