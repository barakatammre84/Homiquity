// Realtor.com "RealEstimate" AVM data (CoreLogic / Collateral Analytics /
// Quantarium), delivered inside the realty-us property payload as `estimates`.
// Field casing varies across payload versions, so accept both snake_case and
// camelCase.

export interface ValueEstimate {
  value: number;
  low: number | null;
  high: number | null;
  date: string | null;
  source: string | null;
  sources: { name: string | null; value: number }[];
}

export function parseValueEstimate(estimates: unknown): ValueEstimate | null {
  const e = estimates as any;
  const currentValues = e?.current_values ?? e?.currentValues ?? [];
  if (!Array.isArray(currentValues)) return null;

  const normalized = currentValues
    .map((v: any) => ({
      value: typeof v?.estimate === "number" ? v.estimate : null,
      low: v?.estimate_low ?? v?.estimateLow ?? null,
      high: v?.estimate_high ?? v?.estimateHigh ?? null,
      date: v?.date || null,
      source: v?.source?.name || null,
      isBest: Boolean(v?.isbest_homevalue ?? v?.isBestHomeValue),
    }))
    .filter((v) => v.value !== null && v.value > 0);

  if (normalized.length === 0) return null;

  const best = normalized.find((v) => v.isBest) || normalized[0];
  return {
    value: best.value!,
    low: best.low,
    high: best.high,
    date: best.date,
    source: best.source,
    sources: normalized.map((v) => ({ name: v.source, value: v.value! })),
  };
}
