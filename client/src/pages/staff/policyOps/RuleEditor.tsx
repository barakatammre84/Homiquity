// The per-category rule editor.
// Extracted verbatim from PolicyOps.tsx.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings } from "lucide-react";
import { type RuleCategory } from "./model";
import { COCRuleBuilder } from "./COCRuleBuilder";

export function RuleEditor({ category }: { category: RuleCategory }) {
  const [dtiMax, setDtiMax] = useState([43]);
  const [creditScoreMin, setCreditScoreMin] = useState([620]);
  const [ltvMax, setLtvMax] = useState([97]);
  const [reservesMin, setReservesMin] = useState("2");
  const [scheduleERequired, setScheduleERequired] = useState(true);
  const [vacancyFactor, setVacancyFactor] = useState("25");
  const [allowLossOffset, setAllowLossOffset] = useState(false);
  const [incomeHistory, setIncomeHistory] = useState("2");
  const [primaryOccupancy, setPrimaryOccupancy] = useState(true);
  const [secondHomeOccupancy, setSecondHomeOccupancy] = useState(true);
  const [investmentOccupancy, setInvestmentOccupancy] = useState(true);
  const [strongCreditCompensating, setStrongCreditCompensating] = useState(false);
  const [reservesCompensating, setReservesCompensating] = useState(false);
  const [preApprovalValidity, setPreApprovalValidity] = useState("90");
  const [autoExpireOnCOC, setAutoExpireOnCOC] = useState(true);
  const [creditRepullRequired, setCreditRepullRequired] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState("B");
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "Draft Saved",
      description: "Changes saved to draft. Publish when ready.",
    });
  };

  if (category === "DTI") {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base">Max Back-End DTI</Label>
            <span className="text-2xl font-bold">{dtiMax[0]}%</span>
          </div>
          <Slider
            value={dtiMax}
            onValueChange={setDtiMax}
            min={36}
            max={50}
            step={1}
            data-testid="slider-dti-max"
          />
          <p className="text-sm text-muted-foreground">
            GSE limit: 36% - 50%. Higher DTI requires compensating factors.
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-base">Loan Type Eligibility</Label>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center space-x-2">
              <Switch
                checked={primaryOccupancy}
                onCheckedChange={setPrimaryOccupancy}
                data-testid="switch-primary"
              />
              <Label>Primary Residence</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={secondHomeOccupancy}
                onCheckedChange={setSecondHomeOccupancy}
                data-testid="switch-second-home"
              />
              <Label>Second Home</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={investmentOccupancy}
                onCheckedChange={setInvestmentOccupancy}
                data-testid="switch-investment"
              />
              <Label>Investment Property</Label>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-base">Compensating Factors</Label>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Reserves ≥ 6 months</p>
                <p className="text-sm text-muted-foreground">
                  Allows DTI up to {dtiMax[0] + 2}% if enabled
                </p>
              </div>
              <Switch
                checked={reservesCompensating}
                onCheckedChange={setReservesCompensating}
                data-testid="switch-reserves-compensating"
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Credit Score 720+</p>
                <p className="text-sm text-muted-foreground">
                  Allows DTI up to {dtiMax[0] + 2}% if enabled
                </p>
              </div>
              <Switch
                checked={strongCreditCompensating}
                onCheckedChange={setStrongCreditCompensating}
                data-testid="switch-credit-compensating"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" data-testid="button-discard-changes">
            Discard Changes
          </Button>
          <Button onClick={handleSave} data-testid="button-save-draft">
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>
    );
  }

  if (category === "INCOME") {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <Label className="text-base">Rental Income (Schedule E)</Label>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <Label>Schedule E Required</Label>
              <Switch
                checked={scheduleERequired}
                onCheckedChange={setScheduleERequired}
                data-testid="switch-schedule-e"
              />
            </div>
            <div className="space-y-2">
              <Label>Vacancy Factor</Label>
              <Select value={vacancyFactor} onValueChange={setVacancyFactor}>
                <SelectTrigger data-testid="select-vacancy-factor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25% (Standard)</SelectItem>
                  <SelectItem value="15">15% (Conservative)</SelectItem>
                  <SelectItem value="0">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Allow Loss Offset</Label>
                <p className="text-sm text-muted-foreground">Offset rental losses against income</p>
              </div>
              <Switch
                checked={allowLossOffset}
                onCheckedChange={setAllowLossOffset}
                data-testid="switch-loss-offset"
              />
            </div>
            <div className="space-y-2">
              <Label>Min History Required</Label>
              <Select value={incomeHistory} onValueChange={setIncomeHistory}>
                <SelectTrigger data-testid="select-income-history">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Year</SelectItem>
                  <SelectItem value="2">2 Years (Standard)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" data-testid="button-discard-changes">
            Discard Changes
          </Button>
          <Button onClick={handleSave} data-testid="button-save-draft">
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>
    );
  }

  if (category === "CREDIT") {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base">Minimum Credit Score</Label>
            <span className="text-2xl font-bold">{creditScoreMin[0]}</span>
          </div>
          <Slider
            value={creditScoreMin}
            onValueChange={setCreditScoreMin}
            min={580}
            max={720}
            step={10}
            data-testid="slider-credit-min"
          />
          <p className="text-sm text-muted-foreground">
            GSE minimum: 620 for conventional. FHA allows 580 with restrictions.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline">Discard Changes</Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>
    );
  }

  if (category === "PRE_APPROVAL") {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <Label className="text-base">Pre-Approval Validity Period</Label>
          <Select value={preApprovalValidity} onValueChange={setPreApprovalValidity}>
            <SelectTrigger className="w-48" data-testid="select-validity-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="60">60 Days</SelectItem>
              <SelectItem value="90">90 Days (Standard)</SelectItem>
              <SelectItem value="120">120 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-base">Expiration Controls</Label>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Auto-Expire on COC</p>
                <p className="text-sm text-muted-foreground">
                  Automatically expire when material change detected
                </p>
              </div>
              <Switch
                checked={autoExpireOnCOC}
                onCheckedChange={setAutoExpireOnCOC}
                data-testid="switch-auto-expire"
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Require Credit Re-Pull</p>
                <p className="text-sm text-muted-foreground">
                  Require new credit pull before extending validity
                </p>
              </div>
              <Switch
                checked={creditRepullRequired}
                onCheckedChange={setCreditRepullRequired}
                data-testid="switch-credit-repull"
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-base">Confidence Threshold Required</Label>
          <Select value={confidenceThreshold} onValueChange={setConfidenceThreshold}>
            <SelectTrigger className="w-48" data-testid="select-confidence-threshold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">A - Strong (85%+)</SelectItem>
              <SelectItem value="B">B - Solid (70%+)</SelectItem>
              <SelectItem value="C">C - Fragile (50%+)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Minimum confidence score to issue pre-approval letter
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline">Discard Changes</Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>
    );
  }

  if (category === "COC") {
    return <COCRuleBuilder />;
  }

  return (
    <div className="py-12 text-center">
      <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <p className="text-muted-foreground">
        {category} rules coming soon. Select DTI, Income, Credit, Pre-Approval, or COC to configure.
      </p>
    </div>
  );
}

