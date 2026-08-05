import type { DocRow } from "@/components/DocumentItemRow";

/** The single in-flight upload, keyed by ROW (two rows can accept one type). */
export interface ActiveUpload {
  rowKey: string;
  docType: string;
  fileName: string;
  fileSize: number;
}

/**
 * Everything a checklist row needs to render its dropzone / progress card.
 *
 * Bundled rather than passed as six separate props because the category cards
 * only forward it — the upload state machine itself stays in Documents.tsx
 * (uploads are a TEAM_PRACTICES §9 security-review trigger; keeping the flow in
 * one reviewed place matters more than the line count).
 */
export interface UploadControls {
  activeUpload: ActiveUpload | null;
  /** Real byte-level progress of the storage PUT, 0–100. */
  progress: number;
  anyUploadBusy: boolean;
  onFile: (row: DocRow, file: File) => void;
  onBrowse: (row: DocRow) => void;
  onCancel: () => void;
}
