import type { LoanAppStatus } from "@shared/schema";
import {
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  AlertCircle,
  CheckCheck,
  Banknote,
  FileText,
} from "lucide-react";

export interface PipelineStage {
  key: string;
  label: string;
  icon: typeof FileText;
  statuses: readonly LoanAppStatus[];
}

// Visual buckets along the happy path — several canonical statuses collapse
// into one step. `statuses` is typed against the vocabulary so a phantom key
// is a compile error (the old string keys — "conditional_approval",
// "pre_approval", "application" — matched no status at all, so every file
// before underwriting rendered back at step 0). "closing" deliberately buckets
// with Clear to Close rather than Funded: never show a step the loan hasn't
// reached. Off-ramp statuses (denied/withdrawn/suspended/expired) aren't on
// the happy path and fall back to step 0; the header badge carries the truth.
export const STAGE_ORDER: PipelineStage[] = [
  { key: "application", label: "Application", icon: FileText, statuses: ["draft", "submitted", "analyzing", "under_review"] },
  { key: "pre_approval", label: "Pre-Approval", icon: CheckCircle2, statuses: ["pre_approved", "doc_collection"] },
  { key: "processing", label: "Processing", icon: ClipboardList, statuses: ["processing"] },
  { key: "underwriting", label: "Underwriting", icon: ShieldCheck, statuses: ["underwriting"] },
  { key: "conditional", label: "Conditional", icon: AlertCircle, statuses: ["conditional"] },
  { key: "clear_to_close", label: "Clear to Close", icon: CheckCheck, statuses: ["clear_to_close", "closing"] },
  { key: "funded", label: "Funded", icon: Banknote, statuses: ["funded"] },
];

export function getStageIndex(stage: string): number {
  const idx = STAGE_ORDER.findIndex(s => (s.statuses as readonly string[]).includes(stage));
  return idx >= 0 ? idx : 0;
}
