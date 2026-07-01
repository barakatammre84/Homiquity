import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { aiInteractions, type InsertAiInteraction } from "@shared/schema";

// =============================================================================
// AI GATEWAY
//
// Single chokepoint every model call in the app should route through. It:
//   1. Injects the firm's compliance charter as the system prompt.
//   2. Calls a provider via a swappable adapter (Gemini today; Claude optional).
//   3. Classifies the output (internal vs borrower-facing).
//   4. Logs the full exchange to ai_interactions for exam traceability.
//
// Provider is config-driven so the cost/quality decision is one env var, not a
// rearchitecture. Defaults to Gemini (already wired); set AI_GATEWAY_PROVIDER=claude
// to route compliance-assistant text through Anthropic Claude.
// =============================================================================

export type AiProvider = "gemini" | "claude";

export type AiClassification =
  | "internal_only"
  | "borrower_facing_review_required"
  | "borrower_facing_approved_template";

export interface AiGatewayRequest {
  /** Identifies the calling workflow, e.g. "loan_estimate_explanation". Logged. */
  workflow: string;
  /** The user-facing/task prompt. The charter is added separately as the system prompt. */
  prompt: string;
  /** How the output will be used. Drives review gating. Defaults to internal_only. */
  classification?: AiClassification;
  applicationId?: string | null;
  userId?: string | null;
  userRole?: string | null;
  /** Override the default provider for this one call. */
  provider?: AiProvider;
  /** Override the default model for this one call. */
  model?: string;
  /** Extra system-prompt text appended after the charter (workflow-specific rules). */
  systemPromptExtra?: string;
  metadata?: Record<string, unknown>;
}

export interface AiGatewayResult {
  text: string;
  provider: AiProvider;
  model: string;
  classification: AiClassification;
  /** Set when classification requires human sign-off before borrower delivery. */
  reviewStatus: "not_required" | "pending_review";
  interactionId: string;
}

// The compliance charter — the non-negotiable guardrail injected into every call.
// Mirrors the firm's written policy; keep in sync with legal/compliance sign-off.
const COMPLIANCE_CHARTER = `You are a mortgage compliance-aware writing assistant for a licensed mortgage brokerage.

You MAY:
- Explain mortgage concepts in plain language.
- Draft borrower-facing messages, disclosures, and checklists from firm-approved templates.
- Summarize and reformat information that is provided to you.

You MUST NOT:
- Make credit decisions, rate quotes, or eligibility determinations.
- Recommend specific settlement-service providers (title, insurance, appraisal) or imply referral arrangements (RESPA §8).
- Alter required regulatory language in firm-approved disclosures.
- Invent numbers, dates, fees, or terms. If information is missing, write "Information not provided" rather than fabricating it.
- Reference or infer any prohibited basis (race, color, religion, national origin, sex, marital status, age, receipt of public assistance) when discussing eligibility or pricing.

ALWAYS:
- Follow TILA, RESPA, ECOA, HMDA, SAFE Act, FCRA, and GLBA as summarized in firm policy.
- Flag uncertainty with the exact line: "This requires human compliance review before sending."
- Output in clear Markdown.`;

function defaultProvider(): AiProvider {
  return process.env.AI_GATEWAY_PROVIDER === "claude" ? "claude" : "gemini";
}

function defaultModel(provider: AiProvider): string {
  if (provider === "claude") {
    // Cheapest capable Claude model for text generation; override per-call for
    // judgment-heavy copy (e.g. "claude-sonnet-5").
    return process.env.AI_GATEWAY_CLAUDE_MODEL || "claude-haiku-4-5";
  }
  return process.env.AI_GATEWAY_GEMINI_MODEL || "gemini-2.0-flash";
}

interface ProviderResponse {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

// --- Gemini adapter (uses the already-configured key) ------------------------
const geminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

async function callGemini(model: string, system: string, prompt: string): Promise<ProviderResponse> {
  if (!genAI) {
    throw new Error("Gemini is not configured (set GEMINI_API_KEY)");
  }
  const response = await genAI.models.generateContent({
    model,
    contents: `${system}\n\n---\n\n${prompt}`,
  });
  return {
    text: response.text || "",
    inputTokens: response.usageMetadata?.promptTokenCount,
    outputTokens: response.usageMetadata?.candidatesTokenCount,
  };
}

// --- Claude adapter (optional; requires @anthropic-ai/sdk + ANTHROPIC_API_KEY) -
async function callClaude(model: string, system: string, prompt: string): Promise<ProviderResponse> {
  // Lazy import so the app runs without the Anthropic SDK installed until the
  // firm opts into Claude. To enable: `npm install @anthropic-ai/sdk` and set
  // ANTHROPIC_API_KEY.
  let Anthropic: any;
  try {
    ({ default: Anthropic } = await import("@anthropic-ai/sdk"));
  } catch {
    throw new Error(
      "Claude provider selected but @anthropic-ai/sdk is not installed. Run `npm install @anthropic-ai/sdk`.",
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Claude provider selected but ANTHROPIC_API_KEY is not set.");
  }
  const client = new Anthropic();
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const text = (message.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  return {
    text,
    inputTokens: message.usage?.input_tokens,
    outputTokens: message.usage?.output_tokens,
  };
}

/**
 * Run a governed model call: charter injection, provider dispatch, classification,
 * and audit logging. Always logs — success or failure — so there is a record of
 * every AI-assisted artifact tied to a loan file.
 */
export async function runAiGateway(req: AiGatewayRequest): Promise<AiGatewayResult> {
  const provider = req.provider || defaultProvider();
  const model = req.model || defaultModel(provider);
  const classification = req.classification || "internal_only";
  const reviewStatus =
    classification === "borrower_facing_review_required" ? "pending_review" : "not_required";

  const system = req.systemPromptExtra
    ? `${COMPLIANCE_CHARTER}\n\n${req.systemPromptExtra}`
    : COMPLIANCE_CHARTER;

  const startedAt = Date.now();
  let providerResponse: ProviderResponse | null = null;
  let errorMessage: string | null = null;

  try {
    providerResponse = provider === "claude"
      ? await callClaude(model, system, req.prompt)
      : await callGemini(model, system, req.prompt);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const record: InsertAiInteraction = {
    applicationId: req.applicationId ?? null,
    userId: req.userId ?? null,
    workflow: req.workflow,
    userRole: req.userRole ?? null,
    provider,
    model,
    systemPrompt: system,
    prompt: req.prompt,
    response: providerResponse?.text ?? null,
    classification,
    reviewStatus,
    inputTokens: providerResponse?.inputTokens ?? null,
    outputTokens: providerResponse?.outputTokens ?? null,
    latencyMs: Date.now() - startedAt,
    isError: errorMessage ? "true" : "false",
    errorMessage,
    metadata: req.metadata ?? null,
  };

  let interactionId = "";
  try {
    const [row] = await db.insert(aiInteractions).values(record).returning({ id: aiInteractions.id });
    interactionId = row?.id ?? "";
  } catch (logErr) {
    // Logging must never crash the calling workflow, but a logging failure on a
    // governed call is itself notable.
    console.error("[aiGateway] Failed to log ai_interaction:", logErr);
  }

  if (errorMessage) {
    throw new Error(`AI gateway call failed (${provider}/${model}): ${errorMessage}`);
  }

  return {
    text: providerResponse!.text,
    provider,
    model,
    classification,
    reviewStatus,
    interactionId,
  };
}
