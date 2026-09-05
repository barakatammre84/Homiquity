import { useCallback, useRef, useState } from "react";
import { friendlyApiError } from "@/lib/errorMessage";
import { apiRequest } from "@/lib/queryClient";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: UploadMetadata;
  uploadHeaders?: Record<string, string>;
}

export function headersForPresignedUpload(
  file: Pick<File, "type">,
  uploadHeaders: Record<string, string> = {},
) {
  return {
    "Content-Type": file.type || "application/octet-stream",
    ...uploadHeaders,
  };
}

interface UseUploadOptions {
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/** Thrown internally when the user cancels the in-flight PUT via cancel(). */
export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

/**
 * React hook for handling file uploads with presigned URLs.
 *
 * Two-step presigned URL flow:
 * 1. Request a presigned URL from the backend (sends JSON metadata, NOT the file)
 * 2. PUT the file directly to the presigned URL via XMLHttpRequest — XHR (not
 *    fetch) because `xhr.upload.onprogress` is the only way to get real
 *    byte-level progress, and `xhr.abort()` gives the user a working Cancel.
 *
 * `progress` is real (0–100, from bytes on the wire). `cancel()` aborts the
 * in-flight PUT; `uploadFile` then resolves `null` with `isCancelled` set and
 * `error` left null — a user cancel is not a failure, so onError is not fired.
 *
 * @example
 * ```tsx
 * const { uploadFile, isUploading, progress, cancel } = useUpload();
 * const stored = await uploadFile(file); // null on failure OR cancel
 * ```
 */
interface UseUploadReturn {
  uploadFile: (file: File) => Promise<UploadResponse | null>;
  isUploading: boolean;
  error: Error | null;
  /** Real byte-level progress of the storage PUT, 0–100. */
  progress: number;
  /** Abort the in-flight PUT. No-op when nothing is uploading. */
  cancel: () => void;
  /** True when the last upload ended because the user cancelled it. */
  isCancelled: boolean;
}

export function useUpload(options: UseUploadOptions = {}): UseUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const [isCancelled, setIsCancelled] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  /**
   * Request a presigned URL from the backend.
   * IMPORTANT: Send JSON metadata, NOT the file itself.
   */
  const requestUploadUrl = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const response = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      }).catch((err: unknown) => {
        throw new Error(friendlyApiError(err, "Failed to get upload URL"));
      });

      return response.json();
    },
    []
  );

  /**
   * PUT the file directly to the presigned URL, reporting real progress.
   * The returned headers are part of the V4 signature. They bind Content-Type
   * and make the object create-only, so a successful upload URL cannot later
   * overwrite the bytes that document review fingerprinted.
   */
  const uploadToPresignedUrl = useCallback(
    (file: File, uploadURL: string, uploadHeaders?: Record<string, string>): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", uploadURL);
        for (const [name, value] of Object.entries(headersForPresignedUpload(file, uploadHeaders))) {
          xhr.setRequestHeader(name, value);
        }
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("Failed to upload file to storage"));
          }
        };
        xhr.onerror = () => reject(new Error("Failed to upload file to storage"));
        xhr.onabort = () => reject(new UploadCancelledError());
        xhr.send(file);
      });
    },
    []
  );

  const cancel = useCallback(() => {
    xhrRef.current?.abort();
  }, []);

  /**
   * Upload a file using the presigned URL flow.
   *
   * @param file - The file to upload
   * @returns The upload response, or null on failure/cancel (check isCancelled)
   */
  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setIsCancelled(false);
      setProgress(0);

      try {
        // Step 1: Request presigned URL (send metadata as JSON)
        const uploadResponse = await requestUploadUrl(file);

        // Step 2: PUT the file to the presigned URL (real progress + cancel)
        await uploadToPresignedUrl(file, uploadResponse.uploadURL, uploadResponse.uploadHeaders);

        setProgress(100);
        options.onSuccess?.(uploadResponse);
        return uploadResponse;
      } catch (err) {
        if (err instanceof UploadCancelledError) {
          // A user cancel is not a failure: no error state, no onError. A
          // cancelled PUT leaves no document row — registration never runs.
          setIsCancelled(true);
          return null;
        }
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        xhrRef.current = null;
        setIsUploading(false);
      }
    },
    [requestUploadUrl, uploadToPresignedUrl, options]
  );

  return {
    uploadFile,
    isUploading,
    error,
    progress,
    cancel,
    isCancelled,
  };
}
