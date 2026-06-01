import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Info,
  Save,
  ArrowLeft,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { HmdaDemographics as HmdaData } from "@shared/schema";

interface HmdaResponse {
  demographics: HmdaData | null;
}

export default function HmdaDemographics() {
  const { id: applicationId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [ethnicity, setEthnicity] = useState({
    hispanicLatino: false,
    mexican: false,
    cuban: false,
    puertoRican: false,
    otherHispanicLatino: false,
    otherText: "",
    notHispanicLatino: false,
    notProvided: false,
  });

  const [race, setRace] = useState({
    americanIndian: false,
    americanIndianTribe: "",
    asian: false,
    asianIndian: false,
    chinese: false,
    filipino: false,
    japanese: false,
    korean: false,
    vietnamese: false,
    otherAsian: false,
    otherAsianText: "",
    black: false,
    nativeHawaiian: false,
    guamanian: false,
    samoan: false,
    otherPacificIslander: false,
    otherPacificIslanderText: "",
    white: false,
    notProvided: false,
  });

  const [sex, setSex] = useState({
    female: false,
    male: false,
    notProvided: false,
  });

  const [age, setAge] = useState<string>("");
  const [ageNotProvided, setAgeNotProvided] = useState(false);

  const demographicsQuery = useQuery<HmdaResponse>({
    queryKey: ["/api/loan-applications", applicationId, "hmda"],
    enabled: !!applicationId,
  });

  useEffect(() => {
    const d = demographicsQuery.data?.demographics;
    if (d) {
      setEthnicity({
        hispanicLatino: d.ethnicityHispanicLatino ?? false,
        mexican: d.ethnicityMexican ?? false,
        cuban: d.ethnicityCuban ?? false,
        puertoRican: d.ethnicityPuertoRican ?? false,
        otherHispanicLatino: d.ethnicityOtherHispanicLatino ?? false,
        otherText: d.ethnicityOtherText ?? "",
        notHispanicLatino: d.ethnicityNotHispanicLatino ?? false,
        notProvided: d.ethnicityNotProvided ?? false,
      });
      setRace({
        americanIndian: d.raceAmericanIndian ?? false,
        americanIndianTribe: d.raceAmericanIndianTribe ?? "",
        asian: d.raceAsian ?? false,
        asianIndian: d.raceAsianIndian ?? false,
        chinese: d.raceChinese ?? false,
        filipino: d.raceFilipino ?? false,
        japanese: d.raceJapanese ?? false,
        korean: d.raceKorean ?? false,
        vietnamese: d.raceVietnamese ?? false,
        otherAsian: d.raceOtherAsian ?? false,
        otherAsianText: d.raceOtherAsianText ?? "",
        black: d.raceBlack ?? false,
        nativeHawaiian: d.raceNativeHawaiian ?? false,
        guamanian: d.raceGuamanian ?? false,
        samoan: d.raceSamoan ?? false,
        otherPacificIslander: d.raceOtherPacificIslander ?? false,
        otherPacificIslanderText: d.raceOtherPacificIslanderText ?? "",
        white: d.raceWhite ?? false,
        notProvided: d.raceNotProvided ?? false,
      });
      setSex({
        female: d.sexFemale ?? false,
        male: d.sexMale ?? false,
        notProvided: d.sexNotProvided ?? false,
      });
      setAge(d.age ? String(d.age) : "");
      setAgeNotProvided(d.ageNotProvided ?? false);
    }
  }, [demographicsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ethnicityHispanicLatino: ethnicity.hispanicLatino,
        ethnicityMexican: ethnicity.mexican,
        ethnicityCuban: ethnicity.cuban,
        ethnicityPuertoRican: ethnicity.puertoRican,
        ethnicityOtherHispanicLatino: ethnicity.otherHispanicLatino,
        ethnicityOtherText: ethnicity.otherText || null,
        ethnicityNotHispanicLatino: ethnicity.notHispanicLatino,
        ethnicityNotProvided: ethnicity.notProvided,

        raceAmericanIndian: race.americanIndian,
        raceAmericanIndianTribe: race.americanIndianTribe || null,
        raceAsian: race.asian,
        raceAsianIndian: race.asianIndian,
        raceChinese: race.chinese,
        raceFilipino: race.filipino,
        raceJapanese: race.japanese,
        raceKorean: race.korean,
        raceVietnamese: race.vietnamese,
        raceOtherAsian: race.otherAsian,
        raceOtherAsianText: race.otherAsianText || null,
        raceBlack: race.black,
        raceNativeHawaiian: race.nativeHawaiian,
        raceGuamanian: race.guamanian,
        raceSamoan: race.samoan,
        raceOtherPacificIslander: race.otherPacificIslander,
        raceOtherPacificIslanderText: race.otherPacificIslanderText || null,
        raceWhite: race.white,
        raceNotProvided: race.notProvided,

        sexFemale: sex.female,
        sexMale: sex.male,
        sexNotProvided: sex.notProvided,

        age: ageNotProvided ? null : (age ? parseInt(age) : null),
        ageNotProvided,
      };
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/hmda`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Demographic information has been saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications", applicationId, "hmda"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save demographic information.", variant: "destructive" });
    },
  });

  if (demographicsQuery.isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/dashboard`)}
          data-testid="button-back-dashboard"
        >
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-hmda">
            <Users className="h-6 w-6 text-muted-foreground" />
            Demographic Information
          </h1>
          <p className="text-sm text-muted-foreground">Government Monitoring Information (HMDA)</p>
        </div>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Ethnicity
          </CardTitle>
          <CardDescription>Select one or more categories that apply</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="ethnicity-hispanic"
                checked={ethnicity.hispanicLatino}
                onCheckedChange={(c) => setEthnicity(p => ({ ...p, hispanicLatino: !!c, notProvided: false }))}
                data-testid="checkbox-ethnicity-hispanic"
              />
              <Label htmlFor="ethnicity-hispanic">Hispanic or Latino</Label>
            </div>

            {ethnicity.hispanicLatino && (
              <div className="ml-6 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ethnicity-mexican"
                    checked={ethnicity.mexican}
                    onCheckedChange={(c) => setEthnicity(p => ({ ...p, mexican: !!c }))}
                    data-testid="checkbox-ethnicity-mexican"
                  />
                  <Label htmlFor="ethnicity-mexican">Mexican</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ethnicity-puerto-rican"
                    checked={ethnicity.puertoRican}
                    onCheckedChange={(c) => setEthnicity(p => ({ ...p, puertoRican: !!c }))}
                    data-testid="checkbox-ethnicity-puerto-rican"
                  />
                  <Label htmlFor="ethnicity-puerto-rican">Puerto Rican</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ethnicity-cuban"
                    checked={ethnicity.cuban}
                    onCheckedChange={(c) => setEthnicity(p => ({ ...p, cuban: !!c }))}
                    data-testid="checkbox-ethnicity-cuban"
                  />
                  <Label htmlFor="ethnicity-cuban">Cuban</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ethnicity-other"
                    checked={ethnicity.otherHispanicLatino}
                    onCheckedChange={(c) => setEthnicity(p => ({ ...p, otherHispanicLatino: !!c }))}
                    data-testid="checkbox-ethnicity-other"
                  />
                  <Label htmlFor="ethnicity-other">Other Hispanic or Latino</Label>
                </div>
                {ethnicity.otherHispanicLatino && (
                  <Input
                    className="ml-6 max-w-xs"
                    placeholder="Please specify"
                    value={ethnicity.otherText}
                    onChange={(e) => setEthnicity(p => ({ ...p, otherText: e.target.value }))}
                    data-testid="input-ethnicity-other-text"
                  />
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="ethnicity-not-hispanic"
                checked={ethnicity.notHispanicLatino}
                onCheckedChange={(c) => setEthnicity(p => ({ ...p, notHispanicLatino: !!c, notProvided: false }))}
                data-testid="checkbox-ethnicity-not-hispanic"
              />
              <Label htmlFor="ethnicity-not-hispanic">Not Hispanic or Latino</Label>
            </div>

            <Separator />

            <div className="flex items-center gap-2">
              <Checkbox
                id="ethnicity-not-provided"
                checked={ethnicity.notProvided}
                onCheckedChange={(c) => setEthnicity(p => ({
                  ...p,
                  notProvided: !!c,
                  hispanicLatino: !!c ? false : p.hispanicLatino,
                  notHispanicLatino: !!c ? false : p.notHispanicLatino,
                  mexican: !!c ? false : p.mexican,
                  cuban: !!c ? false : p.cuban,
                  puertoRican: !!c ? false : p.puertoRican,
                  otherHispanicLatino: !!c ? false : p.otherHispanicLatino,
                }))}
                data-testid="checkbox-ethnicity-not-provided"
              />
              <Label htmlFor="ethnicity-not-provided" className="text-muted-foreground">
                I do not wish to provide this information
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Race
          </CardTitle>
          <CardDescription>Select one or more categories that apply</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="race-american-indian"
                checked={race.americanIndian}
                onCheckedChange={(c) => setRace(p => ({ ...p, americanIndian: !!c, notProvided: false }))}
                data-testid="checkbox-race-american-indian"
              />
              <Label htmlFor="race-american-indian">American Indian or Alaska Native</Label>
            </div>
            {race.americanIndian && (
              <Input
                className="ml-6 max-w-xs"
                placeholder="Name of enrolled or principal tribe"
                value={race.americanIndianTribe}
                onChange={(e) => setRace(p => ({ ...p, americanIndianTribe: e.target.value }))}
                data-testid="input-race-tribe"
              />
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="race-asian"
                checked={race.asian}
                onCheckedChange={(c) => setRace(p => ({ ...p, asian: !!c, notProvided: false }))}
                data-testid="checkbox-race-asian"
              />
              <Label htmlFor="race-asian">Asian</Label>
            </div>
            {race.asian && (
              <div className="ml-6 space-y-2">
                {[
                  { key: "asianIndian" as const, label: "Asian Indian" },
                  { key: "chinese" as const, label: "Chinese" },
                  { key: "filipino" as const, label: "Filipino" },
                  { key: "japanese" as const, label: "Japanese" },
                  { key: "korean" as const, label: "Korean" },
                  { key: "vietnamese" as const, label: "Vietnamese" },
                  { key: "otherAsian" as const, label: "Other Asian" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`race-${key}`}
                      checked={race[key]}
                      onCheckedChange={(c) => setRace(p => ({ ...p, [key]: !!c }))}
                      data-testid={`checkbox-race-${key}`}
                    />
                    <Label htmlFor={`race-${key}`}>{label}</Label>
                  </div>
                ))}
                {race.otherAsian && (
                  <Input
                    className="ml-6 max-w-xs"
                    placeholder="Please specify"
                    value={race.otherAsianText}
                    onChange={(e) => setRace(p => ({ ...p, otherAsianText: e.target.value }))}
                    data-testid="input-race-other-asian-text"
                  />
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="race-black"
                checked={race.black}
                onCheckedChange={(c) => setRace(p => ({ ...p, black: !!c, notProvided: false }))}
                data-testid="checkbox-race-black"
              />
              <Label htmlFor="race-black">Black or African American</Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="race-native-hawaiian"
                checked={race.nativeHawaiian}
                onCheckedChange={(c) => setRace(p => ({ ...p, nativeHawaiian: !!c, notProvided: false }))}
                data-testid="checkbox-race-native-hawaiian"
              />
              <Label htmlFor="race-native-hawaiian">Native Hawaiian or Other Pacific Islander</Label>
            </div>
            {race.nativeHawaiian && (
              <div className="ml-6 space-y-2">
                {[
                  { key: "guamanian" as const, label: "Guamanian or Chamorro" },
                  { key: "samoan" as const, label: "Samoan" },
                  { key: "otherPacificIslander" as const, label: "Other Pacific Islander" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`race-${key}`}
                      checked={race[key]}
                      onCheckedChange={(c) => setRace(p => ({ ...p, [key]: !!c }))}
                      data-testid={`checkbox-race-${key}`}
                    />
                    <Label htmlFor={`race-${key}`}>{label}</Label>
                  </div>
                ))}
                {race.otherPacificIslander && (
                  <Input
                    className="ml-6 max-w-xs"
                    placeholder="Please specify"
                    value={race.otherPacificIslanderText}
                    onChange={(e) => setRace(p => ({ ...p, otherPacificIslanderText: e.target.value }))}
                    data-testid="input-race-other-pacific-text"
                  />
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="race-white"
                checked={race.white}
                onCheckedChange={(c) => setRace(p => ({ ...p, white: !!c, notProvided: false }))}
                data-testid="checkbox-race-white"
              />
              <Label htmlFor="race-white">White</Label>
            </div>

            <Separator />

            <div className="flex items-center gap-2">
              <Checkbox
                id="race-not-provided"
                checked={race.notProvided}
                onCheckedChange={(c) => setRace(p => ({
                  ...p,
                  notProvided: !!c,
                  americanIndian: !!c ? false : p.americanIndian,
                  asian: !!c ? false : p.asian,
                  black: !!c ? false : p.black,
                  nativeHawaiian: !!c ? false : p.nativeHawaiian,
                  white: !!c ? false : p.white,
                  asianIndian: !!c ? false : p.asianIndian,
                  chinese: !!c ? false : p.chinese,
                  filipino: !!c ? false : p.filipino,
                  japanese: !!c ? false : p.japanese,
                  korean: !!c ? false : p.korean,
                  vietnamese: !!c ? false : p.vietnamese,
                  otherAsian: !!c ? false : p.otherAsian,
                  guamanian: !!c ? false : p.guamanian,
                  samoan: !!c ? false : p.samoan,
                  otherPacificIslander: !!c ? false : p.otherPacificIslander,
                }))}
                data-testid="checkbox-race-not-provided"
              />
              <Label htmlFor="race-not-provided" className="text-muted-foreground">
                I do not wish to provide this information
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Sex
          </CardTitle>
          <CardDescription>Select one option</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="sex-female"
              checked={sex.female}
              onCheckedChange={(c) => setSex({ female: !!c, male: false, notProvided: false })}
              data-testid="checkbox-sex-female"
            />
            <Label htmlFor="sex-female">Female</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="sex-male"
              checked={sex.male}
              onCheckedChange={(c) => setSex({ female: false, male: !!c, notProvided: false })}
              data-testid="checkbox-sex-male"
            />
            <Label htmlFor="sex-male">Male</Label>
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            <Checkbox
              id="sex-not-provided"
              checked={sex.notProvided}
              onCheckedChange={(c) => setSex({ female: false, male: false, notProvided: !!c })}
              data-testid="checkbox-sex-not-provided"
            />
            <Label htmlFor="sex-not-provided" className="text-muted-foreground">
              I do not wish to provide this information
            </Label>
          </div>
        </CardContent>
      </Card>

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
              onChange={(e) => { setAge(e.target.value); setAgeNotProvided(false); }}
              disabled={ageNotProvided}
              data-testid="input-age"
            />
            <span className="text-sm text-muted-foreground">years old</span>
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            <Checkbox
              id="age-not-provided"
              checked={ageNotProvided}
              onCheckedChange={(c) => { setAgeNotProvided(!!c); if (c) setAge(""); }}
              data-testid="checkbox-age-not-provided"
            />
            <Label htmlFor="age-not-provided" className="text-muted-foreground">
              I do not wish to provide this information
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span>This information is collected for federal compliance purposes only and will not affect your loan application.</span>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="gap-2"
          data-testid="button-save-hmda"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save Information"}
        </Button>
      </div>
    </div>
  );
}
