import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, it, expect } from "vitest";

// -----------------------------------------------------------------------------
// A button that does nothing must not be shipped as though it does.
//
// The pattern this catches:
//
//   <Button size="sm" data-testid="button-generate-le">
//     <FileText className="mr-2 h-4 w-4" />
//     Generate LE
//   </Button>
//
// No onClick, no asChild, not a form submit, not disabled, and not wrapped in a
// Link or a Radix *Trigger. It renders as a live, hoverable control and does
// absolutely nothing when clicked. On a mortgage product that is worse than a
// missing feature: the user believes they took an action they did not take.
// Two real instances were fixed alongside this file being written — the Loan
// Estimate's Print and Download PDF buttons, on a page that tells the borrower
// to save the disclosure.
//
// This is a RATCHET, not a clean-slate rule. The remaining inert buttons each
// need a product decision (what should "Save" persist to? where does "Contact"
// go?), so they cannot be fixed in one sweep — but the count may only go DOWN.
// Wire a button, lower the number.
// -----------------------------------------------------------------------------

const REPO_ROOT = join(__dirname, "..");
const CLIENT_SRC = join(REPO_ROOT, "client", "src");

/**
 * Buttons with no handler and no wrapper that would give them one.
 *
 * Lower this as buttons are wired — never raise it. The current inventory is
 * printed in the failure message, so a regression names itself.
 */
const BASELINE_INERT = 6;

/** Anything that makes a child Button actionable by wrapping it. */
const WRAPPER = /<(Link|a|\w*Trigger)\b/;

/**
 * A Button handed to a `trigger={...}` prop is actionable: the only consumer
 * of that prop, UploadDocumentDialog, renders it inside
 * `<DialogTrigger asChild>{trigger}</DialogTrigger>`. Without this the
 * detector reported two upload buttons that work perfectly well.
 */
const TRIGGER_PROP = /\btrigger=\{\s*$/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

/** Is this line inside a comment? Doc blocks show example JSX we must skip. */
function isCommented(line: string): boolean {
  return /^\s*(\/\/|\*|\/\*)/.test(line);
}

export function inertButtons(): string[] {
  const hits: string[] = [];
  for (const file of sourceFiles(CLIENT_SRC)) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    for (const match of src.matchAll(/<Button\b([^>]*?)>/gs)) {
      const attrs = match[1];
      // Any of these means the button has, or inherits, a behaviour.
      if (/onClick|asChild|type="submit"|disabled/.test(attrs)) continue;

      const lineNo = src.slice(0, match.index).split("\n").length - 1;
      if (isCommented(lines[lineNo])) continue;

      // A wrapping <Link> or Radix *Trigger supplies the behaviour instead.
      const before = lines.slice(Math.max(0, lineNo - 4), lineNo).join("\n");
      if (WRAPPER.test(before)) continue;
      if (TRIGGER_PROP.test(lines[lineNo - 1] ?? "")) continue;
      const after = lines.slice(lineNo, lineNo + 10).join("\n");
      if (after.includes("</Link>") || after.includes("</a>")) continue;

      const testId = /data-testid=[{"]([^"}`]+)/.exec(attrs)?.[1] ?? "(no testid)";
      hits.push(`${relative(REPO_ROOT, file)}:${lineNo + 1} — ${testId}`);
    }
  }
  return hits.sort();
}

describe("no new buttons that do nothing", () => {
  it("does not grow the set of inert buttons", () => {
    const inert = inertButtons();
    expect(
      inert.length,
      `${inert.length} buttons have no onClick, no asChild, no form submit, are ` +
        `not disabled, and are not wrapped in a Link or Trigger (baseline ` +
        `${BASELINE_INERT}). A new one renders as a live control that silently ` +
        `does nothing when clicked. Give it a handler, wrap it in a Link, mark ` +
        `it disabled with a reason, or lower BASELINE_INERT if you wired one ` +
        `up.\n\n${inert.join("\n")}`,
    ).toBeLessThanOrEqual(BASELINE_INERT);
  });

  it("keeps the baseline honest — tighten it as buttons are wired", () => {
    // Stops the number rotting upward-of-reality: if the real count drops
    // below the baseline, the baseline must come down with it.
    const inert = inertButtons();
    expect(
      inert.length,
      `Only ${inert.length} buttons are inert but BASELINE_INERT is ` +
        `${BASELINE_INERT}. Lower the baseline to ${inert.length} to lock the gain in.`,
    ).toBe(BASELINE_INERT);
  });

  it("the buttons wired up in this pass stay wired", () => {
    // Named explicitly so a later refactor cannot quietly drop the handler
    // from a control the user is told to rely on.
    const wired: [string, RegExp][] = [
      // "Save this Loan Estimate to compare with your Closing Disclosure."
      ["client/src/pages/lending/loanEstimate/LoanEstimateHeader.tsx", /window\.print\(\)/],
      ["client/src/pages/lending/loanEstimate/LoanEstimateHeader.tsx", /loan-estimate\/pdf/],
      // Per-document staff verdicts, rather than only the last upload.
      ["client/src/pages/borrower/taskDetail/VerifyDocumentsCard.tsx", /onVerify\(taskDoc\.id, true\)/],
      ["client/src/pages/borrower/taskDetail/VerifyDocumentsCard.tsx", /onVerify\(taskDoc\.id, false\)/],
      // Policy catalogue CRUD: create derives the profile id from the
      // convention, clone goes through the atomic server endpoint.
      ["client/src/pages/staff/policyOps/CreatePolicyDialog.tsx", /buildProfileId/],
      ["client/src/pages/staff/policyOps/ProfileView.tsx", /policy-profiles\/\$\{policy!\.id\}\/clone/],
      // The listing hearts: saved_properties had a table and storage methods
      // but no HTTP route, so every one of them was inert.
      ["client/src/components/property/SavePropertyButton.tsx", /\/api\/saved-properties\/\$\{propertyId\}/],
      ["client/src/components/property/SavePropertyButton.tsx", /navigator\.share/],
    ];
    for (const [rel, pattern] of wired) {
      const src = readFileSync(join(REPO_ROOT, rel), "utf8");
      expect(src, `${rel} lost ${pattern}`).toMatch(pattern);
    }
  });
});

describe("the policy console never claims a save it did not make", () => {
  // Both editors used to persist nothing and confirm success anyway:
  // RuleEditor's "Draft Saved — changes saved to draft, publish when ready"
  // and COCRuleBuilder's "COC Rule Added", over hardcoded useState defaults,
  // on a console gated to admin and underwriter. The two are now in different
  // positions and the tests say which is which.
  const POLICY_OPS = join(REPO_ROOT, "client", "src", "pages", "staff", "policyOps");
  const read = (file: string) => readFileSync(join(POLICY_OPS, file), "utf8");

  it("the threshold editor writes to the API it reports success for", () => {
    const src = read("RuleEditor.tsx");
    // Reads real thresholds...
    expect(src).toMatch(/useQuery<PolicyThreshold\[\]>/);
    expect(src).toMatch(/"\/api\/policy-thresholds"/);
    // ...and its success toast is inside a mutation that PATCHes them.
    expect(src).toMatch(/apiRequest\("PATCH", `\/api\/policy-thresholds\/\$\{id\}`/);
    expect(src).toMatch(/onSuccess[\s\S]{0,400}Thresholds Updated/);
    // A failure must not pass silently, and must not clear the operator's work.
    expect(src).toMatch(/onError[\s\S]{0,300}Changes Not Saved/);
    expect(src).not.toMatch(/Draft Saved/);
  });

  it("the threshold editor never invents values when it has none", () => {
    const src = read("RuleEditor.tsx");
    // No policy selected, none configured, and a failed load are three
    // different things and each says so. The last one matters most: an error
    // rendered as "no thresholds" reads as an unconfigured policy.
    expect(src).toMatch(/rule-editor-no-policy/);
    expect(src).toMatch(/rule-editor-empty/);
    expect(src).toMatch(/QueryErrorState/);
  });

  it("the COC builder still says plainly that it is not connected", () => {
    // No COC table and no COC endpoint exist, and a COC rule does not fit a
    // threshold row (it carries a GSE list with no column for it), so this one
    // stays honest rather than being wired on a guess.
    const src = read("COCRuleBuilder.tsx");
    expect(src).toMatch(/<NotConnectedNotice \/>/);
    expect(src, "COCRuleBuilder must not toast").not.toMatch(/useToast|toast\(/);
    expect(src).not.toMatch(/COC Rule Added/);
    const notice = read("NotConnectedNotice.tsx");
    expect(notice).toMatch(/placeholders, not your policy/);
    expect(notice).toMatch(/changes made here are not saved/);
  });
});
