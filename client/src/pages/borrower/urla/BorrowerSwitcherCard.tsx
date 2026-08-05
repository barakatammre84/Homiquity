import { Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface BorrowerSwitcherCardProps {
  activeSeq: number;
  onSelectSeq: (seq: number) => void;
  hasCoBorrower: boolean;
  onAddCoBorrower: () => void;
  onRemoveCoBorrower: () => void;
}

export function BorrowerSwitcherCard({
  activeSeq,
  onSelectSeq,
  hasCoBorrower,
  onAddCoBorrower,
  onRemoveCoBorrower,
}: BorrowerSwitcherCardProps) {
  return (
    <Card className="mb-8">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Editing for:</span>
          <Button
            variant={activeSeq === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => onSelectSeq(1)}
            data-testid="button-borrower-primary"
          >
            Primary Borrower
          </Button>
          {hasCoBorrower && (
            <Button
              variant={activeSeq === 2 ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectSeq(2)}
              data-testid="button-borrower-co"
            >
              Co-Borrower
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!hasCoBorrower ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onAddCoBorrower}
              data-testid="button-add-coborrower"
            >
              <Plus className="h-4 w-4" />
              Add Co-Borrower
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={onRemoveCoBorrower}
              data-testid="button-remove-coborrower"
            >
              <Trash2 className="h-4 w-4" />
              Remove Co-Borrower
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
