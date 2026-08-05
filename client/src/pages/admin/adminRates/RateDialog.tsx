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
import type { MortgageRate, MortgageRateProgram, RateFormData } from "./types";

export function RateDialog({
  rate,
  programs,
  onSave,
  isPending,
}: {
  rate: MortgageRate | null;
  programs: MortgageRateProgram[];
  onSave: (data: RateFormData) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    programId: rate?.programId || "",
    state: rate?.state || "",
    zipcode: rate?.zipcode || "",
    rate: rate?.rate || "",
    apr: rate?.apr || "",
    points: rate?.points || "0",
    pointsCost: rate?.pointsCost || "0",
    loanAmount: rate?.loanAmount || "160000",
    downPaymentPercent: rate?.downPaymentPercent?.toString() || "20",
    creditScoreMin: rate?.creditScoreMin?.toString() || "760",
    isActive: rate?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      state: formData.state || null,
      zipcode: formData.zipcode || null,
      downPaymentPercent: parseInt(formData.downPaymentPercent),
      creditScoreMin: parseInt(formData.creditScoreMin),
    });
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{rate ? "Edit Rate" : "Add New Rate"}</DialogTitle>
        <DialogDescription>
          {rate ? "Update the mortgage rate details" : "Create a new mortgage rate entry"}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="programId">Program</Label>
          <Select
            value={formData.programId}
            onValueChange={(value) => setFormData({ ...formData, programId: value })}
          >
            <SelectTrigger data-testid="select-program">
              <SelectValue placeholder="Select program" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((program) => (
                <SelectItem key={program.id} value={program.id}>
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="state">State (optional)</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase().slice(0, 2) })}
              placeholder="CA"
              maxLength={2}
              data-testid="input-state"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zipcode">Zipcode (optional)</Label>
            <Input
              id="zipcode"
              value={formData.zipcode}
              onChange={(e) => setFormData({ ...formData, zipcode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
              placeholder="95833"
              maxLength={5}
              data-testid="input-zipcode"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rate">Rate (%)</Label>
            <Input
              id="rate"
              type="number"
              step="0.001"
              value={formData.rate}
              onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              placeholder="5.750"
              required
              data-testid="input-rate"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apr">APR (%)</Label>
            <Input
              id="apr"
              type="number"
              step="0.001"
              value={formData.apr}
              onChange={(e) => setFormData({ ...formData, apr: e.target.value })}
              placeholder="5.957"
              required
              data-testid="input-apr"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="points">Points</Label>
            <Input
              id="points"
              type="number"
              step="0.01"
              value={formData.points}
              onChange={(e) => setFormData({ ...formData, points: e.target.value })}
              placeholder="2.21"
              data-testid="input-points"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pointsCost">Points Cost ($)</Label>
            <Input
              id="pointsCost"
              type="number"
              step="1"
              value={formData.pointsCost}
              onChange={(e) => setFormData({ ...formData, pointsCost: e.target.value })}
              placeholder="3542"
              data-testid="input-points-cost"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="isActive">Active</Label>
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            data-testid="switch-active"
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isPending || !formData.programId} data-testid="button-save-rate">
            {isPending ? "Saving..." : rate ? "Update Rate" : "Create Rate"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
