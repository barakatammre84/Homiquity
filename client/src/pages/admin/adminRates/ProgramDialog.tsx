import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MortgageRateProgram, ProgramFormData } from "./types";

export function ProgramDialog({
  program,
  onSave,
  isPending,
}: {
  program: MortgageRateProgram | null;
  onSave: (data: ProgramFormData) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    name: program?.name || "",
    slug: program?.slug || "",
    description: program?.description || "",
    termYears: program?.termYears?.toString() || "",
    isAdjustable: program?.isAdjustable || false,
    adjustmentPeriod: program?.adjustmentPeriod || "",
    loanType: program?.loanType || "conventional",
    displayOrder: program?.displayOrder?.toString() || "0",
    isActive: program?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      termYears: formData.termYears ? parseInt(formData.termYears) : null,
      displayOrder: parseInt(formData.displayOrder),
      adjustmentPeriod: formData.adjustmentPeriod || null,
      description: formData.description || null,
    });
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{program ? "Edit Program" : "Add New Program"}</DialogTitle>
        <DialogDescription>
          {program ? "Update the program details" : "Create a new rate program type"}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="30-yr fixed"
            required
            data-testid="input-program-name"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="termYears">Term (years)</Label>
            <Input
              id="termYears"
              type="number"
              value={formData.termYears}
              onChange={(e) => setFormData({ ...formData, termYears: e.target.value })}
              placeholder="30"
              data-testid="input-term-years"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loanType">Loan Type</Label>
            <Select
              value={formData.loanType}
              onValueChange={(value) => setFormData({ ...formData, loanType: value })}
            >
              <SelectTrigger data-testid="select-loan-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conventional">Conventional</SelectItem>
                <SelectItem value="fha">FHA</SelectItem>
                <SelectItem value="va">VA</SelectItem>
                <SelectItem value="usda">USDA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="isAdjustable">Adjustable Rate (ARM)</Label>
          <Switch
            id="isAdjustable"
            checked={formData.isAdjustable}
            onCheckedChange={(checked) => setFormData({ ...formData, isAdjustable: checked })}
            data-testid="switch-adjustable"
          />
        </div>

        {formData.isAdjustable && (
          <div className="space-y-2">
            <Label htmlFor="adjustmentPeriod">Adjustment Period</Label>
            <Input
              id="adjustmentPeriod"
              value={formData.adjustmentPeriod}
              onChange={(e) => setFormData({ ...formData, adjustmentPeriod: e.target.value })}
              placeholder="6m"
              data-testid="input-adjustment-period"
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="programIsActive">Active</Label>
          <Switch
            id="programIsActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            data-testid="switch-program-active"
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isPending || !formData.name} data-testid="button-save-program">
            {isPending ? "Saving..." : program ? "Update Program" : "Create Program"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
