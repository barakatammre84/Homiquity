import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck } from "lucide-react";
import type { BorrowerDeclarations } from "@shared/schema";
import {
  DeclarationsGroup,
  type DeclarationAnswer,
} from "@/components/patterns/DeclarationsGroup";
import { DECLARATION_QUESTIONS } from "./types";

// URLA Section 5, on the DeclarationsGroup pattern (knowledge-base/handbook/design/DESIGN_SYSTEM.md §13).
//
// The wall is split by what the answers MEAN, and the bulk-"No" escape hatch
// covers only the block it is honest over:
//   • A–D (occupancy, prior ownership, borrowed down payment, co-maker) are
//     SUBSTANTIVE — most borrowers answer "Yes" to occupancy, so a blanket
//     "No to all" would write wrong data. They stay individual questions.
//   • E–K (judgments, federal delinquency, lawsuit, title-in-lieu, short sale,
//     foreclosure, bankruptcy) are the uncommon-adverse-history wall where the
//     clean-file answer is uniformly "No" — the escape hatch lives here, and
//     its master checkbox is derived from the answers, never stored.
//
// The outward contract is unchanged: boolean answers on Partial<BorrowerDeclarations>
// through the same onChange, under the same select-declaration-* testids
// (pinned by DeclarationsSection.test.tsx).

const HISTORY_KEYS: ReadonlySet<keyof BorrowerDeclarations> = new Set([
  "hasOutstandingJudgments",
  "isDelinquentOnFederalDebt",
  "isPartyToLawsuit",
  "hasConveyedTitleInLieuOfForeclosure",
  "hasCompletedShortSale",
  "hasBeenForeclosed",
  "hasDeclaredBankruptcy",
] as const);

const TRANSACTION_QUESTIONS = DECLARATION_QUESTIONS.filter((q) => !HISTORY_KEYS.has(q.key));
const HISTORY_QUESTIONS = DECLARATION_QUESTIONS.filter((q) => HISTORY_KEYS.has(q.key));

// `unknown` because reading through the union key yields every field type; a
// declaration value that isn't literally true/false (e.g. a DB null) is simply
// unanswered.
const toAnswer = (value: unknown): DeclarationAnswer | undefined =>
  value === true ? "yes" : value === false ? "no" : undefined;

const toBool = (answer: DeclarationAnswer | undefined): boolean | undefined =>
  answer === "yes" ? true : answer === "no" ? false : undefined;

interface DeclarationsSectionProps {
  declarations: Partial<BorrowerDeclarations>;
  onChange: (value: Partial<BorrowerDeclarations>) => void;
  activeSeq: number;
}

export function DeclarationsSection({ declarations, onChange, activeSeq }: DeclarationsSectionProps) {
  const questionsOf = (list: typeof DECLARATION_QUESTIONS) =>
    list.map((q) => ({ id: q.key as string, label: q.label }));

  const answersOf = (list: typeof DECLARATION_QUESTIONS) =>
    Object.fromEntries(list.map((q) => [q.key as string, toAnswer(declarations[q.key])]));

  const applyAnswers =
    (list: typeof DECLARATION_QUESTIONS) =>
    (next: Record<string, DeclarationAnswer | undefined>) => {
      const merged: Partial<BorrowerDeclarations> = { ...declarations };
      for (const q of list) {
        // All DECLARATION_QUESTIONS keys are boolean fields; TS can't see that
        // through the union key, so the write is cast — the read side stays typed.
        (merged as Record<string, boolean | undefined>)[q.key as string] = toBool(
          next[q.key as string],
        );
      }
      onChange(merged);
    };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Declarations
        </CardTitle>
        <CardDescription>
          Eleven standard questions every U.S. lender is required to ask
          {activeSeq === 1 ? " (Primary Borrower)" : " (Co-Borrower)"}. In plain terms: a
          "Yes" never disqualifies you on the spot — it simply tells your loan team which
          documents to prepare so nothing surprises you later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <DeclarationsGroup
          legend="About this loan and property"
          escapeHatch={false}
          questions={questionsOf(TRANSACTION_QUESTIONS)}
          answers={answersOf(TRANSACTION_QUESTIONS)}
          onAnswersChange={applyAnswers(TRANSACTION_QUESTIONS)}
          data-testid="declarations-transaction"
          questionTestIdPrefix="select-declaration"
        />
        <DeclarationsGroup
          legend="Your financial history"
          announcement="The remaining questions cover uncommon situations we're required to ask every applicant about. If none apply to you, you can answer “No” to all of them at once by checking the box below. Additional questions may be asked based on your answers."
          questions={questionsOf(HISTORY_QUESTIONS)}
          answers={answersOf(HISTORY_QUESTIONS)}
          onAnswersChange={applyAnswers(HISTORY_QUESTIONS)}
          data-testid="declarations-history"
          questionTestIdPrefix="select-declaration"
        />
      </CardContent>
    </Card>
  );
}
