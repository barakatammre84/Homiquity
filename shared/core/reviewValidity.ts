// Ported from Homiquity-Core shared/analysis-validity.ts at e8ebf5b9522137e3d5adf8ce8176e728d60047e0.
// Historical review remains recorded even when it can no longer describe the current file.
export type AnalysisValidity = { isStale: boolean; staleReasons: string[] };
export function validityFromReasons(reasons: string[]): AnalysisValidity {
  const staleReasons = [...new Set(reasons)];
  return { isStale: staleReasons.length > 0, staleReasons };
}
