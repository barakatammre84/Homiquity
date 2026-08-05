import { DocumentItemRow, type DocRow } from "@/components/DocumentItemRow";
import type { UploadControls } from "./types";

/**
 * Renders a list of checklist rows against the shared upload controls.
 *
 * The static catalog and the personalized checklist both funnel through here,
 * which is the point: DocumentItemRow's contract says the two paths must never
 * render differently, and a single call site is the cheapest way to keep that
 * true.
 */
export function ChecklistRows({
  rows,
  upload,
}: {
  rows: { key: string; row: DocRow }[];
  upload: UploadControls;
}) {
  return (
    <div className="space-y-3">
      {rows.map(({ key, row }) => (
        <DocumentItemRow
          key={key}
          row={row}
          uploading={upload.activeUpload?.rowKey === row.uploadKey}
          uploadingFile={upload.activeUpload}
          progress={upload.progress}
          anyUploadBusy={upload.anyUploadBusy}
          onFile={(file) => upload.onFile(row, file)}
          onBrowse={() => upload.onBrowse(row)}
          onCancel={upload.onCancel}
        />
      ))}
    </div>
  );
}
