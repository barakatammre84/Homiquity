import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/AddressInput";
import {
  Briefcase,
  Check,
  Clock,
  DollarSign,
  Home,
  Plus,
  Shield,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import type { RentalPropertyEntry, IncomeSourceEntry, PreApprovalFormData } from "@shared/schema";
import { maskCurrencyDigits } from "@/lib/formatters";

/**
 * Complex-income step (extracted from PreApproval.tsx). CONTROLLED on purpose:
 * the three UI stores (selected types, per-type details, rental rows) live in
 * the parent because the draft-restore path (`applyIncomeSources` in
 * useDraftRestore's wiring) reseeds them — owning them here would render the
 * step empty after a restore. Every mutation rebuilds form.incomeSources via
 * `setIncomeSources` so the machine's gate always validates current entries;
 * rental annualAmount is derived (Σ monthly rents × 12), never typed.
 */
export function IncomeSourcesStep({
  employmentType,
  selectedIncomeTypes,
  incomeDetails,
  rentalProperties,
  setSelectedIncomeTypes,
  setIncomeDetails,
  setRentalProperties,
  setIncomeSources,
}: {
  employmentType: PreApprovalFormData["employmentType"] | undefined;
  selectedIncomeTypes: string[];
  incomeDetails: Record<string, { annualAmount: string; employerName: string; yearsInRole: string }>;
  rentalProperties: RentalPropertyEntry[];
  setSelectedIncomeTypes: (types: string[]) => void;
  setIncomeDetails: (details: Record<string, { annualAmount: string; employerName: string; yearsInRole: string }>) => void;
  setRentalProperties: (props: RentalPropertyEntry[]) => void;
  setIncomeSources: (entries: IncomeSourceEntry[]) => void;
}) {
  const employmentTypeMap: Record<string, string> = { employed: "w2", self_employed: "self_employed", retired: "pension" };
  // Self-employed borrowers keep their primary type in the list — the
  // complex-income block exists precisely to detail 1099/business income.
  const rawPrimaryType = employmentTypeMap[employmentType || ""] || "";
  const primaryType = rawPrimaryType === "self_employed" ? "" : rawPrimaryType;
  const allIncomeTypes = [
    { value: "w2", label: "W-2 Employment", icon: Briefcase },
    { value: "self_employed", label: "Self-Employment / 1099", icon: Users },
    { value: "rental", label: "Rental Income", icon: Home },
    { value: "social_security", label: "Social Security", icon: Shield },
    { value: "pension", label: "Pension / Retirement", icon: Clock },
    { value: "investment", label: "Investment Income", icon: TrendingUp },
    { value: "other", label: "Other Income", icon: DollarSign },
  ].filter((t) => t.value !== primaryType);

  const buildFormEntries = (types: string[], details: typeof incomeDetails, rentals: RentalPropertyEntry[]) => {
    return types.map((t) => {
      const d = details[t] || { annualAmount: "", employerName: "", yearsInRole: "" };
      const entry: IncomeSourceEntry & { rentalProperties?: RentalPropertyEntry[] } = {
        type: t as IncomeSourceEntry["type"],
        annualAmount: d.annualAmount || "",
        employerName: d.employerName || "",
        yearsInRole: d.yearsInRole || "",
      };
      if (t === "rental" && rentals.length > 0) {
        entry.rentalProperties = rentals;
        const totalMonthly = rentals.reduce((sum, p) => sum + (parseFloat(p.monthlyRentalIncome.replace(/,/g, "")) || 0), 0);
        entry.annualAmount = totalMonthly > 0 ? maskCurrencyDigits(String(Math.round(totalMonthly * 12))) : "";
      }
      return entry;
    });
  };

  const toggleIncomeType = (typeValue: string) => {
    const isSelected = selectedIncomeTypes.includes(typeValue);
    let newTypes: string[];
    if (isSelected) {
      newTypes = selectedIncomeTypes.filter((t) => t !== typeValue);
      const newDetails = { ...incomeDetails };
      delete newDetails[typeValue];
      setIncomeDetails(newDetails);
      if (typeValue === "rental") {
        setRentalProperties([]);
      }
    } else {
      newTypes = [...selectedIncomeTypes, typeValue];
      if (!incomeDetails[typeValue]) {
        setIncomeDetails({ ...incomeDetails, [typeValue]: { annualAmount: "", employerName: "", yearsInRole: "" } });
      }
      if (typeValue === "rental" && rentalProperties.length === 0) {
        setRentalProperties([{ address: "", monthlyRentalIncome: "", monthlyDebtPayment: "" }]);
      }
    }
    setSelectedIncomeTypes(newTypes);
    setIncomeSources(buildFormEntries(newTypes, isSelected ? incomeDetails : { ...incomeDetails, [typeValue]: incomeDetails[typeValue] || { annualAmount: "", employerName: "", yearsInRole: "" } }, typeValue === "rental" && isSelected ? [] : rentalProperties));
  };

  const updateDetail = (typeValue: string, field: string, value: string) => {
    const newDetails = {
      ...incomeDetails,
      [typeValue]: { ...incomeDetails[typeValue], [field]: value },
    };
    setIncomeDetails(newDetails);
    setIncomeSources(buildFormEntries(selectedIncomeTypes, newDetails, rentalProperties));
  };

  const addRentalProperty = () => {
    const updated = [...rentalProperties, { address: "", monthlyRentalIncome: "", monthlyDebtPayment: "" }];
    setRentalProperties(updated);
    setIncomeSources(buildFormEntries(selectedIncomeTypes, incomeDetails, updated));
  };

  const removeRentalProperty = (index: number) => {
    const updated = rentalProperties.filter((_, i) => i !== index);
    setRentalProperties(updated);
    setIncomeSources(buildFormEntries(selectedIncomeTypes, incomeDetails, updated));
  };

  const updateRentalProperty = (index: number, field: keyof RentalPropertyEntry, value: string) => {
    const updated = rentalProperties.map((p, i) => i === index ? { ...p, [field]: value } : p);
    setRentalProperties(updated);
    setIncomeSources(buildFormEntries(selectedIncomeTypes, incomeDetails, updated));
  };

  const needsEmployerDetails = (typeValue: string) => typeValue === "w2" || typeValue === "self_employed";

  const rentalAnnualTotal = rentalProperties.reduce((sum, p) => sum + (parseFloat(p.monthlyRentalIncome.replace(/,/g, "")) || 0), 0) * 12;

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {allIncomeTypes.map((incomeType) => {
          const TypeIcon = incomeType.icon;
          const isActive = selectedIncomeTypes.includes(incomeType.value);
          return (
            <button
              key={incomeType.value}
              type="button"
              data-testid={`toggle-income-${incomeType.value}`}
              onClick={() => toggleIncomeType(incomeType.value)}
              className={`flex items-center gap-3 p-4 text-left text-sm font-medium border-2 rounded-xl transition-all duration-200
                ${isActive
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-primary/50"
                }`}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors shrink-0
                ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <TypeIcon className="h-4 w-4" />
              </div>
              <span className={`flex-1 ${isActive ? "text-primary" : "text-foreground"}`}>
                {incomeType.label}
              </span>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0
                ${isActive ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                {isActive && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
            </button>
          );
        })}
      </div>

      {selectedIncomeTypes.length > 0 && (
        <div className="space-y-4">
          {selectedIncomeTypes.map((typeValue) => {
            const typeInfo = allIncomeTypes.find((t) => t.value === typeValue);
            const details = incomeDetails[typeValue] || { annualAmount: "", employerName: "", yearsInRole: "" };

            if (typeValue === "rental") {
              return (
                <div key={typeValue} className="border-2 rounded-xl p-5 space-y-4 text-left" data-testid="card-income-rental">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Home className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">Rental Properties</span>
                    {rentalAnnualTotal > 0 && (
                      <span className="text-sm text-muted-foreground ml-auto">
                        ${maskCurrencyDigits(String(Math.round(rentalAnnualTotal)))}/yr total
                      </span>
                    )}
                  </div>

                  {rentalProperties.map((prop, idx) => (
                    <div key={idx} className="border rounded-xl p-4 space-y-3 bg-muted/30" data-testid={`rental-property-${idx}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">Property {idx + 1}</span>
                        {rentalProperties.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon" aria-label="Delete"
                            data-testid={`button-remove-rental-${idx}`}
                            onClick={() => removeRentalProperty(idx)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Property Address</label>
                        <AddressInput
                          placeholder="Start typing a property address..."
                          defaultValue={prop.address}
                          onSelect={(result) => updateRentalProperty(idx, "address", result.formattedAddress)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm text-muted-foreground mb-1 block">Monthly Rental Income</label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              data-testid={`input-rental-income-${idx}`}
                              value={prop.monthlyRentalIncome}
                              onChange={(e) => updateRentalProperty(idx, "monthlyRentalIncome", maskCurrencyDigits(e.target.value))}
                              className="pl-9"
                              placeholder="2,000"
                              inputMode="decimal"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground mb-1 block">Monthly Debt Payment</label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              data-testid={`input-rental-debt-${idx}`}
                              value={prop.monthlyDebtPayment || ""}
                              onChange={(e) => updateRentalProperty(idx, "monthlyDebtPayment", maskCurrencyDigits(e.target.value))}
                              className="pl-9"
                              placeholder="1,200"
                              inputMode="decimal"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    data-testid="button-add-rental-property"
                    onClick={addRentalProperty}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Property
                  </Button>
                </div>
              );
            }

            return (
              <div key={typeValue} className="border-2 rounded-xl p-5 space-y-4 text-left" data-testid={`card-income-${typeValue}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  {typeInfo && <typeInfo.icon className="h-4 w-4 text-primary" />}
                  <span className="font-semibold text-foreground">{typeInfo?.label}</span>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Annual Amount</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      data-testid={`input-income-amount-${typeValue}`}
                      value={details.annualAmount}
                      onChange={(e) => updateDetail(typeValue, "annualAmount", maskCurrencyDigits(e.target.value))}
                      className="pl-9"
                      placeholder="75,000"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">
                    {needsEmployerDetails(typeValue) ? "Employer Name" : "Source"}
                  </label>
                  <Input
                    data-testid={`input-income-employer-${typeValue}`}
                    value={details.employerName}
                    onChange={(e) => updateDetail(typeValue, "employerName", e.target.value)}
                    placeholder={needsEmployerDetails(typeValue) ? "Company name" : "Source name (optional)"}
                  />
                </div>
                {needsEmployerDetails(typeValue) && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Years in Role</label>
                    <Input
                      data-testid={`input-income-years-${typeValue}`}
                      value={details.yearsInRole}
                      onChange={(e) => updateDetail(typeValue, "yearsInRole", e.target.value.replace(/\D/g, ""))}
                      placeholder="3"
                      inputMode="numeric"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
