import * as React from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyApiError } from "@/lib/errorMessage";

// One place to render the loading / error / empty branches of a TanStack query,
// so a server failure shows an honest error + retry instead of a misleading
// "empty" screen (finding ux-01). Success renders via the children render-prop
// with the resolved, defined data.
//
//   <QueryBoundary query={q} isEmpty={(d) => d.length === 0}
//     empty={<EmptyState icon={Inbox} title="No documents yet" />}>
//     {(docs) => docs.map((d) => <Row key={d.id} doc={d} />)}
//   </QueryBoundary>

interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  /** Render the resolved data. Only called on success. */
  children: (data: T) => React.ReactNode;
  /** Node shown while pending. Defaults to a pair of skeleton blocks. */
  loading?: React.ReactNode;
  /** Predicate deciding whether resolved data counts as empty. */
  isEmpty?: (data: T) => boolean;
  /** Node shown when isEmpty(data) is true (usually an <EmptyState>). */
  empty?: React.ReactNode;
  /** Error banner heading. */
  errorTitle?: string;
  /** Applied to the default loading + error containers. */
  className?: string;
  /** Base test id; error/retry get `-error` / `-retry` suffixes. */
  "data-testid"?: string;
}

export function QueryBoundary<T>({
  query,
  children,
  loading,
  isEmpty,
  empty,
  errorTitle = "We couldn't load this",
  className,
  "data-testid": testId,
}: QueryBoundaryProps<T>) {
  if (query.isError) {
    return (
      <Alert
        className={cn(
          "border-transparent bg-destructive-subtle text-destructive-subtle-foreground [&>svg]:text-destructive-subtle-foreground",
          className,
        )}
        data-testid={testId ? `${testId}-error` : "query-error"}
      >
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{errorTitle}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{friendlyApiError(query.error)}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void query.refetch();
            }}
            data-testid={testId ? `${testId}-retry` : "button-query-retry"}
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <>
        {loading ?? (
          <div className={cn("space-y-3", className)} data-testid="query-loading">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </>
    );
  }

  const data = query.data;
  if (empty && isEmpty?.(data)) {
    return <>{empty}</>;
  }
  return <>{children(data)}</>;
}
