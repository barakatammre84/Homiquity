import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { SelfEmploymentWorksheet, SelfEmploymentBusinessStructure } from "@shared/schema";
import { MoneyInput } from "./MoneyInput";

/** Draft shape returned by the P5 smart-fill endpoint (values only; provenance shown as hints). */
interface SeWorksheetDraft {
  entity: { identityKey: string; name: string | null; entityType: string; einLast4: string | null };
  worksheet: SelfEmploymentWorksheet;
  warnings: string[];
}

/**
 * Self-employment income worksheet — Fannie Mae Form 1084 / Selling Guide
 * B3-3.5 & B3-3.6. Pure capture: the qualifying-income math is computed
 * deterministically server-side (server/services/selfEmploymentIncome.ts), so
 * this component never shows a computed qualifying figure. See
 * docs/fannie-mae/self-employment-income-reference.md.
 */

interface Props {
  value: SelfEmploymentWorksheet | null | undefined;
  onChange: (next: SelfEmploymentWorksheet | null) => void;
  index: number;
}

const STRUCTURE_LABELS: Record<SelfEmploymentBusinessStructure, string> = {
  sole_proprietorship: "Sole proprietorship (Schedule C)",
  single_member_llc: "Single-member LLC (Schedule C)",
  partnership: "Partnership (Form 1065 / K-1)",
  s_corporation: "S corporation (Form 1120-S / K-1)",
  c_corporation: "C corporation (Form 1120)",
};

const isScheduleC = (s?: SelfEmploymentBusinessStructure) =>
  s === "sole_proprietorship" || s === "single_member_llc";
const isK1 = (s?: SelfEmploymentBusinessStructure) =>
  s === "partnership" || s === "s_corporation";

const emptyScheduleCYear = () => ({
  netProfitOrLoss: 0,
  depreciation: 0,
  depletion: 0,
  amortizationOrCasualtyLoss: 0,
  businessUseOfHome: 0,
  mealsExclusion: 0,
  nonRecurringIncome: 0,
});
const emptyK1Year = () => ({
  ordinaryBusinessIncome: 0,
  netRentalRealEstateIncome: 0,
  otherNetRentalIncome: 0,
  guaranteedPayments: 0,
  distributionsReceived: 0,
});

/** Parse a money-field string to a number; blank clears to 0. */
function toNum(raw: string): number {
  const cleaned = raw.replace(/[,$\s]/g, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function SelfEmploymentIncomeWorksheet({ value, onChange, index }: Props) {
  const structure = value?.businessStructure;
  const [drafts, setDrafts] = useState<SeWorksheetDraft[] | null>(null);
  const [draftState, setDraftState] = useState<"idle" | "loading" | "applied" | "none" | "error">("idle");
  const [appliedWarnings, setAppliedWarnings] = useState<string[]>([]);

  // P5 smart-fill: fetch DRAFTS built from the borrower's own processed tax
  // documents. Nothing persists until the borrower reviews and saves — this
  // only populates the form via onChange.
  const loadDrafts = async () => {
    setDraftState("loading");
    try {
      const res = await apiRequest("GET", "/api/tax-intelligence/se-worksheet-drafts");
      const body = (await res.json()) as { drafts: SeWorksheetDraft[] };
      if (!body.drafts.length) {
        setDraftState("none");
        return;
      }
      setDrafts(body.drafts);
      if (body.drafts.length === 1) applyDraft(body.drafts[0]);
      else setDraftState("idle");
    } catch {
      setDraftState("error");
    }
  };

  const applyDraft = (draft: SeWorksheetDraft) => {
    onChange({ ...draft.worksheet, confirmedByBorrowerAt: undefined });
    setAppliedWarnings(draft.warnings);
    setDraftState("applied");
  };

  const setStructure = (s: SelfEmploymentBusinessStructure) => {
    // Switching families clears the other sub-object (superRefine forbids both).
    const next: SelfEmploymentWorksheet = {
      version: 1,
      businessStructure: s,
      ownershipPercent: value?.ownershipPercent,
      yearsSelfEmployed: value?.yearsSelfEmployed,
    };
    if (isScheduleC(s)) {
      next.scheduleC = value?.scheduleC ?? { currentYear: emptyScheduleCYear() };
    } else if (isK1(s)) {
      next.k1 = value?.k1 ?? {
        currentYear: emptyK1Year(),
        hasTwoYearGuaranteedPayments: false,
        w2FromBusiness: 0,
      };
    }
    onChange(next);
  };

  const patch = (p: Partial<SelfEmploymentWorksheet>) => {
    if (!value) return;
    onChange({ ...value, ...p });
  };

  const tid = (name: string) => `input-se-${name}-${index}`;

  // A labeled money field bound to a nested numeric path.
  const money = (label: string, current: number | undefined, set: (n: number) => void, name: string, hint?: string) => (
    <div className="space-y-2">
      <Label htmlFor={tid(name)}>{label}</Label>
      <MoneyInput
        id={tid(name)}
        value={current === undefined || current === 0 ? "" : String(current)}
        onChange={(e) => set(toNum(e.target.value))}
        data-testid={tid(name)}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );

  const scheduleCYear = (
    yearKey: "currentYear" | "priorYear",
    title: string,
  ) => {
    const yr = value?.scheduleC?.[yearKey];
    const setField = (field: string, n: number) => {
      if (!value) return;
      const base = value.scheduleC?.[yearKey] ?? emptyScheduleCYear();
      onChange({
        ...value,
        scheduleC: {
          currentYear: value.scheduleC?.currentYear ?? emptyScheduleCYear(),
          ...value.scheduleC,
          [yearKey]: { ...base, [field]: n },
        },
      });
    };
    return (
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h6 className="text-sm font-semibold">{title}</h6>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {money("Net profit or loss", yr?.netProfitOrLoss, (n) => setField("netProfitOrLoss", n), `sc-${yearKey}-netprofit`, "Schedule C net profit/loss")}
          {money("Depreciation", yr?.depreciation, (n) => setField("depreciation", n), `sc-${yearKey}-depreciation`, "Added back")}
          {money("Depletion", yr?.depletion, (n) => setField("depletion", n), `sc-${yearKey}-depletion`, "Added back")}
          {money("Amortization / casualty loss", yr?.amortizationOrCasualtyLoss, (n) => setField("amortizationOrCasualtyLoss", n), `sc-${yearKey}-amort`, "Added back")}
          {money("Business use of home", yr?.businessUseOfHome, (n) => setField("businessUseOfHome", n), `sc-${yearKey}-boh`, "Added back")}
          {money("Meals / entertainment exclusion", yr?.mealsExclusion, (n) => setField("mealsExclusion", n), `sc-${yearKey}-meals`, "Subtracted")}
          {money("Other non-recurring income", yr?.nonRecurringIncome, (n) => setField("nonRecurringIncome", n), `sc-${yearKey}-nonrecurring`, "Subtracted")}
        </div>
      </div>
    );
  };

  const k1Year = (yearKey: "currentYear" | "priorYear", title: string) => {
    const yr = value?.k1?.[yearKey];
    const setField = (field: string, n: number) => {
      if (!value) return;
      const base = value.k1?.[yearKey] ?? emptyK1Year();
      onChange({
        ...value,
        k1: {
          currentYear: value.k1?.currentYear ?? emptyK1Year(),
          hasTwoYearGuaranteedPayments: value.k1?.hasTwoYearGuaranteedPayments ?? false,
          w2FromBusiness: value.k1?.w2FromBusiness ?? 0,
          ...value.k1,
          [yearKey]: { ...base, [field]: n },
        },
      });
    };
    return (
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h6 className="text-sm font-semibold">{title}</h6>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {money("Ordinary business income", yr?.ordinaryBusinessIncome, (n) => setField("ordinaryBusinessIncome", n), `k1-${yearKey}-ordinary`)}
          {money("Net rental real-estate income", yr?.netRentalRealEstateIncome, (n) => setField("netRentalRealEstateIncome", n), `k1-${yearKey}-netrental`)}
          {money("Other net rental income", yr?.otherNetRentalIncome, (n) => setField("otherNetRentalIncome", n), `k1-${yearKey}-otherrental`)}
          {money("Guaranteed payments", yr?.guaranteedPayments, (n) => setField("guaranteedPayments", n), `k1-${yearKey}-guaranteed`)}
          {money("Cash distributions received", yr?.distributionsReceived, (n) => setField("distributionsReceived", n), `k1-${yearKey}-distributions`)}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4" data-testid={`se-worksheet-${index}`}>
      <div className="space-y-1">
        <h5 className="font-medium">Self-employment income details</h5>
        <p className="text-xs text-muted-foreground">
          From your business tax returns. We use Fannie Mae's cash-flow analysis to turn these into
          qualifying income — your loan officer confirms the figures against your returns.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={loadDrafts}
            disabled={draftState === "loading"}
            data-testid={`button-se-prefill-${index}`}
          >
            <Sparkles className="mr-1 h-4 w-4" aria-hidden="true" />
            {draftState === "loading" ? "Reading your tax documents…" : "Prefill from my tax documents"}
          </Button>
          {drafts && drafts.length > 1 &&
            drafts.map((d) => (
              <Button
                key={d.entity.identityKey}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => applyDraft(d)}
                data-testid={`button-se-draft-${d.entity.identityKey}`}
              >
                {d.entity.name ?? d.entity.identityKey}
              </Button>
            ))}
        </div>
        {draftState === "none" && (
          <p className="text-xs text-muted-foreground" data-testid={`text-se-prefill-none-${index}`}>
            No processed tax documents yet — upload and process a tax return first, or enter the figures manually.
          </p>
        )}
        {draftState === "error" && (
          <p className="text-xs text-muted-foreground" role="alert">
            Couldn't load a draft (you may need to accept the tax document authorization first). Enter the figures manually.
          </p>
        )}
        {draftState === "applied" && (
          <Alert data-testid={`alert-se-prefill-applied-${index}`}>
            <Info className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="space-y-2">
              <p>
                Draft filled from your tax documents. <strong>Review every figure against your
                return</strong> — fields we couldn't read are 0 and need your number.
              </p>
              {appliedWarnings.length > 0 && (
                <ul className="list-disc pl-4 text-xs">
                  {appliedWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id={tid("confirm-draft")}
                  checked={!!value?.confirmedByBorrowerAt}
                  onCheckedChange={(checked) =>
                    patch({ confirmedByBorrowerAt: checked ? new Date().toISOString() : undefined })
                  }
                  data-testid={tid("confirm-draft")}
                />
                <Label htmlFor={tid("confirm-draft")} className="text-xs font-normal">
                  I reviewed these figures against my tax return and confirm they're correct
                </Label>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={tid("structure")}>Business structure</Label>
          <Select value={structure ?? ""} onValueChange={(v) => setStructure(v as SelfEmploymentBusinessStructure)}>
            <SelectTrigger id={tid("structure")} data-testid={tid("structure")}>
              <SelectValue placeholder="Select structure" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STRUCTURE_LABELS) as SelfEmploymentBusinessStructure[]).map((s) => (
                <SelectItem key={s} value={s}>{STRUCTURE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={tid("ownership")}>Ownership %</Label>
          <input
            id={tid("ownership")}
            type="number"
            min={0}
            max={100}
            inputMode="decimal"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={value?.ownershipPercent ?? ""}
            onChange={(e) => patch({ ownershipPercent: e.target.value === "" ? undefined : Number(e.target.value) })}
            data-testid={tid("ownership")}
          />
          <p className="text-xs text-muted-foreground">25% or more counts as self-employed</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={tid("years")}>Years self-employed</Label>
          <input
            id={tid("years")}
            type="number"
            min={0}
            max={80}
            inputMode="decimal"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={value?.yearsSelfEmployed ?? ""}
            onChange={(e) => patch({ yearsSelfEmployed: e.target.value === "" ? undefined : Number(e.target.value) })}
            data-testid={tid("years")}
          />
        </div>
      </div>

      {isScheduleC(structure) && (
        <div className="space-y-4">
          {scheduleCYear("currentYear", "Most recent tax year")}
          {scheduleCYear("priorYear", "Prior tax year (for two-year averaging)")}
        </div>
      )}

      {isK1(structure) && (
        <div className="space-y-4">
          {k1Year("currentYear", "Most recent tax year")}
          {k1Year("priorYear", "Prior tax year (for two-year averaging)")}
          <div className="rounded-lg border border-border p-4 space-y-4">
            <h6 className="text-sm font-semibold">Access to business income</h6>
            <div className="flex items-center gap-2">
              <Checkbox
                id={tid("guaranteed-2yr")}
                checked={value?.k1?.hasTwoYearGuaranteedPayments ?? false}
                onCheckedChange={(checked) =>
                  patch({
                    k1: {
                      currentYear: value?.k1?.currentYear ?? emptyK1Year(),
                      w2FromBusiness: value?.k1?.w2FromBusiness ?? 0,
                      ...value?.k1,
                      hasTwoYearGuaranteedPayments: !!checked,
                    },
                  })
                }
                data-testid={tid("guaranteed-2yr")}
              />
              <Label htmlFor={tid("guaranteed-2yr")} className="font-normal">
                Guaranteed payments received for 2+ years
              </Label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {money("W-2 wages from this business", value?.k1?.w2FromBusiness, (n) =>
                patch({
                  k1: {
                    currentYear: value?.k1?.currentYear ?? emptyK1Year(),
                    hasTwoYearGuaranteedPayments: value?.k1?.hasTwoYearGuaranteedPayments ?? false,
                    ...value?.k1,
                    w2FromBusiness: n,
                  },
                }), "k1-w2", "If you draw a W-2 from your own S-corp")}
              {money("Current assets", value?.k1?.liquidity?.currentAssets, (n) =>
                patch({
                  k1: {
                    currentYear: value?.k1?.currentYear ?? emptyK1Year(),
                    hasTwoYearGuaranteedPayments: value?.k1?.hasTwoYearGuaranteedPayments ?? false,
                    w2FromBusiness: value?.k1?.w2FromBusiness ?? 0,
                    ...value?.k1,
                    liquidity: {
                      currentLiabilities: value?.k1?.liquidity?.currentLiabilities ?? 0,
                      inventory: value?.k1?.liquidity?.inventory ?? 0,
                      ...value?.k1?.liquidity,
                      currentAssets: n,
                    },
                  },
                }), "k1-assets", "For business-liquidity check")}
              {money("Current liabilities", value?.k1?.liquidity?.currentLiabilities, (n) =>
                patch({
                  k1: {
                    currentYear: value?.k1?.currentYear ?? emptyK1Year(),
                    hasTwoYearGuaranteedPayments: value?.k1?.hasTwoYearGuaranteedPayments ?? false,
                    w2FromBusiness: value?.k1?.w2FromBusiness ?? 0,
                    ...value?.k1,
                    liquidity: {
                      currentAssets: value?.k1?.liquidity?.currentAssets ?? 0,
                      inventory: value?.k1?.liquidity?.inventory ?? 0,
                      ...value?.k1?.liquidity,
                      currentLiabilities: n,
                    },
                  },
                }), "k1-liabilities")}
              {money("Inventory", value?.k1?.liquidity?.inventory, (n) =>
                patch({
                  k1: {
                    currentYear: value?.k1?.currentYear ?? emptyK1Year(),
                    hasTwoYearGuaranteedPayments: value?.k1?.hasTwoYearGuaranteedPayments ?? false,
                    w2FromBusiness: value?.k1?.w2FromBusiness ?? 0,
                    ...value?.k1,
                    liquidity: {
                      currentAssets: value?.k1?.liquidity?.currentAssets ?? 0,
                      currentLiabilities: value?.k1?.liquidity?.currentLiabilities ?? 0,
                      ...value?.k1?.liquidity,
                      inventory: n,
                    },
                  },
                }), "k1-inventory")}
            </div>
          </div>
        </div>
      )}

      {structure === "c_corporation" && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            For a C corporation, your qualifying income is generally your W-2 wages and dividends from
            the business, not the corporation's retained earnings. Enter your W-2 in the income fields
            above; your loan officer will review any additional income from the corporate return.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
