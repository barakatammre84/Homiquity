import * as React from "react";
import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

// Shared empty state — one look for "there's nothing here yet" across every
// list/table surface, replacing ad-hoc per-page markup. Bordered by default
// (renders its own hairline Card); pass bordered={false} to drop it inside an
// existing card or column.
//
//   <EmptyState icon={Inbox} title="No messages yet"
//     description="Replies from your loan team will show up here."
//     action={<Button asChild><Link href="/apply">Start</Link></Button>} />

export interface EmptyStateProps {
  /** Optional lucide icon. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optional call-to-action (usually a <Button>). */
  action?: React.ReactNode;
  /** Wrap in a bordered Card. Default true. */
  bordered?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  bordered = true,
  className,
  "data-testid": testId,
}: EmptyStateProps) {
  const content = (
    <>
      {Icon && <Icon className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />}
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </>
  );

  const layout = "flex flex-col items-center px-6 py-10 text-center";

  if (!bordered) {
    return (
      <div className={cn(layout, className)} data-testid={testId}>
        {content}
      </div>
    );
  }

  return (
    <Card className={className} data-testid={testId}>
      <CardContent className={layout}>{content}</CardContent>
    </Card>
  );
}
