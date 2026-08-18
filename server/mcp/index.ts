import "./bootstrap"; // must stay first: protects stdout + loads .env

import { createHash } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { and, desc, eq, ilike } from "drizzle-orm";

import { db } from "../db";
import {
  loanApplications,
  properties,
  rateSheetProducts,
  rateSheets,
  users,
  wholesaleLenders,
} from "@shared/schema";
import { isZipInLicensedStates, unlicensedStateMessage } from "@shared/companyIdentity";
import { calculateLLPA } from "../pricing";
import {
  logAgentToolInvocation,
  recordExternalSoftPull,
} from "../services/creditService";
import {
  assertDeploymentAllowed,
  resolveAgentIdentity,
  type AgentIdentity,
} from "./identity";
import { evaluateSoftPull } from "./softPullGate";
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
 *
 * AG-1 (AI governance): every tool invocation is chained into the
 * tamper-evident credit_audit_log via creditService — soft-pull persistence
 * goes through recordExternalSoftPull (chained pull_requested/pull_completed),
 * and each terminal outcome additionally writes an mcp_tool_invocation entry
 * carrying the tool name, an SHA-256 hash of the arguments, and a result
 * summary.
 *
 * AG-2 (AI governance): the deployment authenticates WHICH agent it serves —
 * MCP_AGENT_ID + MCP_AGENT_TOKEN validated against the env-scoped
 * MCP_AGENT_REGISTRY (see ./identity). The resolved identity (agent, operator,
 * authenticated flag, plus the client's self-reported initialize info) is
 * stamped onto every audit entry and persisted row. Production, or
 * MCP_REQUIRE_AGENT_IDENTITY=true, refuses to serve without a valid handshake.
 */

const server = new McpServer({ name: "homiquity", version: "1.0.0" });

// AG-2: resolve and enforce the agent identity BEFORE any tool can run. A
// failed handshake or an unauthenticated agent under enforcement is a startup
// configuration error (like a missing DATABASE_URL), not a tool error.
let AGENT: AgentIdentity;
try {
  AGENT = resolveAgentIdentity(process.env);
  assertDeploymentAllowed(AGENT, process.env);
} catch (err) {
  console.error(`[homiquity-mcp] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
const CALLER_IDENTITY = AGENT.callerIdentity;

/** Identity context stamped into every audit entry's actionDetails. The MCP
 * client's initialize clientInfo is self-reported — recorded, not trusted. */
function agentContext(): Record<string, unknown> {
  const client = server.server.getClientVersion();
  return {
    agentId: AGENT.agentId,
    operator: AGENT.operator,
    authenticated: AGENT.authenticated,
    ...(client ? { client: { name: client.name, version: client.version } } : {}),
  };
}

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}
function fail(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

function hashToolArgs(args: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(args)).digest("hex");
}

/**
 * Invocation-level audit entry, best-effort: an audit-write failure must not
 * mask the tool result it describes, so it is reported on stderr only (stdout
 * is owned by JSON-RPC). The FCRA-material entries for an actual pull are
 * written in-band by recordExternalSoftPull and DO fail the tool call.
 */
async function auditInvocation(entry: {
  toolName: string;
  args: Record<string, unknown>;
  outcome: "success" | "refused" | "error";
  resultSummary?: Record<string, unknown>;
  applicationId?: string;
  userId?: string;
  consentId?: string;
  creditPullId?: string;
}): Promise<void> {
  try {
    await logAgentToolInvocation({
      toolName: entry.toolName,
      argsHash: hashToolArgs(entry.args),
      outcome: entry.outcome,
      resultSummary: entry.resultSummary,
      applicationId: entry.applicationId,
      userId: entry.userId,
      consentId: entry.consentId,
      creditPullId: entry.creditPullId,
      callerIdentity: CALLER_IDENTITY,
      agentContext: agentContext(),
    });
  } catch (err) {
    console.error(`[homiquity-mcp] audit write failed (${entry.toolName}):`, err);
  }
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
      "persists scores, the liability ledger, and DTI. FCRA: requires an active consent " +
      "that covers a soft pull BEFORE returning anything — cached results included.",
    inputSchema: {
      firstName: z.string().min(1).describe("Borrower legal first name"),
      lastName: z.string().min(1).describe("Borrower legal last name"),
      address: z.string().min(4).describe("Borrower current street address"),
      email: z.string().email().optional().describe("Disambiguates borrowers sharing a name"),
    },
  },
  async ({ firstName, lastName, address, email }) => {
    const toolName = "run_soft_credit_pull";
    const args = { firstName, lastName, address, email };
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
      if (matches.length === 0) {
        await auditInvocation({
          toolName,
          args,
          outcome: "refused",
          resultSummary: { reason: "borrower_not_found" },
        });
        return fail(`No borrower named "${firstName} ${lastName}" found.`);
      }
      if (matches.length > 1) {
        await auditInvocation({
          toolName,
          args,
          outcome: "refused",
          resultSummary: { reason: "ambiguous_borrower", matchCount: matches.length },
        });
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
        await auditInvocation({
          toolName,
          args,
          outcome: "refused",
          resultSummary: { reason: "no_loan_application" },
          userId: borrower.id,
        });
        return fail("Borrower has no loan application; a soft pull must attach to an application.");
      }

      // 3. FCRA gate FIRST, cache second (F-042). Cached bureau data is still
      // an FCRA disclosure, so the consent gate must run before it — the old
      // order returned a revoked-consent borrower's cached scores for up to 90
      // days. evaluateSoftPull also scopes the gate: the newest active consent
      // must COVER a soft pull (consentCoversPullType, same semantics as
      // requestCreditPull), not merely exist.
      const evaluation = await evaluateSoftPull({
        borrowerUserId: borrower.id,
        applicationId: application.id,
      });
      const monthlyIncome = application.annualIncome ? Number(application.annualIncome) / 12 : null;

      if (evaluation.outcome === "refused") {
        // FCRA-relevant evidence: an agent attempted a pull without (covering) consent.
        if (evaluation.reason === "consent_scope_mismatch") {
          await auditInvocation({
            toolName,
            args,
            outcome: "refused",
            resultSummary: {
              reason: "consent_scope_mismatch",
              consentType: evaluation.consent.consentType,
            },
            applicationId: application.id,
            userId: borrower.id,
            consentId: evaluation.consent.id,
          });
          return fail(
            `FCRA: the borrower's active consent ("${evaluation.consent.consentType}") does not ` +
              "authorize a soft credit pull. A pull cannot be performed until the borrower " +
              "grants a consent that covers it.",
          );
        }
        await auditInvocation({
          toolName,
          args,
          outcome: "refused",
          resultSummary: { reason: "no_active_consent" },
          applicationId: application.id,
          userId: borrower.id,
        });
        return fail(
          "FCRA: no active credit consent on file for this borrower. A soft pull cannot be " +
            "performed until the borrower completes the credit consent flow.",
        );
      }
      const consent = evaluation.consent;

      if (evaluation.outcome === "cached") {
        const existing = evaluation.pull;
        const monthly = existing.monthlyPayments ? Number(existing.monthlyPayments) : null;
        await auditInvocation({
          toolName,
          args,
          outcome: "success",
          resultSummary: { cached: true },
          applicationId: application.id,
          userId: borrower.id,
          consentId: consent.id,
          creditPullId: existing.id,
        });
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

      // 4. Pull via the bureau adapter; persistence goes through creditService
      // so the pull lands in the tamper-evident audit chain (AG-1).
      const pull = await softPullCredit(firstName, lastName, address);
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // soft pulls: 90 days
      const inserted = await recordExternalSoftPull({
        applicationId: application.id,
        consentId: consent.id,
        requestedBy: borrower.id,
        expiresAt,
        vendor: pull,
        callerIdentity: CALLER_IDENTITY,
        agentContext: agentContext(),
      });

      await auditInvocation({
        toolName,
        args,
        outcome: "success",
        resultSummary: {
          cached: false,
          simulated: pull.simulated,
          representativeScore: pull.representativeScore,
        },
        applicationId: application.id,
        userId: borrower.id,
        consentId: consent.id,
        creditPullId: inserted.id,
      });

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
      const message = err instanceof Error ? err.message : String(err);
      await auditInvocation({
        toolName,
        args,
        outcome: "error",
        resultSummary: { error: message },
      });
      return fail(`run_soft_credit_pull failed: ${message}`);
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
    const toolName = "get_best_execution_rates";
    const args = { creditScore, ltv, zipCode, loanAmount, productType };
    try {
      // Licensed-state gate (roadmap A5): location-scoped pricing is quoting
      // activity — refuse ZIPs outside the licensed footprint (SAFE Act/Reg H;
      // state law controls — see shared/companyIdentity.ts). Same refusal
      // posture as the FCRA consent gate on the soft-pull tool.
      if (!isZipInLicensedStates(zipCode)) {
        await auditInvocation({
          toolName,
          args,
          outcome: "refused",
          resultSummary: { reason: "unlicensed_state_zip" },
        });
        return fail(`Licensing: ${unlicensedStateMessage()} (ZIP ${zipCode} is outside the footprint.)`);
      }
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
      if (filtered.length === 0) {
        await auditInvocation({
          toolName,
          args,
          outcome: "error",
          resultSummary: { reason: "no_rate_sheet_products" },
        });
        return fail("No rate sheet products found (check productType filter / seed data).");
      }

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

      await auditInvocation({
        toolName,
        args,
        outcome: "success",
        resultSummary: {
          offerCount: offers.length,
          bestLender: offers[0].lenderCode,
          bestBorrowerRate: offers[0].borrowerRate,
          llpaPoints: llpa.totalLLPA,
        },
      });

      return ok({
        formula: "P_borrower = R_investor + M_base + ΔM_risk + ΔM_geography (+ LLPA/4)",
        inputs: { creditScore, ltv, zipCode, loanAmount, productType: productType ?? "all" },
        bestExecution: offers[0],
        offers,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await auditInvocation({ toolName, args, outcome: "error", resultSummary: { error: message } });
      return fail(`get_best_execution_rates failed: ${message}`);
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
    const toolName = "retrieve_property_valuation";
    const args = { address, zipCode };
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
            avmAgentIdentity: CALLER_IDENTITY,
          })
          .where(eq(properties.id, property.id));
      }

      await auditInvocation({
        toolName,
        args,
        outcome: "success",
        resultSummary: {
          provider: avm.provider,
          simulated: avm.simulated,
          estimatedValue: avm.estimatedValue,
          confidence: avm.confidence,
          persistedToPropertyId: property?.id ?? null,
        },
      });

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
      const message = err instanceof Error ? err.message : String(err);
      await auditInvocation({ toolName, args, outcome: "error", resultSummary: { error: message } });
      return fail(`retrieve_property_valuation failed: ${message}`);
    }
  },
);

// ---------------------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[homiquity-mcp] serving 3 tools over stdio");
