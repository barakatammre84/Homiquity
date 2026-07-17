import { useEffect, useRef, useState } from "react";
import { AlertCircle, FileUp, Upload, X } from "lucide-react";
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  ACCEPTED_UPLOAD_LABEL,
  MAX_UPLOAD_LABEL,
  validateUploadFile,
} from "@shared/uploads";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * THE drag-and-drop upload affordance for borrower documents (hand-rolled —
 * no dropzone dependency). Three visual states, semantic tokens only:
 *  - idle: dashed border, muted surface, "drag & drop or browse" copy
 *  - drag-active: primary border/tint ("Drop to upload securely")
 *  - drop-error: destructive tint with the validateUploadFile message,
 *    auto-clearing after a few seconds or on the next drag
 *
 * Validation (type + the shared 10MB cap) runs on BOTH the drop and browse
 * paths via shared/uploads.ts, so the dropzone can never accept something the
 * server will bounce. Multi-file drops take the first file — every checklist
 * row is a single-document affordance.
 */
export function DocumentDropzone({
  onFileAccepted,
  disabled = false,
  compact = false,
  accept = ACCEPTED_UPLOAD_EXTENSIONS,
  idleLabel = "Drag & drop your file here, or browse",
  className,
  "data-testid": testId,
}: {
  onFileAccepted: (file: File) => void;
  disabled?: boolean;
  /** Slim variant for inline checklist rows. */
  compact?: boolean;
  accept?: string;
  idleLabel?: string;
  className?: string;
  "data-testid"?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Drag enter/leave fire for every child element; a depth counter is the
  // standard way to know when the pointer truly left the dropzone.
  const [dragDepth, setDragDepth] = useState(0);
  const [dropError, setDropError] = useState<string | null>(null);
  const isDragActive = dragDepth > 0 && !disabled;

  useEffect(() => {
    if (!dropError) return;
    const timer = setTimeout(() => setDropError(null), 4000);
    return () => clearTimeout(timer);
  }, [dropError]);

  const takeFile = (file: File | null | undefined) => {
    if (!file || disabled) return;
    const check = validateUploadFile(file);
    if (!check.ok) {
      setDropError(check.message);
      return;
    }
    setDropError(null);
    onFileAccepted(file);
  };

  const openBrowse = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${idleLabel} (${ACCEPTED_UPLOAD_LABEL}, up to ${MAX_UPLOAD_LABEL})`}
      aria-disabled={disabled}
      onClick={openBrowse}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openBrowse();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setDragDepth((d) => d + 1);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragDepth((d) => Math.max(0, d - 1));
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragDepth(0);
        takeFile(e.dataTransfer.files?.[0]);
      }}
      data-testid={testId}
      className={cn(
        "flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        compact ? "px-3 py-3" : "px-6 py-8",
        disabled && "cursor-not-allowed opacity-50",
        dropError
          ? "border-destructive bg-destructive/10 text-destructive"
          : isDragActive
            ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/40"
            : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/50",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          takeFile(e.target.files?.[0]);
          e.target.value = "";
        }}
        data-testid={testId ? `input-${testId}` : undefined}
      />
      {dropError ? (
        <>
          <AlertCircle className={cn("mb-1", compact ? "h-4 w-4" : "h-6 w-6")} />
          <p className="text-xs font-medium" data-testid={testId ? `${testId}-error` : undefined}>
            {dropError}
          </p>
        </>
      ) : (
        <>
          <FileUp className={cn("mb-1", compact ? "h-4 w-4" : "h-6 w-6")} />
          <p className="text-xs font-medium">
            {isDragActive ? "Drop to upload your file securely" : idleLabel}
          </p>
          <p className="mt-0.5 text-[10px] opacity-80">
            {ACCEPTED_UPLOAD_LABEL} up to {MAX_UPLOAD_LABEL}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * In-flight upload card: file name + size, REAL byte-level progress (from
 * useUpload's XHR), and a Cancel that actually aborts the PUT — the borrower
 * always stays in control of their document.
 */
export function UploadProgressCard({
  fileName,
  fileSize,
  progress,
  onCancel,
  "data-testid": testId,
}: {
  fileName: string;
  fileSize: number;
  progress: number;
  onCancel?: () => void;
  "data-testid"?: string;
}) {
  return (
    <div className="w-full rounded-lg border bg-muted/30 p-3" data-testid={testId}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium">
        <span className="flex min-w-0 items-center gap-1.5">
          <Upload className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{fileName}</span>
          <span className="shrink-0 text-muted-foreground">
            {(fileSize / 1024 / 1024).toFixed(1)} MB
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="tabular-nums text-primary">{Math.round(progress)}%</span>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label="Cancel upload"
              onClick={onCancel}
              data-testid={testId ? `${testId}-cancel` : undefined}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </span>
      </div>
      <Progress value={progress} className="h-1.5" />
      <p className="mt-1 text-[10px] text-muted-foreground">Uploading to secure storage…</p>
    </div>
  );
}
