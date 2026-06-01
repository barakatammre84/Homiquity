import { db } from "../db";
import {
  borrowerStateHistory,
  users,
  type BorrowerState,
  type TransitionTrigger,
  BORROWER_STATES,
  TRANSITION_TRIGGERS,
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

interface StateTransitionRule {
  from: BorrowerState[];
  to: BorrowerState;
  triggers: TransitionTrigger[];
}

const VALID_TRANSITIONS: StateTransitionRule[] = [
  { from: ["lead"], to: "exploring", triggers: ["account_created", "goal_set"] },
  { from: ["exploring"], to: "profiling", triggers: ["profile_completed", "application_started"] },
  { from: ["profiling"], to: "pre_qualification", triggers: ["application_submitted", "credit_pulled"] },
  { from: ["pre_qualification"], to: "pre_approval", triggers: ["pre_qual_issued", "pre_approval_issued", "documents_uploaded"] },
  { from: ["pre_approval"], to: "property_search", triggers: ["pre_approval_issued", "property_selected"] },
  { from: ["property_search"], to: "in_contract", triggers: ["offer_accepted"] },
  { from: ["in_contract"], to: "underwriting", triggers: ["underwriting_submitted"] },
  { from: ["underwriting"], to: "conditional_approval", triggers: ["conditions_cleared"] },
  { from: ["conditional_approval"], to: "clear_to_close", triggers: ["clear_to_close_issued"] },
  { from: ["clear_to_close"], to: "closing", triggers: ["closing_scheduled"] },
  { from: ["closing"], to: "funded", triggers: ["funded"] },
  { from: ["funded"], to: "homeowner", triggers: ["funded"] },
  { from: ["exploring", "profiling", "pre_qualification", "pre_approval", "property_search", "in_contract", "underwriting"], to: "withdrawn", triggers: ["borrower_withdrew"] },
  { from: ["pre_qualification", "pre_approval", "underwriting", "conditional_approval"], to: "denied", triggers: ["application_denied"] },
  { from: ["pre_qualification", "pre_approval", "property_search"], to: "expired", triggers: ["application_expired"] },
];

export async function getCurrentState(userId: string): Promise<BorrowerState> {
  const [latest] = await db.select({ toState: borrowerStateHistory.toState })
    .from(borrowerStateHistory)
    .where(eq(borrowerStateHistory.userId, userId))
    .orderBy(desc(borrowerStateHistory.transitionedAt))
    .limit(1);
  return (latest?.toState as BorrowerState) || "lead";
}

export async function getStateHistory(userId: string) {
  return db.select()
    .from(borrowerStateHistory)
    .where(eq(borrowerStateHistory.userId, userId))
    .orderBy(desc(borrowerStateHistory.transitionedAt));
}

export function isValidTransition(fromState: BorrowerState, toState: BorrowerState, trigger: TransitionTrigger): boolean {
  if (trigger === "manual_override") return true;

  return VALID_TRANSITIONS.some(rule =>
    rule.to === toState &&
    rule.from.includes(fromState) &&
    rule.triggers.includes(trigger)
  );
}

export function getAvailableTransitions(currentState: BorrowerState): Array<{ toState: BorrowerState; triggers: TransitionTrigger[] }> {
  return VALID_TRANSITIONS
    .filter(rule => rule.from.includes(currentState))
    .map(rule => ({ toState: rule.to, triggers: rule.triggers }));
}

export async function transitionState(
  userId: string,
  toState: BorrowerState,
  trigger: TransitionTrigger,
  options?: {
    applicationId?: string;
    triggeredByUserId?: string;
    metadata?: Record<string, any>;
  }
): Promise<{ success: boolean; fromState: BorrowerState; toState: BorrowerState; error?: string }> {
  const fromState = await getCurrentState(userId);

  if (fromState === toState) {
    return { success: true, fromState, toState };
  }

  if (!isValidTransition(fromState, toState, trigger)) {
    return {
      success: false,
      fromState,
      toState,
      error: `Invalid transition from ${fromState} to ${toState} via trigger ${trigger}`,
    };
  }

  const [latestRecord] = await db.select({ transitionedAt: borrowerStateHistory.transitionedAt })
    .from(borrowerStateHistory)
    .where(eq(borrowerStateHistory.userId, userId))
    .orderBy(desc(borrowerStateHistory.transitionedAt))
    .limit(1);

  const durationMinutes = latestRecord?.transitionedAt
    ? Math.floor((Date.now() - new Date(latestRecord.transitionedAt).getTime()) / 60000)
    : null;

  await db.insert(borrowerStateHistory).values({
    userId,
    applicationId: options?.applicationId || null,
    fromState,
    toState,
    trigger,
    triggerMetadata: options?.metadata || null,
    triggeredByUserId: options?.triggeredByUserId || null,
    triggeredBySystem: !options?.triggeredByUserId,
    durationInPreviousStateMinutes: durationMinutes,
  });

  return { success: true, fromState, toState };
}

export async function initializeBorrowerState(userId: string): Promise<void> {
  const current = await getCurrentState(userId);
  if (current !== "lead") return;

  await db.insert(borrowerStateHistory).values({
    userId,
    fromState: null,
    toState: "lead",
    trigger: "account_created",
    triggeredBySystem: true,
  });
}

export function getStateMetadata(state: BorrowerState): {
  label: string;
  description: string;
  progressPercent: number;
  phase: "pre_application" | "application" | "processing" | "closing" | "post_closing" | "terminal";
} {
  const metadata: Record<BorrowerState, ReturnType<typeof getStateMetadata>> = {
    lead: { label: "New Lead", description: "Just getting started", progressPercent: 0, phase: "pre_application" },
    exploring: { label: "Exploring", description: "Browsing and learning", progressPercent: 5, phase: "pre_application" },
    profiling: { label: "Building Profile", description: "Providing financial details", progressPercent: 15, phase: "pre_application" },
    pre_qualification: { label: "Pre-Qualification", description: "Initial eligibility check", progressPercent: 25, phase: "application" },
    pre_approval: { label: "Pre-Approved", description: "Ready to shop", progressPercent: 35, phase: "application" },
    property_search: { label: "Property Search", description: "Finding the right home", progressPercent: 45, phase: "application" },
    in_contract: { label: "In Contract", description: "Offer accepted", progressPercent: 55, phase: "processing" },
    underwriting: { label: "Underwriting", description: "Under review", progressPercent: 65, phase: "processing" },
    conditional_approval: { label: "Conditional Approval", description: "Clearing conditions", progressPercent: 80, phase: "processing" },
    clear_to_close: { label: "Clear to Close", description: "Final preparations", progressPercent: 90, phase: "closing" },
    closing: { label: "Closing", description: "Signing documents", progressPercent: 95, phase: "closing" },
    funded: { label: "Funded", description: "Loan funded", progressPercent: 100, phase: "post_closing" },
    homeowner: { label: "Homeowner", description: "Congratulations!", progressPercent: 100, phase: "post_closing" },
    withdrawn: { label: "Withdrawn", description: "Application withdrawn", progressPercent: 0, phase: "terminal" },
    denied: { label: "Denied", description: "Application denied", progressPercent: 0, phase: "terminal" },
    expired: { label: "Expired", description: "Application expired", progressPercent: 0, phase: "terminal" },
  };
  return metadata[state];
}

export async function getStateDurationAnalytics(userId: string): Promise<Record<string, number>> {
  const history = await getStateHistory(userId);
  const durations: Record<string, number> = {};
  for (const entry of history) {
    if (entry.fromState && entry.durationInPreviousStateMinutes) {
      durations[entry.fromState] = (durations[entry.fromState] || 0) + entry.durationInPreviousStateMinutes;
    }
  }
  return durations;
}
