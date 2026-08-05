import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { CheckboxRow, DECLINE_LABEL } from "./CheckboxRow";
import { declineRace, setRaceSubcategory, setRaceText, setRaceTopLevel } from "./hmdaSelections";
import type { AsianSubcategory, PacificSubcategory, RaceState } from "./types";

const ASIAN_OPTIONS: { key: AsianSubcategory; label: string }[] = [
  { key: "asianIndian", label: "Asian Indian" },
  { key: "chinese", label: "Chinese" },
  { key: "filipino", label: "Filipino" },
  { key: "japanese", label: "Japanese" },
  { key: "korean", label: "Korean" },
  { key: "vietnamese", label: "Vietnamese" },
  { key: "otherAsian", label: "Other Asian" },
];

const PACIFIC_OPTIONS: { key: PacificSubcategory; label: string }[] = [
  { key: "guamanian", label: "Guamanian or Chamorro" },
  { key: "samoan", label: "Samoan" },
  { key: "otherPacificIslander", label: "Other Pacific Islander" },
];

export function RaceCard({
  race,
  onChange,
}: {
  race: RaceState;
  onChange: (next: RaceState) => void;
}) {
  const subcategoryRows = (options: { key: AsianSubcategory | PacificSubcategory; label: string }[]) =>
    options.map(({ key, label }) => (
      <CheckboxRow
        key={key}
        id={`race-${key}`}
        label={label}
        checked={race[key]}
        onCheckedChange={(c) => onChange(setRaceSubcategory(race, key, c))}
        testId={`checkbox-race-${key}`}
      />
    ));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Race
        </CardTitle>
        <CardDescription>Select one or more categories that apply</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <CheckboxRow
            id="race-american-indian"
            label="American Indian or Alaska Native"
            checked={race.americanIndian}
            onCheckedChange={(c) => onChange(setRaceTopLevel(race, "americanIndian", c))}
            testId="checkbox-race-american-indian"
          />
          {race.americanIndian && (
            <Input
              className="ml-6 max-w-xs"
              placeholder="Name of enrolled or principal tribe"
              value={race.americanIndianTribe}
              onChange={(e) => onChange(setRaceText(race, "americanIndianTribe", e.target.value))}
              data-testid="input-race-tribe"
            />
          )}

          <CheckboxRow
            id="race-asian"
            label="Asian"
            checked={race.asian}
            onCheckedChange={(c) => onChange(setRaceTopLevel(race, "asian", c))}
            testId="checkbox-race-asian"
          />
          {race.asian && (
            <div className="ml-6 space-y-2">
              {subcategoryRows(ASIAN_OPTIONS)}
              {race.otherAsian && (
                <Input
                  className="ml-6 max-w-xs"
                  placeholder="Please specify"
                  value={race.otherAsianText}
                  onChange={(e) => onChange(setRaceText(race, "otherAsianText", e.target.value))}
                  data-testid="input-race-other-asian-text"
                />
              )}
            </div>
          )}

          <CheckboxRow
            id="race-black"
            label="Black or African American"
            checked={race.black}
            onCheckedChange={(c) => onChange(setRaceTopLevel(race, "black", c))}
            testId="checkbox-race-black"
          />

          <CheckboxRow
            id="race-native-hawaiian"
            label="Native Hawaiian or Other Pacific Islander"
            checked={race.nativeHawaiian}
            onCheckedChange={(c) => onChange(setRaceTopLevel(race, "nativeHawaiian", c))}
            testId="checkbox-race-native-hawaiian"
          />
          {race.nativeHawaiian && (
            <div className="ml-6 space-y-2">
              {subcategoryRows(PACIFIC_OPTIONS)}
              {race.otherPacificIslander && (
                <Input
                  className="ml-6 max-w-xs"
                  placeholder="Please specify"
                  value={race.otherPacificIslanderText}
                  onChange={(e) => onChange(setRaceText(race, "otherPacificIslanderText", e.target.value))}
                  data-testid="input-race-other-pacific-text"
                />
              )}
            </div>
          )}

          <CheckboxRow
            id="race-white"
            label="White"
            checked={race.white}
            onCheckedChange={(c) => onChange(setRaceTopLevel(race, "white", c))}
            testId="checkbox-race-white"
          />

          <Separator />

          <CheckboxRow
            id="race-not-provided"
            label={DECLINE_LABEL}
            checked={race.notProvided}
            onCheckedChange={(c) => onChange(declineRace(race, c))}
            testId="checkbox-race-not-provided"
            muted
          />
        </div>
      </CardContent>
    </Card>
  );
}
