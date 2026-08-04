// The one copy block shown alongside the ECOA adverse-action notice, pointing
// a denied borrower back at the Incubator's educational tools. Constraints
// (2026-08-04 renter-incubation adjudication §4 Leg B, verified by
// adverseActionRecoveryCopy.test.ts against shared/compliance/loCommsLint):
//   - no figures of any kind (structurally rules out Reg Z trigger terms),
//   - no approval-likelihood or timeline language (Reg N §1014.3(q)),
//   - no denial vocabulary — the notice itself owns the decision disclosure,
//   - subordinate to the notice: rendered after it, hidden from print.
export const RECOVERY_CARD = {
  title: "Keep building toward homeownership",
  body:
    "A decision on one application does not end your path to homeownership. " +
    "Your account includes educational tools — a down payment gap calculator, " +
    "credit education, and a home-readiness view — to help you understand and " +
    "strengthen your financial picture at your own pace.",
  primaryCta: { label: "See your readiness tools", href: "/dashboard" },
  secondaryCta: { label: "Open the gap calculator", href: "/gap-calculator" },
} as const;
