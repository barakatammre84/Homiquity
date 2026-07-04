import { db } from "../db";
import { coachConversations, coachMessages, type CoachConversation } from "@shared/schema";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

/**
 * Single source for reading a user's coach-conversation intake snapshots.
 *
 * The "walk a user's conversations newest-first, and within each walk the
 * assistant messages newest-first, collecting every `structuredData.intake`"
 * traversal was copy-pasted into the coach intake endpoint and the pre-fill
 * engine — each re-fetching messages one conversation at a time (an N+1).
 * This does it in TWO queries total (conversations + one batched message
 * fetch) and returns the intake objects in the exact visitation order the old
 * nested loops produced, so callers keep their own (deliberately different)
 * merge logic unchanged.
 */
export interface CoachIntakeSnapshots {
  /** Every `structuredData.intake` object, ordered newest-conversation → newest-message. */
  snapshots: Record<string, unknown>[];
  /** The user's conversations, newest-first (updatedAt desc) — reused by callers that also need conversation-level fields. */
  conversations: CoachConversation[];
}

export async function getCoachIntakeSnapshots(userId: string): Promise<CoachIntakeSnapshots> {
  const conversations = await db
    .select()
    .from(coachConversations)
    .where(eq(coachConversations.userId, userId))
    .orderBy(desc(coachConversations.updatedAt));

  if (conversations.length === 0) return { snapshots: [], conversations };

  // One batched query instead of one-per-conversation.
  const messages = await db
    .select()
    .from(coachMessages)
    .where(
      and(
        inArray(
          coachMessages.conversationId,
          conversations.map((c) => c.id),
        ),
        eq(coachMessages.role, "assistant"),
        isNotNull(coachMessages.structuredData),
      ),
    )
    .orderBy(desc(coachMessages.createdAt));

  // Group by conversation, preserving the newest-first message order above.
  const byConversation = new Map<string, typeof messages>();
  for (const message of messages) {
    const bucket = byConversation.get(message.conversationId) ?? [];
    bucket.push(message);
    byConversation.set(message.conversationId, bucket);
  }

  // Visit conversations newest-first; within each, messages newest-first —
  // identical to the old `for (conv of sorted) { for (msg of assistantMsgs) }`.
  const snapshots: Record<string, unknown>[] = [];
  for (const conversation of conversations) {
    for (const message of byConversation.get(conversation.id) ?? []) {
      const intake = (message.structuredData as { intake?: Record<string, unknown> } | null)?.intake;
      if (intake) snapshots.push(intake);
    }
  }

  return { snapshots, conversations };
}
