import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icons } from "@/lib/icons";
import { DATA_PROVENANCE } from "@shared/dataProvenance";

import { ConsentField } from "@/components/patterns/ConsentField";
import {
  DeclarationsGroup,
  type DeclarationAnswer,
} from "@/components/patterns/DeclarationsGroup";
import { DocumentList } from "@/components/patterns/DocumentList";
import { DualUnitTable } from "@/components/patterns/DualUnitTable";
import { EmptyState } from "@/components/patterns/EmptyState";
import { EntityCard, EntityCollection } from "@/components/patterns/EntityCard";
import { LoanTracker } from "@/components/patterns/LoanTracker";
import { MilestoneBar } from "@/components/patterns/MilestoneBar";
import { OptionalUpload } from "@/components/patterns/OptionalUpload";
import { StickyFormBar, SupportPill } from "@/components/patterns/StickyFormBar";
import { SummarySection, UnderwritingRule } from "@/components/patterns/SummarySection";
import { TaskProgress } from "@/components/patterns/TaskProgress";

// UI-overhaul prototype — an internal, staff-gated
// gallery that composes every pattern component with SIMULATED data: Better's
// white/clean layout physics carrying Homiquity's brand and products. This is
// the reference rendering the overhaul migrates real surfaces toward; nothing
// here reads or writes application data.
//
// The LoanTracker steps reuse the homepage "How it works" labels verbatim
// (client/src/pages/public/Landing.tsx) so the marketing promise and the
// in-app reality are literally the same words.

// Demo-only figures. Real surfaces resolve titles and figures at the data
// layer; the point here is the components' contracts, not the numbers.
const DEMO_DOCUMENT_TITLES: Record<string, string> = {
  w2_2025: "W-2 (2025)",
  paystub_jul: "Paystub — July",
  bank_stmt_q2: "Bank statement — Apr–Jun",
  credit_authorization: "Credit check authorization",
};

const DEMO_DECLARATIONS = [
  { id: "judgments", label: "Are there any outstanding judgments against you?" },
  { id: "bankruptcy", label: "Have you declared bankruptcy within the past 7 years?" },
  { id: "foreclosure", label: "Have you had property foreclosed upon in the past 7 years?" },
  { id: "lawsuit", label: "Are you a party to a lawsuit in which you potentially have any personal financial liability?" },
  { id: "delinquent", label: "Are you currently delinquent or in default on a federal debt?" },
];

export default function DesignPrototype() {
  const [declarationAnswers, setDeclarationAnswers] = useState<
    Record<string, DeclarationAnswer | undefined>
  >({});
  const [creditConsent, setCreditConsent] = useState(false);
  const [assetState, setAssetState] = useState<"saved" | "editing">("saved");

  return (
    <PageShell
      width="content"
      eyebrow="Design standard"
      title="UI overhaul prototype"
      subtitle="Every pattern component from components/patterns, composed the way real flows will use them (gate: DESIGN_SYSTEM.md §13)."
      headerMeta={<Badge variant="info">Simulated data</Badge>}
    >
      <div className="space-y-10">
        {/* The macro tier above the step detail — both name what they measure. */}
        <MilestoneBar
          label="Your journey to keys"
          milestones={[
            { id: "preapproval", name: "Pre-approval", status: "done" },
            { id: "underwriting", name: "Underwriting", status: "current" },
            { id: "closing", name: "Closing", status: "future" },
            { id: "keys", name: "Move in", status: "future" },
          ]}
        />

        {/* Whole road visible, one step lit; labels mirror the homepage. */}
        <LoanTracker
          label="Your loan, start to close"
          steps={[
            {
              id: "questions",
              title: "Answer a few questions",
              description:
                "You tell us about your income, debts, and what you're looking for. Takes about 3 minutes.",
              status: "done",
              completedOn: "Aug 12, 2026",
            },
            {
              id: "documents",
              title: "Upload your documents",
              description:
                "You provide the documents we list — we keep everything organized in one place.",
              status: "current",
              actions: (
                <Button size="sm">
                  <Icons.upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Upload documents
                </Button>
              ),
            },
            {
              id: "answer",
              title: "Get your answer",
              description:
                "We evaluate your profile against real lending guidelines and give you a clear decision.",
              status: "future",
            },
            {
              id: "shop",
              title: "Shop with confidence",
              description:
                "You use your pre-approval letter to make competitive offers on homes you love.",
              status: "future",
            },
          ]}
        />

        <TaskProgress label="Documents uploaded" completed={3} total={5} />

        {/* §5 — one underwriting concept per screen; confirm, not enter; the
            rule printed beside the field it governs. */}
        <SummarySection
          title="Confirm your employment income"
          source={{ provenance: DATA_PROVENANCE.SELF_REPORTED }}
          whyWeAsk="Your income determines your debt-to-income ratio — how much of what you earn already goes to debts. We verify it next with documents like your paystubs and W-2."
        >
          <div className="max-w-sm space-y-2">
            <Label htmlFor="annual-income" className="text-sm font-normal">
              Annual income before taxes
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Input
              id="annual-income"
              inputMode="numeric"
              defaultValue="$84,000"
              data-testid="input-annual-income"
            />
            <UnderwritingRule rule="This must be consistent for a 2-year period — we'll ask about your 2024 and 2025 income next." />
          </div>
        </SummarySection>

        {/* §6 — dual-unit display inside a sourced section; — for N/A. */}
        <SummarySection
          title="Qualifying income"
          source={{ provenance: DATA_PROVENANCE.SYSTEM_CALCULATED }}
          whyWeAsk="Lenders qualify you on monthly figures while you likely think in annual ones — we show both so nothing looks wrong to either of you."
        >
          <DualUnitTable
            caption="Income we can count toward your approval"
            totalLabel="Total qualifying income"
            groups={[
              {
                label: "Employment",
                note: "Counted when consistent for a 2-year period.",
                rows: [
                  { label: "Base salary", annual: 84000 },
                  { label: "Overtime", annual: null },
                  { label: "Bonus (2-year average)", annual: 6000 },
                ],
              },
            ]}
          />
        </SummarySection>

        {/* §5 — repeating entities: empty → editing → saved; Add on the
            collection, outside the card. */}
        <EntityCollection
          label="Your assets"
          addLabel="Add another asset"
          onAdd={() => setAssetState("editing")}
        >
          <EntityCard
            title="Asset 1 — Checking account"
            state={assetState}
            summary={[
              { question: "Bank", answer: "First Federal" },
              { question: "Balance", answer: "$24,500" },
              { question: "Used for your down payment?", answer: "Yes" },
            ]}
            onEdit={() => setAssetState("editing")}
            onSave={() => setAssetState("saved")}
            onCancel={() => setAssetState("saved")}
            onDelete={() => {}}
          >
            <div className="max-w-sm space-y-2">
              <Label htmlFor="asset-bank" className="text-sm font-normal">
                Bank name
              </Label>
              <Input id="asset-bank" defaultValue="First Federal" />
            </div>
          </EntityCard>
          <EntityCard
            title="Asset 2"
            state="empty"
            emptyPrompt="Savings, retirement, or gift funds all count — add them here."
            startLabel="Add asset"
            onStart={() => {}}
          />
        </EntityCollection>

        {/* §6 — the bulk-answer escape hatch; master derived, never stored. */}
        <DeclarationsGroup
          legend="About your finances"
          required
          questions={DEMO_DECLARATIONS}
          answers={declarationAnswers}
          onAnswersChange={setDeclarationAnswers}
        />

        {/* §6 — consent: positive opt-in, never pre-ticked, consequence
            outside the label. */}
        <ConsentField
          id="credit-consent"
          label="I authorize Homiquity to check my credit"
          consequence="This is a soft check — the kind that never affects your credit score. We will never share your credit report or bank statements."
          checked={creditConsent}
          onCheckedChange={setCreditConsent}
        />

        {/* §6 — the document vault: slug-mapped titles, subjects, plain dates. */}
        <section aria-label="Documents">
          <h3 className="text-base font-semibold text-foreground">Your documents</h3>
          <DocumentList
            className="mt-3"
            titles={DEMO_DOCUMENT_TITLES}
            groups={[
              {
                label: "Income",
                documents: [
                  {
                    id: "d1",
                    slug: "w2_2025",
                    subject: "Alex",
                    status: "verified",
                    provenance: DATA_PROVENANCE.VERIFIED,
                    date: { verb: "You uploaded", on: "Aug 12, 2026" },
                  },
                  {
                    id: "d2",
                    slug: "w2_2025",
                    subject: "Jordan",
                    status: "uploaded",
                    date: { verb: "You uploaded", on: "Aug 14, 2026" },
                  },
                  {
                    id: "d3",
                    slug: "paystub_jul",
                    subject: "Alex",
                    status: "verifying",
                    date: { verb: "You uploaded", on: "Aug 15, 2026" },
                  },
                ],
              },
              {
                label: "Disclosures",
                documents: [
                  {
                    id: "d4",
                    slug: "credit_authorization",
                    status: "verified",
                    date: { verb: "Sent to you", on: "Aug 11, 2026" },
                  },
                ],
              },
            ]}
          />
        </section>

        {/* An optional ask with its reassurance — no penalty for skipping. */}
        <OptionalUpload
          title="Gift letter"
          description="Only needed when part of your down payment is a gift."
          reassurance="If no gift funds are part of your down payment, there's nothing to add here — your application is complete without it."
          tips={["Ask the giver to sign and date it — a short note is enough."]}
          action={
            <Button variant="outline" size="sm">
              <Icons.upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Upload gift letter
            </Button>
          }
        />

        {/* Scoped empty state: the heading is derived from what this
            surface actually knows. */}
        <EmptyState
          scope="messages from your loan team"
          description="When Alex's file has news — a document accepted, a question from underwriting — it lands here first."
          icon={Icons.email}
        />

        {/* §6 — sticky Support-left / Submit-right chrome. */}
        <StickyFormBar support={<SupportPill phone="+13125550143" />}>
          <Button variant="ghost">Save for later</Button>
          <Button className="rounded-full px-6">
            Continue
            <Icons.next className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Button>
        </StickyFormBar>
      </div>
    </PageShell>
  );
}
