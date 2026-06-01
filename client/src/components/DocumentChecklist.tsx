import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  ArrowRight,
  FileX,
  Loader2,
} from "lucide-react";

interface DocumentItem {
  id: string;
  documentType: string;
  label: string;
  status: "needed" | "uploaded" | "verifying" | "verified" | "rejected";
  fileName?: string;
  uploadedAt?: string;
  notes?: string;
  requestingTeam?: "processing" | "underwriting" | "title" | "closing";
  isCustomRequest?: boolean;
  instructions?: string;
}

interface DocumentChecklistData {
  documents: DocumentItem[];
  stats: {
    total: number;
    verified: number;
    uploaded: number;
    needed: number;
    rejected: number;
  };
}

const documentTypeLabels: Record<string, string> = {
  w2: "W-2 Forms",
  pay_stub: "Recent Pay Stubs",
  tax_return: "Tax Returns",
  bank_statement: "Bank Statements",
  id: "Government ID",
  drivers_license: "Driver's License",
  passport: "Passport",
  employment_letter: "Employment Verification Letter",
  asset_statement: "Asset Statements",
  gift_letter: "Gift Letter",
  other: "Other Documents",
};

const teamLabels: Record<string, { label: string; color: string }> = {
  processing: { label: "Processing", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  underwriting: { label: "Underwriting", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  title: { label: "Title", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  closing: { label: "Closing", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
};

const getStatusIcon = (status: DocumentItem["status"]) => {
  switch (status) {
    case "verified":
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case "uploaded":
    case "verifying":
      return <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />;
    case "rejected":
      return <FileX className="h-4 w-4 text-red-600 dark:text-red-400" />;
    case "needed":
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const getStatusBadge = (status: DocumentItem["status"]) => {
  switch (status) {
    case "verified":
      return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Verified</Badge>;
    case "uploaded":
      return <Badge variant="secondary">Uploaded</Badge>;
    case "verifying":
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Verifying</Badge>;
    case "rejected":
      return <Badge variant="destructive">Needs Attention</Badge>;
    case "needed":
    default:
      return <Badge variant="outline">Needed</Badge>;
  }
};

interface DocumentChecklistProps {
  applicationId: string;
  compact?: boolean;
}

export function DocumentChecklist({ applicationId, compact = false }: DocumentChecklistProps) {
  const { data, isLoading } = useQuery<DocumentChecklistData>({
    queryKey: ["/api/applications", applicationId, "document-checklist"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = data?.stats || { total: 0, verified: 0, uploaded: 0, needed: 0, rejected: 0 };
  const documents = data?.documents || [];
  const progressPercent = stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0;

  const displayDocuments = compact ? documents.filter(d => d.status !== "verified").slice(0, 4) : documents;
  const hasMoreNeeded = compact && documents.filter(d => d.status !== "verified").length > 4;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg" data-testid="text-doc-checklist-title">Document Checklist</CardTitle>
          </div>
          {!compact && (
            <Badge variant="secondary">
              {stats.verified}/{stats.total} Complete
            </Badge>
          )}
        </div>
        {!compact && (
          <CardDescription>
            Upload required documents to move your application forward
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progressPercent}% complete</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {stats.rejected > 0 && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-700 dark:text-red-300">
              {stats.rejected} document{stats.rejected > 1 ? "s need" : " needs"} your attention
            </span>
          </div>
        )}

        <div className="space-y-2">
          {displayDocuments.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
              data-testid={`doc-item-${doc.documentType}`}
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(doc.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{doc.label}</p>
                    {doc.requestingTeam && teamLabels[doc.requestingTeam] && (
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${teamLabels[doc.requestingTeam].color}`}
                        data-testid={`badge-team-${doc.requestingTeam}`}
                      >
                        {teamLabels[doc.requestingTeam].label}
                      </Badge>
                    )}
                  </div>
                  {doc.fileName && (
                    <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                  )}
                  {doc.instructions && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{doc.instructions}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(doc.status)}
                {(doc.status === "needed" || doc.status === "rejected") && (
                  <Button size="icon" variant="ghost" data-testid={`button-upload-${doc.documentType}`}>
                    <Upload className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {(hasMoreNeeded || compact) && (
          <Link href={`/documents`}>
            <Button variant="outline" className="w-full gap-2" data-testid="button-view-all-docs">
              {hasMoreNeeded ? `View All ${stats.needed + stats.rejected} Remaining` : "Manage Documents"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default DocumentChecklist;
