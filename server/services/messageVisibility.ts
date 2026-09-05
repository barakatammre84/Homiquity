import type { TeamMessage } from "@shared/schema";

/** Mutable loan-file state that can change after the historical message was sent. */
const APPLICATION_DERIVED_REQUEST_FIELDS = new Set([
  "status",
  "documentId",
  "rejectionReason",
  "respondedAt",
  "reviewedAt",
]);

/**
 * Keep the immutable historical request context while withholding later
 * loan-file state after a participant loses current application access.
 */
export function toMessageViewForApplicationAccess(
  message: TeamMessage,
  accessibleApplicationIds: ReadonlySet<string>,
): TeamMessage {
  if (
    !message.applicationId ||
    accessibleApplicationIds.has(message.applicationId) ||
    !message.documentRequestData ||
    typeof message.documentRequestData !== "object"
  ) {
    return message;
  }

  const requestData = message.documentRequestData as Record<string, unknown>;
  const safeRequestData = Object.fromEntries(
    Object.entries(requestData).filter(
      ([key]) => !APPLICATION_DERIVED_REQUEST_FIELDS.has(key),
    ),
  );
  return {
    ...message,
    documentRequestData: safeRequestData,
  };
}
