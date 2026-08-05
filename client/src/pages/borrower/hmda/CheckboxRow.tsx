import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface CheckboxRowProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  testId: string;
  /** Set on the "I do not wish to provide" rows, which render muted. */
  muted?: boolean;
}

/** One checkbox + its label. The htmlFor/id pairing is the click target for the label. */
export function CheckboxRow({ id, label, checked, onCheckedChange, testId, muted }: CheckboxRowProps) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(!!c)}
        data-testid={testId}
      />
      <Label htmlFor={id} className={muted ? "text-muted-foreground" : undefined}>
        {label}
      </Label>
    </div>
  );
}

export const DECLINE_LABEL = "I do not wish to provide this information";
