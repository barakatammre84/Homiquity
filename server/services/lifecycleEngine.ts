import { db } from "../db";
import {
  equitySnapshots,
  homeownerProfiles,
  loanApplications,
  loanOptions,
  mortgageRatePrograms,
  mortgageRates,
  refiAlerts,
  type HomeownerProfile,
} from "@shared/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { storage } from "../storage";
import { fetchAvm } from "../mcp/vendors";

/**
 * Lifecycle engine — the "evergreen client" automation (CTO_ROADMAP #9).
 *
 * Two entry points:
 * - runLifecycleSweep(): the daily job (Vercel cron → /api/jobs/lifecycle).
 *   For every homeowner profile: AVM-refresh the value, record an equity
 *   snapshot (one per day, idempotent), raise the 80%-LTV PMI-removal alert
 *   when the threshold is crossed, and raise a refi alert when the market
 *   rate for a 30-year fixed sits at least 25 bps below the homeowner's rate.
 * - graduateClosedLoan(applicationId): the event hook fired when a loan
 *   reaches "funded" — creates the homeowner profile from the closed loan so
 *   the Portfolio surface lights up without anyone typing anything.
 *
 * All vendor data (AVM) comes through the same simulated-until-contracted
 * adapters as everything else; when HOUSECANARY_API_KEY lands, this engine
 * starts producing real valuations with zero changes here.
 */

export const PMI_REMOVAL_LTV_THRESHOLD = 80;
export const REFI_ALERT_RATE_DROP = 0.25; // percentage points below current rate

const toNum = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return NaN;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[,$]/g, ""));
  return isNaN(n) ? NaN : n;
};

/** Standard amortized monthly P&I payment. */
export function monthlyPayment(principal: number, annualRatePct: number, termMonths = 360): number {
  if (principal <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

/**
 * Estimated remaining balance after `monthsElapsed` of payments on a
 * standard 30-year amortization schedule.
 */
export function estimateRemainingBalance(
  originalAmount: number,
  annualRatePct: number,
  monthsElapsed: number,
  termMonths = 360,
): number {
  if (originalAmount <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = Math.min(Math.max(monthsElapsed, 0), termMonths);
  if (r === 0) return originalAmount * (1 - n / termMonths);
  const growth = Math.pow(1 + r, n);
  const fullGrowth = Math.pow(1 + r, termMonths);
  return originalAmount * ((fullGrowth - growth) / (fullGrowth - 1));
}

export interface RefiMath {
  currentPayment: number;
  marketPayment: number;
  monthlySavings: number;
  lifetimeSavings: number;
}

/** Savings from refinancing the remaining balance at the market rate. */
export function computeRefiSavings(
  balance: number,
  currentRatePct: number,
  marketRatePct: number,
  termMonths = 360,
): RefiMath {
  const currentPayment = monthlyPayment(balance, currentRatePct, termMonths);
  const marketPayment = monthlyPayment(balance, marketRatePct, termMonths);
  const monthlySavings = currentPayment - marketPayment;
  return {
    currentPayment,
    marketPayment,
    monthlySavings,
    lifetimeSavings: monthlySavings * termMonths,
  };
}

/** Latest active 30-year fixed rate, or null when no rate data is loaded. */
export async function getMarketRate30YrFixed(): Promise<number | null> {
  const [row] = await db
    .select({ rate: mortgageRates.rate })
    .from(mortgageRates)
    .innerJoin(mortgageRatePrograms, eq(mortgageRates.programId, mortgageRatePrograms.id))
    .where(
      and(
        eq(mortgageRates.isActive, true),
        eq(mortgageRatePrograms.termYears, 30),
        eq(mortgageRatePrograms.isAdjustable, false),
      ),
    )
    .orderBy(desc(mortgageRates.effectiveDate))
    .limit(1);
  const rate = toNum(row?.rate);
  return isNaN(rate) ? null : rate;
}

interface SweepResult {
  profilesProcessed: number;
  snapshotsCreated: number;
  pmiAlerts: number;
  refiAlertsCreated: number;
  errors: number;
}

async function sweepProfile(
  profile: HomeownerProfile,
  marketRate: number | null,
  counters: SweepResult,
): Promise<void> {
  // --- Value: AVM refresh (simulated until a contract lands) ---------------
  let estimatedValue = toNum(profile.propertyValue);
  if (profile.propertyAddress) {
    try {
      const avm = await fetchAvm(profile.propertyAddress);
      if (avm?.estimatedValue && avm.estimatedValue > 0) estimatedValue = avm.estimatedValue;
    } catch {
      // Keep the stored value — an AVM hiccup must not kill the sweep.
    }
  }

  // --- Balance: stored figure, aged along the amortization curve -----------
  const originalAmount = toNum(profile.originalLoanAmount);
  const rate = toNum(profile.interestRate);
  let balance = toNum(profile.currentLoanBalance);
  if (isNaN(balance) && !isNaN(originalAmount) && !isNaN(rate) && profile.loanCloseDate) {
    const monthsElapsed = Math.floor(
      (Date.now() - new Date(profile.loanCloseDate).getTime()) / (30.44 * 24 * 3600 * 1000),
    );
    balance = estimateRemainingBalance(originalAmount, rate, monthsElapsed);
  }
  if (isNaN(estimatedValue) || estimatedValue <= 0 || isNaN(balance)) return;

  const equityAmount = estimatedValue - balance;
  const equityPercent = (equityAmount / estimatedValue) * 100;
  const ltv = (balance / estimatedValue) * 100;

  // --- Snapshot (idempotent: at most one per profile per day) --------------
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [todays] = await db
    .select({ id: equitySnapshots.id })
    .from(equitySnapshots)
    .where(
      and(
        eq(equitySnapshots.homeownerProfileId, profile.id),
        gte(equitySnapshots.snapshotDate, startOfDay),
      ),
    )
    .limit(1);
  if (todays) return;

  // Previous snapshot BEFORE inserting — needed for threshold-crossing checks.
  const [previous] = await db
    .select({ equityPercent: equitySnapshots.equityPercent })
    .from(equitySnapshots)
    .where(eq(equitySnapshots.homeownerProfileId, profile.id))
    .orderBy(desc(equitySnapshots.snapshotDate))
    .limit(1);
  const previousLtv = previous ? 100 - toNum(previous.equityPercent) : null;

  await db.insert(equitySnapshots).values({
    homeownerProfileId: profile.id,
    snapshotDate: new Date(),
    estimatedValue: estimatedValue.toFixed(2),
    loanBalance: balance.toFixed(2),
    equityAmount: equityAmount.toFixed(2),
    equityPercent: equityPercent.toFixed(2),
  });
  counters.snapshotsCreated += 1;

  // --- Signal: 80% LTV crossed → PMI removal may be available --------------
  const crossedThreshold =
    ltv <= PMI_REMOVAL_LTV_THRESHOLD &&
    (previousLtv === null || previousLtv > PMI_REMOVAL_LTV_THRESHOLD);
  if (crossedThreshold) {
    await storage.createNotification({
      userId: profile.userId,
      type: "equity_milestone",
      title: "You may be able to remove PMI",
      body: `Your estimated loan-to-value just reached ${ltv.toFixed(1)}% — at or below the 80% threshold where private mortgage insurance can often be removed. Open your Homeowner Hub to review the numbers.`,
      entityType: "homeowner_profile",
      entityId: profile.id,
      metadata: { ltv: Number(ltv.toFixed(2)), estimatedValue, balance },
    });
    counters.pmiAlerts += 1;
  }

  // --- Signal: market rate ≥25bps below the homeowner's rate → refi alert --
  if (marketRate !== null && !isNaN(rate) && marketRate <= rate - REFI_ALERT_RATE_DROP) {
    const [openAlert] = await db
      .select({ id: refiAlerts.id })
      .from(refiAlerts)
      .where(
        and(
          eq(refiAlerts.homeownerProfileId, profile.id),
          eq(refiAlerts.isDismissed, false),
          sql`${refiAlerts.marketRate} <= ${marketRate.toFixed(3)}`,
        ),
      )
      .limit(1);
    if (!openAlert) {
      const savings = computeRefiSavings(balance, rate, marketRate);
      await db.insert(refiAlerts).values({
        homeownerProfileId: profile.id,
        currentRate: rate.toFixed(3),
        marketRate: marketRate.toFixed(3),
        potentialSavingsMonthly: savings.monthlySavings.toFixed(2),
        potentialSavingsLifetime: savings.lifetimeSavings.toFixed(2),
        isActionable: true,
      });
      await storage.createNotification({
        userId: profile.userId,
        type: "refi_opportunity",
        title: "Rates dipped below your mortgage rate",
        body: `30-year rates are at ${marketRate.toFixed(3)}% — ${(rate - marketRate).toFixed(2)} points below your ${rate.toFixed(3)}%. Refinancing could save about $${Math.round(savings.monthlySavings).toLocaleString()}/month. See your Homeowner Hub for the breakdown.`,
        entityType: "homeowner_profile",
        entityId: profile.id,
        metadata: { currentRate: rate, marketRate, monthlySavings: Math.round(savings.monthlySavings) },
      });
      counters.refiAlertsCreated += 1;
    }
  }
}

/** The daily sweep. Safe to run repeatedly — every write path is idempotent. */
export async function runLifecycleSweep(): Promise<SweepResult> {
  const counters: SweepResult = {
    profilesProcessed: 0,
    snapshotsCreated: 0,
    pmiAlerts: 0,
    refiAlertsCreated: 0,
    errors: 0,
  };

  const marketRate = await getMarketRate30YrFixed();
  const profiles = await db.select().from(homeownerProfiles);

  for (const profile of profiles) {
    counters.profilesProcessed += 1;
    try {
      await sweepProfile(profile, marketRate, counters);
    } catch (err) {
      counters.errors += 1;
      console.error(`[lifecycle] Sweep failed for profile ${profile.id} (continuing):`, err);
    }
  }

  console.log(
    `[lifecycle] Sweep complete: ${counters.profilesProcessed} profiles, ` +
      `${counters.snapshotsCreated} snapshots, ${counters.pmiAlerts} PMI alerts, ` +
      `${counters.refiAlertsCreated} refi alerts, ${counters.errors} errors` +
      (marketRate === null ? " (no market rate data — refi checks skipped)" : ""),
  );
  return counters;
}

/**
 * Graduation hook: when a loan funds, materialize the homeowner profile from
 * the closed loan (locked option preferred for rate/payment) so the Portfolio
 * surface works from day one. Idempotent — an existing profile is left alone.
 */
export async function graduateClosedLoan(applicationId: string): Promise<void> {
  const [application] = await db
    .select()
    .from(loanApplications)
    .where(eq(loanApplications.id, applicationId))
    .limit(1);
  if (!application) return;

  const existing = await storage.getHomeownerProfile(application.userId);
  if (existing) return;

  const [locked] = await db
    .select()
    .from(loanOptions)
    .where(and(eq(loanOptions.applicationId, applicationId), eq(loanOptions.isLocked, true)))
    .orderBy(desc(loanOptions.lockedAt))
    .limit(1);

  const purchasePrice = toNum(application.purchasePrice);
  const downPayment = toNum(application.downPayment);
  const loanAmount = locked
    ? toNum(locked.loanAmount)
    : !isNaN(purchasePrice) && !isNaN(downPayment)
      ? purchasePrice - downPayment
      : NaN;

  await storage.createHomeownerProfile({
    userId: application.userId,
    originalLoanAmount: isNaN(loanAmount) ? null : loanAmount.toFixed(2),
    currentLoanBalance: isNaN(loanAmount) ? null : loanAmount.toFixed(2),
    interestRate: locked ? String(locked.interestRate) : null,
    monthlyPayment: locked ? String(locked.monthlyPayment) : null,
    propertyValue: isNaN(purchasePrice) ? null : purchasePrice.toFixed(2),
    purchasePrice: isNaN(purchasePrice) ? null : purchasePrice.toFixed(2),
    purchaseDate: new Date(),
    loanCloseDate: new Date(),
    propertyAddress: application.propertyAddress ?? null,
  });

  await storage.createNotification({
    userId: application.userId,
    type: "loan_funded",
    title: "Welcome to your Homeowner Hub",
    body: "Congratulations on closing! Your Homeowner Hub now tracks your equity, watches rates for refinance opportunities, and alerts you the moment PMI removal becomes possible.",
    entityType: "loan_application",
    entityId: applicationId,
  });

  await storage.createDealActivity({
    applicationId,
    activityType: "note",
    title: "Homeowner Hub activated",
    description: "Loan funded — homeowner profile created automatically; lifecycle monitoring (equity, refi, PMI) is now active.",
    performedBy: application.userId,
  });

  console.log(`[lifecycle] Graduated application ${applicationId} → homeowner profile created`);
}
