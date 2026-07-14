import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { friendlyApiError } from "@/lib/errorMessage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@shared/uploads";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileUp, RefreshCw } from "lucide-react";

/**
 * Inline document upload launcher — lets the borrower attach a specific
 * checklist document right where it's rendered (the coach chat / checklist
 * panel) so they never leave the conversation. This is the "each document has
 * an upload link in the chat" affordance: one button per required document.
 *
 * Reuses the existing two-step flow: useUpload (presigned PUT to object storage)
 * → POST /api/documents/upload to register it against the borrower's loan file.
 * The document's docType is passed straight through as documentType so staff see
 * exactly which checklist item it satisfies. Server auto-attaches to the
 * borrower's most recent application when applicationId is omitted.
 */
export function DocumentUploadButton({
  docType,
  label = "Upload",
  size = "sm",
  variant = "outline",
  className,
  testId,
  applicationId,
  onDone,
}: {
  docType: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "secondary" | "ghost";
  className?: string;
  testId?: string;
  applicationId?: string | null;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const { uploadFile } = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [done, setDone] = useState(false);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const stored = await uploadFile(file);
      if (!stored) throw new Error("The file could not be uploaded to secure storage. Please try again.");
      const res = await apiRequest("POST", "/api/documents/upload", {
        objectPath: stored.objectPath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        documentType: docType.slice(0, 50),
        ...(applicationId ? { applicationId } : {}),
      });
      return res.json();
    },
    onSuccess: () => {
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/insights"] });
      toast({ title: "Document received", description: "Thanks — that's added to your file. I'll take it from here." });
      onDone?.();
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't add that document",
        description: friendlyApiError(err, "Nothing was lost — please try again."),
        variant: "destructive",
      });
    },
  });

  const handlePicked = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({
        title: "File too large",
        description: `The limit is ${MAX_UPLOAD_LABEL}. Try compressing the file.`,
        variant: "destructive",
      });
      return;
    }
    upload.mutate(file);
  };

  const busy = upload.isPending;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          handlePicked(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
        data-testid={testId ? `input-${testId}` : undefined}
      />
      <Button
        size={size}
        variant={done ? "secondary" : variant}
        className={className}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        data-testid={testId}
      >
        {busy ? (
          <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : done ? (
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-success-subtle-foreground" />
        ) : (
          <FileUp className="mr-1.5 h-3.5 w-3.5" />
        )}
        {busy ? "Uploading…" : done ? "Uploaded — add another" : label}
      </Button>
    </>
  );
}
