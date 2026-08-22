// TRID change-of-circumstance rule builder.
// Extracted verbatim from PolicyOps.tsx.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Edit, Info } from "lucide-react";

export function COCRuleBuilder() {
  const [triggerType, setTriggerType] = useState("");
  const [triggerValue, setTriggerValue] = useState("");
  const [severity, setSeverity] = useState("REVIEW");
  const [appliesTo, setAppliesTo] = useState<string[]>(["FANNIE", "FREDDIE"]);
  const { toast } = useToast();

  const handleAddRule = () => {
    toast({
      title: "COC Rule Added",
      description: "Rule added to draft. Publish policy to activate.",
    });
  };

  return (
    <div className="space-y-8">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Change-of-Circumstance Rules</AlertTitle>
        <AlertDescription>
          Define what changes invalidate a pre-approval. Rules are evaluated for every monitoring event.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Label className="text-base">Trigger Event</Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="trigger"
                value="credit_drop"
                checked={triggerType === "credit_drop"}
                onChange={(e) => setTriggerType(e.target.value)}
                className="h-4 w-4"
                data-testid="radio-trigger-credit-drop"
              />
              <Label className="flex items-center gap-2">
                Credit Score Drop ≥
                <Input
                  type="number"
                  className="w-20"
                  placeholder="20"
                  value={triggerType === "credit_drop" ? triggerValue : ""}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  disabled={triggerType !== "credit_drop"}
                  data-testid="input-credit-drop"
                />
                pts
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="trigger"
                value="new_tradeline"
                checked={triggerType === "new_tradeline"}
                onChange={(e) => setTriggerType(e.target.value)}
                className="h-4 w-4"
                data-testid="radio-trigger-new-tradeline"
              />
              <Label>New Tradeline Detected</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="trigger"
                value="income_change"
                checked={triggerType === "income_change"}
                onChange={(e) => setTriggerType(e.target.value)}
                className="h-4 w-4"
                data-testid="radio-trigger-income-change"
              />
              <Label className="flex items-center gap-2">
                Income Change ≥
                <Input
                  type="number"
                  className="w-20"
                  placeholder="10"
                  value={triggerType === "income_change" ? triggerValue : ""}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  disabled={triggerType !== "income_change"}
                  data-testid="input-income-change"
                />
                %
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="trigger"
                value="asset_decrease"
                checked={triggerType === "asset_decrease"}
                onChange={(e) => setTriggerType(e.target.value)}
                className="h-4 w-4"
                data-testid="radio-trigger-asset-decrease"
              />
              <Label className="flex items-center gap-2">
                Asset Decrease ≥
                <Input
                  type="number"
                  className="w-20"
                  placeholder="10"
                  value={triggerType === "asset_decrease" ? triggerValue : ""}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  disabled={triggerType !== "asset_decrease"}
                  data-testid="input-asset-decrease"
                />
                %
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="trigger"
                value="employment_change"
                checked={triggerType === "employment_change"}
                onChange={(e) => setTriggerType(e.target.value)}
                className="h-4 w-4"
                data-testid="radio-trigger-employment-change"
              />
              <Label>Employment Change</Label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger data-testid="select-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INFO">Informational</SelectItem>
                <SelectItem value="REVIEW">Re-verification Required</SelectItem>
                <SelectItem value="INVALIDATE">Pre-Approval Invalidation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <Label className="text-base">Applies To</Label>
            <div className="grid grid-cols-2 gap-2">
              {["FANNIE", "FREDDIE", "FHA", "VA"].map((gse) => (
                <div key={gse} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={appliesTo.includes(gse)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAppliesTo([...appliesTo, gse]);
                      } else {
                        setAppliesTo(appliesTo.filter((g) => g !== gse));
                      }
                    }}
                    className="h-4 w-4"
                    data-testid={`checkbox-gse-${gse.toLowerCase()}`}
                  />
                  <Label>{gse}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button onClick={handleAddRule} disabled={!triggerType} data-testid="button-add-coc-rule">
          Add COC Rule
        </Button>
      </div>

      <Separator />

      <div className="space-y-4">
        <Label className="text-base">Existing COC Rules</Label>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trigger</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Credit Score Drop ≥ 20pts</TableCell>
              <TableCell><Badge variant="destructive">Invalidate</Badge></TableCell>
              <TableCell>FANNIE, FREDDIE</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" className="touch-target">
                  <Edit className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Income Change ≥ 10%</TableCell>
              <TableCell><Badge variant="outline">Re-verify</Badge></TableCell>
              <TableCell>FANNIE, FREDDIE, FHA</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" className="touch-target">
                  <Edit className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>New Tradeline Detected</TableCell>
              <TableCell><Badge variant="outline">Re-verify</Badge></TableCell>
              <TableCell>All</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" className="touch-target">
                  <Edit className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

