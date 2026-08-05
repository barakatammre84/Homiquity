import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { AlertTriangle, CheckCircle2, Clock, FileCheck, Shield, ShieldAlert } from "lucide-react";
import type { RetentionReport } from "./model";

/**
 * The three Compliance-tab assurance tiles (finding F-039).
 *
 * They were literal markup — no `useQuery`, no props, no reference to any verify
 * endpoint — asserting "Hash Chain Verified / All audit entries are
 * cryptographically linked" in permanent green. The tile said exactly the same
 * thing whether the log was intact or destroyed, which made it worse than no
 * tile: staff read it as a check that had passed.
 *
 * That mattered more after F-038/F-046. Before those, the verifier could not
 * detect head or tail truncation anyway, so a red tile had little to say. Now a
 * truncated chain IS detectable — and a hardcoded green tile would be actively
 * hiding a detection.
 *
 * Each tile now shows a state it can actually reach, including failure. Where a
 * claim cannot be backed by data, the tile makes the smaller claim rather than
 * the reassuring one.
 */

interface AuditChainSweep {
  scopesTotal: number;
  scopesChecked: number;
  scopesValid: number;
  invalid: Array<{ scopeKey: string; reason: string; totalEntries: number }>;
  tailAnchored: number;
  sequenceHashed: number;
  complete: boolean;
}

function Tile({
  icon,
  title,
  children,
  testId,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  testId: string;
  tone?: "neutral" | "bad";
}) {
  return (
    <div
      className={`p-4 rounded-lg ${tone === "bad" ? "bg-destructive-subtle" : "bg-muted/50"}`}
      data-testid={testId}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span
          className={`font-medium text-sm ${tone === "bad" ? "text-destructive-subtle-foreground" : ""}`}
        >
          {title}
        </span>
      </div>
      <div
        className={`text-xs ${tone === "bad" ? "text-destructive-subtle-foreground" : "text-muted-foreground"}`}
      >
        {children}
      </div>
    </div>
  );
}

/** Hash-chain tile: reflects an actual sweep, and can go red. */
function HashChainTile() {
  const query = useQuery<AuditChainSweep>({
    queryKey: ["/api/compliance/audit-chain/verify"],
  });

  if (query.isPending) {
    return (
      <Tile
        icon={<Shield className="h-5 w-5 text-muted-foreground" />}
        title="Hash Chain"
        testId="tile-hash-chain-loading"
      >
        <Skeleton className="h-3 w-full" />
      </Tile>
    );
  }

  if (query.isError) {
    // An unknown result is not a passing result. The old tile's failure mode was
    // to keep saying "verified"; this one says it does not know.
    return (
      <Tile
        icon={<AlertTriangle className="h-5 w-5 text-warning-subtle-foreground" />}
        title="Hash Chain — not verified"
        testId="tile-hash-chain-error"
      >
        Could not run the integrity check. This is not a pass.
      </Tile>
    );
  }

  const s = query.data;
  const failed = s.invalid.length > 0;

  if (failed) {
    const first = s.invalid[0];
    return (
      <Tile
        icon={<ShieldAlert className="h-5 w-5 text-destructive-subtle-foreground" />}
        title={`Hash Chain BROKEN — ${s.invalid.length} of ${s.scopesChecked}`}
        testId="tile-hash-chain-broken"
        tone="bad"
      >
        <p className="font-medium">{first.scopeKey}</p>
        <p className="mt-1">{first.reason}</p>
      </Tile>
    );
  }

  // Passing — but say what was actually covered. A sweep capped below the total,
  // or chains without an external tip / with pre-v2 sequence hashing, is a
  // narrower claim than "all audit entries are cryptographically linked".
  const caveats: string[] = [];
  if (!s.complete) {
    caveats.push(`${s.scopesChecked} of ${s.scopesTotal} chains checked (most recent first)`);
  }
  if (s.tailAnchored < s.scopesChecked) {
    caveats.push(`${s.scopesChecked - s.tailAnchored} not yet tail-anchored`);
  }
  if (s.sequenceHashed < s.scopesChecked) {
    caveats.push(`${s.scopesChecked - s.sequenceHashed} predate sequence hashing`);
  }

  return (
    <Tile
      icon={<CheckCircle2 className="h-5 w-5 text-success-subtle-foreground" />}
      title="Hash Chain Verified"
      testId="tile-hash-chain-ok"
    >
      <p>
        {s.scopesValid} of {s.scopesChecked} chain{s.scopesChecked === 1 ? "" : "s"} intact
        {s.complete && caveats.length === 0 ? " — full coverage" : ""}
      </p>
      {caveats.length > 0 && <p className="mt-1">{caveats.join(" · ")}</p>}
    </Tile>
  );
}

/** Retention tile: driven by the retention report the tab already fetches. */
function RetentionTile({ report }: { report: RetentionReport | undefined }) {
  if (!report) {
    return (
      <Tile
        icon={<Clock className="h-5 w-5 text-muted-foreground" />}
        title="Retention"
        testId="tile-retention-loading"
      >
        <Skeleton className="h-3 w-full" />
      </Tile>
    );
  }

  const dueForReview = Object.values(report.retentionReviewCounts ?? {}).reduce((a, b) => a + b, 0);
  const archiveEligible = Object.values(report.archiveEligibleCounts ?? {}).reduce((a, b) => a + b, 0);

  if (dueForReview > 0) {
    return (
      <Tile
        icon={<AlertTriangle className="h-5 w-5 text-destructive-subtle-foreground" />}
        title={`Retention — ${dueForReview} due for review`}
        testId="tile-retention-due"
        tone="bad"
      >
        Records past their FCRA retention window need a disposition decision.
      </Tile>
    );
  }

  return (
    <Tile
      icon={<Clock className="h-5 w-5 text-success-subtle-foreground" />}
      title="Retention On Policy"
      testId="tile-retention-ok"
    >
      <p>Nothing past its retention window.</p>
      {archiveEligible > 0 && <p className="mt-1">{archiveEligible} eligible to archive</p>}
    </Tile>
  );
}

/**
 * Export tile: a capability, not a status.
 *
 * Deliberately NOT given a green check. Nothing here verifies that an export
 * would succeed, and dressing an unverified capability as a passing check is the
 * exact defect being fixed in the other two. The endpoints exist; that is the
 * whole claim.
 */
function ExportTile() {
  return (
    <Tile
      icon={<FileCheck className="h-5 w-5 text-info" />}
      title="Export Available"
      testId="tile-export"
    >
      CSV and JSON, per loan, from the Borrower File page.
    </Tile>
  );
}

export function AuditChainStatusTiles({ report }: { report: RetentionReport | undefined }) {
  return (
    <div className="grid gap-4 md:grid-cols-3 mb-6">
      <HashChainTile />
      <ExportTile />
      <RetentionTile report={report} />
    </div>
  );
}
