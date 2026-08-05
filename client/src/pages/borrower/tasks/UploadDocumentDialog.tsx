import { File, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Task } from "@shared/schema";
import { getDocumentCategoryLabel } from "./documentCategoryLabels";

export interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  selectedFile: File | null;
  onSelectFile: (file: File | null) => void;
  onConfirm: () => void;
  isUploading: boolean;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  task,
  selectedFile,
  onSelectFile,
  onConfirm,
  isUploading,
}: UploadDocumentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            {task?.title}
            {task?.documentCategory && (
              <span className="block mt-1">
                Required: {getDocumentCategoryLabel(task.documentCategory)}
                {task.documentYear && ` for ${task.documentYear}`}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {task?.documentInstructions && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <strong>Instructions:</strong> {task.documentInstructions}
            </div>
          )}
          <div>
            <Label htmlFor="file">Select File</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => onSelectFile(e.target.files?.[0] || null)}
              className="mt-2"
              data-testid="input-file-upload"
            />
            {selectedFile && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <File className="h-4 w-4" />
                {selectedFile.name}
                <Button
                  variant="ghost"
                  size="icon" aria-label="Close"
                  className="h-6 w-6"
                  onClick={() => onSelectFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!selectedFile || isUploading}
            data-testid="button-confirm-upload"
          >
            {isUploading ? "Uploading..." : "Upload Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
