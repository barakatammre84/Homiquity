// One implementation of "turn this fetch Response into a downloaded file".
//
// This sequence — read the blob, mint an object URL, click a synthetic anchor,
// revoke the URL — was hand-copied into seven call sites (pre-qual and
// pre-approval letters, MISMO export, adverse-action notices). Two of those
// copies omitted the appendChild/remove step, which Firefox requires for a
// programmatic click to fire; centralizing here makes every download take the
// safe path and keeps object URLs from leaking on the error path.

/**
 * Download the body of an already-resolved `Response` as `filename`.
 *
 * Throws whatever `res.blob()` throws — callers own the user-facing error
 * message, since the right copy differs per surface.
 */
export async function downloadResponseAsFile(res: Response, filename: string): Promise<void> {
  const blob = await res.blob();
  downloadBlobAsFile(blob, filename);
}

/** Download an in-memory blob as `filename`. */
export function downloadBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    // Firefox will not dispatch the click unless the anchor is in the document.
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Always revoke — an exception mid-click would otherwise leak the URL for
    // the lifetime of the document.
    URL.revokeObjectURL(url);
  }
}
