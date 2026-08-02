import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";

/** Pre-qualification letter card (extracted from Dashboard.tsx): generate on
 * first use, then download the PDF. Owns its status query and mutation. */
export function PreQualLetterCard({ applicationId }: { applicationId: string }) {
  const { toast } = useToast();

  const statusQuery = useQuery<{ hasLetter: boolean; letterNumber?: string; estimatedAmount?: string }>({
    queryKey: ["/api/loan-applications", applicationId, "prequal-status"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/generate-prequal`);
      return res.json();
    },
    onSuccess: (data: { letterNumber: string }) => {
      toast({ title: "Letter Ready", description: `Your pre-qualification letter #${data.letterNumber} has been generated.` });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications", applicationId, "prequal-status"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not generate letter. Please try again.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    try {
      const res = await apiRequest("GET", `/api/loan-applications/${applicationId}/prequal-pdf`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pre-qualification-letter.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Could not download letter.", variant: "destructive" });
    }
  };

  const hasLetter = statusQuery.data?.hasLetter;

  return (
    <Card className="hover-elevate" data-testid="card-prequal-letter">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-border">
              <FileText className="h-4 w-4 text-warning-subtle-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm" data-testid="text-prequal-title">
                Pre-Qualification Letter
              </p>
              <p className="text-xs text-muted-foreground">
                {hasLetter
                  ? "Your letter is ready to download"
                  : "Get a preliminary qualification letter"}
              </p>
            </div>
          </div>
          {hasLetter ? (
            <Button onClick={handleDownload} variant="outline" size="sm" className="gap-2" data-testid="button-download-prequal-dash">
              <Download className="h-4 w-4" />
              Download
            </Button>
          ) : (
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              variant="outline"
              size="sm"
              className="gap-2"
              data-testid="button-generate-prequal-dash"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
