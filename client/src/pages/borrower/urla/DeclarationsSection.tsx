import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ClipboardCheck } from "lucide-react";
import type { BorrowerDeclarations } from "@shared/schema";
import { DECLARATION_QUESTIONS } from "./types";

interface DeclarationsSectionProps {
  declarations: Partial<BorrowerDeclarations>;
  onChange: (value: Partial<BorrowerDeclarations>) => void;
  activeSeq: number;
}

export function DeclarationsSection({ declarations, onChange, activeSeq }: DeclarationsSectionProps) {
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
      <CardContent className="space-y-4">
        {DECLARATION_QUESTIONS.map((q) => {
          const current = declarations[q.key];
          return (
            <div
              key={q.key as string}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
            >
              <Label
                id={`declaration-label-${q.key as string}`}
                className="flex-1 min-w-[200px] text-sm font-normal leading-relaxed"
              >
                {q.label}
              </Label>
              <div
                role="group"
                aria-labelledby={`declaration-label-${q.key as string}`}
                className="flex gap-2"
                data-testid={`select-declaration-${q.key as string}`}
              >
                <Button
                  type="button"
                  size="sm"
                  variant={current === true ? "default" : "outline"}
                  aria-pressed={current === true}
                  onClick={() => onChange({ ...declarations, [q.key]: true })}
                  data-testid={`select-declaration-${q.key as string}-yes`}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={current === false ? "default" : "outline"}
                  aria-pressed={current === false}
                  onClick={() => onChange({ ...declarations, [q.key]: false })}
                  data-testid={`select-declaration-${q.key as string}-no`}
                >
                  No
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
