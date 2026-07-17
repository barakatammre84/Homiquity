import { Badge } from "@/components/ui/badge";
import { getDocumentStatusLabel } from "@/lib/formatters";

/**
 * THE status badge for a document (documents.status) — borrower surfaces show
 * Under Review / Accepted / Action Needed; staff surfaces show the literal
 * review state. One component so the vocabulary can never fork again (the old
 * per-page maps disagreed, and one mapped a status the server never writes).
 * "Uploading" is intentionally not a badge — it's the client-transient
 * progress card while the file is in flight.
 */
type BadgeVariant = "success" | "destructive" | "info" | "warning" | "secondary";

const VARIANTS: Record<string, { borrower: BadgeVariant; staff: BadgeVariant }> = {
  uploaded: { borrower: "info", staff: "secondary" },
  verifying: { borrower: "info", staff: "warning" },
  verified: { borrower: "success", staff: "success" },
  rejected: { borrower: "destructive", staff: "destructive" },
};

export function DocumentStatusBadge({
  status,
  audience = "borrower",
  className,
  "data-testid": testId,
}: {
  status: string | null | undefined;
  audience?: "borrower" | "staff";
  className?: string;
  "data-testid"?: string;
}) {
  const key = status || "uploaded";
  const variant = VARIANTS[key]?.[audience] ?? "secondary";
  return (
    <Badge variant={variant} className={className} data-testid={testId}>
      {getDocumentStatusLabel(key, audience)}
    </Badge>
  );
}
