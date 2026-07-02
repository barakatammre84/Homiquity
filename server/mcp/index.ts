import "./bootstrap"; // must stay first: protects stdout + loads .env

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { and, desc, eq, gt, ilike } from "drizzle-orm";

import { db } from "../db";
import {
  creditConsents,
  creditPulls,
  loanApplications,
  properties,
  rateSheetProducts,
  rateSheets,
  users,
  wholesaleLenders,
} from "@shared/schema";
import { calculateLLPA } from "../pricing";
import { fetchAvm, softPullCredit, withTimeout } from "./vendors";

/**
 * Homiquity MCP server (stdio).
 *
 * Exposes the platform's lending engines as Model Context Protocol tools so
 * AI agents can run pre-qualification workflows against the real database.
 * Run locally:  npm run mcp   (tsx server/mcp/index.ts)
 *
 * Errors are returned as MCP tool errors (isError: true), which the SDK maps
 * onto JSON-RPC 2.0 — never as protocol-level crashes.
 */

const server = new McpServer({ name: "homiquity", version: "1.0.0" });

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}
function fail(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

// ---------------------------------------------------------------------------
// Tool 1: run_soft_credit_pull
// ---------------------------------------------------------------------------
server.registerTool(
  "run_soft_credit_pull",
  {
    title: "Run soft credit pull",
    description:
      "Soft (no-trigger-lead) tri-bureau credit check for a borrower. Returns a cached " +
      "non-expired soft pull when one exists; otherwise pulls via the bureau adapter and " +
      "persists scores, the liability ledger, and DTI. FCRA: refuses to pull without an " +
      "active soft-pull consent on file for the borrower.",
    inputSchema: {
      firstName: z.string().min(1).describe("Borrower legal first name"),
      lastName: z.string().min(1).describe("Borrower legal last name"),
      address: z.string().min(4).describe("Borrower current street address"),
      email: z.string().email().optional().describe("Disambiguates borrowers sharing a name"),
    },
  },
  async ({ firstName, lastName, address, email }) => {
    try {
      // 1. Resolve the borrower.
      const matches = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(
          and(
            ilike(users.firstName, firstName),
            ilike(users.lastName, lastName),
            ...(email ? [ilike(users.email, email)] : []),
          ),
        )
        .limit(5);
      if (matches.length === 0) return fail(`No borrower named "${firstName} ${lastName}" found.`);
      if (matches.length > 1) {
        return fail(
          `${matches.length} borrowers named "${firstName} ${lastName}" — pass the email parameter to disambiguate.`,
        );
      }
      const borrower = matches[0];

      // 2. Their most recent application (credit pulls attach to applications).
      const [application] = await db
        .select({
          id: loanApplications.id,
          annualIncome: loanApplications.annualIncome,
        })
        .from(loanApplications)
        .where(eq(loanApplications.userId, borrower.id))
        .orderBy(desc(loanApplications.createdAt))
        .limit(1);
      if (!application) {
        return fail("Borrower has no loan application; a soft pull must attach to an application.");
      }

      // 3. Cached, non-expired soft pull?
      const [existing] = await db
        .select()
        .from(creditPulls)
        .where(
          and(
            eq(creditPulls.applicationId, application.id),
            eq(creditPulls.pullType, "soft"),
            eq(creditPulls.status, "completed"),
            gt(creditPulls.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(creditPulls.requestedAt))
        .limit(1);
      const monthlyIncome = application.annualIncome ? Number(application.annualIncome) / 12 : null;
      if (existing) {
        const monthly = existing.monthlyPayments ? Number(existing.monthlyPayments) : null;
        return ok({
          cached: true,
          creditPullId: existing.id,
          representativeScore: existing.representativeScore,
          scores: {
            experian: existing.experianScore,
            equifax: existing.equifaxScore,
            transunion: existing.transunionScore,
            vantageScore4: existing.vantageScore4,
          },
          totalDebt: existing.totalDebt,
          monthlyLiabilities: existing.monthlyPayments,
          dti: monthly && monthlyIncome ? Number((monthly / monthlyIncome).toFixed(4)) : null,
          expiresAt: existing.expiresAt,
        });
      }

      // 4. FCRA gate: an active soft-pull consent must exist.
      const [consent] = await db
        .select({ id: creditConsents.id })
        .from(creditConsents)
        .where(
          and(
            eq(creditConsents.userId, borrower.id),
            eq(creditConsents.consentGiven, true),
            eq(creditConsents.isActive, true),
          ),
        )
        .orderBy(desc(creditConsents.consentTimestamp))
        .limit(1);
      if (!consent) {
        return fail(
          "FCRA: no active credit consent on file for this borrower. A soft pull cannot be " +
            "performed until the borrower completes the credit consent flow.",
        );
      }

      // 5. Pull via the bureau adapter and persist.
      const pull = await softPullCredit(firstName, lastName, address);
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // soft pulls: 90 days
      const [inserted] = await db
        .insert(creditPulls)
        .values({
          applicationId: application.id,
          consentId: consent.id,
          requestedBy: borrower.id,
          pullType: "soft",
          bureaus: ["experian", "equifax", "transunion"],
          status: "completed",
          externalRequestId: pull.vendorRequestId,
          experianScore: pull.experianScore,
          equifaxScore: pull.equifaxScore,
          transunionScore: pull.transunionScore,
          representativeScore: pull.representativeScore,
          vantageScore4: pull.vantageScore4,
          totalTradelines: pull.tradelines.length,
          openTradelines: pull.tradelines.length,
          totalDebt: pull.totalDebt.toFixed(2),
          monthlyPayments: pull.totalMonthlyPayments.toFixed(2),
          vendorRequestId: pull.vendorRequestId,
          completedAt: new Date(),
          expiresAt,
        })
        .returning({ id: creditPulls.id });

      return ok({
        cached: false,
        simulated: pull.simulated,
        creditPullId: inserted.id,
        representativeScore: pull.representativeScore,
        scores: {
          experian: pull.experianScore,
          equifax: pull.equifaxScore,
          transunion: pull.transunionScore,
          vantageScore4: pull.vantageScore4,
        },
        liabilityLedger: pull.tradelines,
        totalDebt: pull.totalDebt,
        monthlyLiabilities: pull.totalMonthlyPayments,
        dti: monthlyIncome ? Number((pull.totalMonthlyPayments / monthlyIncome).toFixed(4)) : null,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (err) {
      return fail(`run_soft_credit_pull failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 2: get_best_execution_rates
// ---------------------------------------------------------------------------

/** ΔM_geography in basis points by ZIP region (leading digit). Policy placeholder. */
const GEO_MARGIN_BPS: Record<string, number> = {
  "0": 5, "1": 5, "9": 5, // Northeast + West Coast: high-cost, competitive → thin margin bump
  "3": 10, "7": 10,       // Southeast + South Central: servicing-cost adjustment
};

function riskMarginBps(creditScore: number, ltv: number): number {
  let bps = 0;
  if (creditScore < 660) bps += 25;
  else if (creditScore < 700) bps += 15;
  else if (creditScore < 740) bps += 5;
  if (ltv > 90) bps += 10;
  return bps;
}

server.registerTool(
  "get_best_execution_rates",
  {
    title: "Get best-execution rates",
    description:
      "Best-execution pricing across active wholesale investors from the live rate sheets. " +
      "Applies the layered margin formula P_borrower = R_investor + M_base + ΔM_risk + ΔM_geography, " +
      "with LLPA (loan-level price adjustments) computed from the platform's pricing matrices.",
    inputSchema: {
      creditScore: z.number().int().min(300).max(850).describe("Representative credit score"),
      ltv: z.number().min(1).max(105).describe("Loan-to-value ratio, percent (e.g. 85)"),
      zipCode: z.string().regex(/^\d{5}$/).describe("Subject property ZIP code"),
      loanAmount: z.number().positive().describe("Requested loan amount in USD"),
      productType: z.string().optional().describe("Filter, e.g. CONVENTIONAL, FHA, VA"),
    },
  },
  async ({ creditScore, ltv, zipCode, loanAmount, productType }) => {
    try {
      const rows = await withTimeout(
        db
          .select({
            lenderName: wholesaleLenders.lenderName,
            lenderCode: wholesaleLenders.lenderCode,
            productCode: rateSheetProducts.productCode,
            productName: rateSheetProducts.productName,
            productType: rateSheetProducts.productType,
            loanTerm: rateSheetProducts.loanTerm,
            baseRate: rateSheetProducts.baseRate,
            effectiveDate: rateSheets.effectiveDate,
          })
          .from(rateSheetProducts)
          .innerJoin(rateSheets, eq(rateSheetProducts.rateSheetId, rateSheets.id))
          .innerJoin(wholesaleLenders, eq(rateSheets.lenderId, wholesaleLenders.id))
          .orderBy(desc(rateSheets.effectiveDate)),
        "rate sheet query",
      );
      const filtered = productType
        ? rows.filter((r) => r.productType.toUpperCase() === productType.toUpperCase())
        : rows;
      if (filtered.length === 0) return fail("No rate sheet products found (check productType filter / seed data).");

      // Newest sheet per lender+product only.
      const latest = new Map<string, (typeof filtered)[number]>();
      for (const r of filtered) {
        const key = `${r.lenderCode}:${r.productCode}`;
        if (!latest.has(key)) latest.set(key, r);
      }

      const llpa = await calculateLLPA(loanAmount, creditScore, ltv);
      const mBaseBps = Number(process.env.PRICING_MARGIN_BASE_BPS ?? 25);
      const mRiskBps = riskMarginBps(creditScore, ltv);
      const mGeoBps = GEO_MARGIN_BPS[zipCode[0]] ?? 0;
      // LLPA is quoted in price points; ~4 points ≈ 1% rate is the standard rough conversion.
      const llpaRateAdj = llpa.totalLLPA / 4;

      const offers = [...latest.values()]
        .map((r) => {
          const rInvestor = Number(r.baseRate);
          const borrowerRate = rInvestor + mBaseBps / 100 + mRiskBps / 100 + mGeoBps / 100 + llpaRateAdj;
          return {
            lender: r.lenderName,
            lenderCode: r.lenderCode,
            product: r.productName,
            productType: r.productType,
            termYears: Math.round(r.loanTerm / 12),
            rateSheetDate: r.effectiveDate,
            pricing: {
              rInvestor,
              mBasePct: mBaseBps / 100,
              mRiskPct: mRiskBps / 100,
              mGeographyPct: mGeoBps / 100,
              llpaPoints: llpa.totalLLPA,
              llpaRateEquivalentPct: Number(llpaRateAdj.toFixed(4)),
            },
            borrowerRate: Number(borrowerRate.toFixed(3)),
          };
        })
        .sort((a, b) => a.borrowerRate - b.borrowerRate)
        .slice(0, 8);

      return ok({
        formula: "P_borrower = R_investor + M_base + ΔM_risk + ΔM_geography (+ LLPA/4)",
        inputs: { creditScore, ltv, zipCode, loanAmount, productType: productType ?? "all" },
        bestExecution: offers[0],
        offers,
      });
    } catch (err) {
      return fail(`get_best_execution_rates failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 3: retrieve_property_valuation
// ---------------------------------------------------------------------------
server.registerTool(
  "retrieve_property_valuation",
  {
    title: "Retrieve property valuation (AVM)",
    description:
      "Automated Valuation Model estimate for a property address (HouseCanary-style). " +
      "Persists the estimated market value and confidence score onto the matching " +
      "properties row when one exists.",
    inputSchema: {
      address: z.string().min(4).describe("Street address, e.g. '123 Main St'"),
      zipCode: z.string().regex(/^\d{5}$/).optional().describe("ZIP code, improves matching"),
    },
  },
  async ({ address, zipCode }) => {
    try {
      const avm = await fetchAvm(address, zipCode);

      const [property] = await db
        .select({ id: properties.id, address: properties.address, zip: properties.zipCode })
        .from(properties)
        .where(
          zipCode
            ? and(ilike(properties.address, `%${address}%`), eq(properties.zipCode, zipCode))
            : ilike(properties.address, `%${address}%`),
        )
        .limit(1);

      if (property) {
        await db
          .update(properties)
          .set({
            avmValue: avm.estimatedValue.toFixed(2),
            avmConfidence: avm.confidence.toFixed(4),
            avmProvider: avm.provider,
            avmAsOf: new Date(avm.asOf),
          })
          .where(eq(properties.id, property.id));
      }

      return ok({
        simulated: avm.simulated,
        provider: avm.provider,
        address,
        estimatedValue: avm.estimatedValue,
        confidence: avm.confidence,
        valueRange: { low: avm.valueLow, high: avm.valueHigh },
        asOf: avm.asOf,
        persistedToPropertyId: property?.id ?? null,
      });
    } catch (err) {
      return fail(`retrieve_property_valuation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
);

// ---------------------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[homiquity-mcp] serving 3 tools over stdio");
