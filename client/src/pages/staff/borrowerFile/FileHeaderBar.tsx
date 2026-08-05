import { Link } from "wouter";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface PreUwFlag {
  code: string;
  severity: string;
  reason: string;
}

export interface FileHeaderBarProps {
  preUwFlags: PreUwFlag[];
  /** Decided in BorrowerFile.tsx alongside the other role gates. */
  canExportMismo: boolean;
  onExportMismo: () => void;
  exportingMismo: boolean;
}

export function FileHeaderBar({
  preUwFlags,
  canExportMismo,
  onExportMismo,
  exportingMismo,
}: FileHeaderBarProps) {
  return (
    <div className="flex items-center justify-between border-b bg-background px-6 py-3">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/staff-dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {preUwFlags.map((flag) => (
          <Badge
            key={flag.code}
            variant="secondary"
            title={flag.reason}
            className={`no-default-hover-elevate no-default-active-elevate text-[10px] ${
              flag.severity === "blocking"
                ? "bg-status-danger/10 text-status-danger"
                : "bg-status-warning/10 text-status-warning"
            }`}
            data-testid={`badge-preuw-${flag.code}`}
          >
            {flag.code.replace(/_/g, " ")}
          </Badge>
        ))}
        {/* GSE delivery is internal-staff-only; the server route rejects
            broker/lender, so don't offer them a button that can only 403. */}
        {canExportMismo && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportMismo}
            disabled={exportingMismo}
            data-testid="button-export-mismo"
          >
            <Download className="mr-2 h-4 w-4" />
            {exportingMismo ? "Exporting…" : "Export MISMO"}
          </Button>
        )}
        <Button size="sm" data-testid="button-generate-le">
          <FileText className="mr-2 h-4 w-4" />
          Generate LE
        </Button>
      </div>
    </div>
  );
}
