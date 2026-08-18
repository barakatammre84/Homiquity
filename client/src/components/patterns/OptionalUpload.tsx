import { Badge } from "@/components/ui/badge";
import { Icons } from "@/lib/icons";

// The optional-file ask (teardown §9, P3). `reassurance` is required and
// states — neutrally — what happens if the borrower skips it: an optional ask
// without that sentence reads as a quiet obligation, and penalty language on
// declining is banned outright (DESIGN-STANDARD §8). Never a required marker.

export interface OptionalUploadProps {
  title: string;
  description?: string;
  /** What skipping means, stated neutrally. Required by design. */
  reassurance: string;
  /** Practical pointers, e.g. which statement pages to include. */
  tips?: readonly string[];
  /** The upload affordance (button, dropzone) supplied by the caller. */
  action?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

export function OptionalUpload({
  title,
  description,
  reassurance,
  tips,
  action,
  className,
  "data-testid": testId = "optional-upload",
}: OptionalUploadProps) {
  return (
    <div
      className={
        "rounded-xl border border-dashed border-border p-5 " + (className ?? "")
      }
      data-testid={testId}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icons.upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h4 className="text-base font-semibold text-foreground">{title}</h4>
        <Badge variant="secondary" data-testid={`${testId}-optional`}>
          Optional
        </Badge>
      </div>
      {description && (
        <p className="mt-2 text-sm text-foreground">{description}</p>
      )}
      <p className="mt-2 text-sm text-muted-foreground" data-testid={`${testId}-reassurance`}>
        {reassurance}
      </p>
      {tips && tips.length > 0 && (
        <ul className="mt-3 space-y-1">
          {tips.map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Icons.info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
