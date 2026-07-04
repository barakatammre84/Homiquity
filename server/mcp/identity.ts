import { createHash, timingSafeEqual } from "node:crypto";

/**
 * AG-2 (AI governance): per-agent identity for the MCP surface.
 *
 * A deployment presents MCP_AGENT_ID + MCP_AGENT_TOKEN; the env-scoped
 * registry MCP_AGENT_REGISTRY (JSON: [{ "agentId", "tokenHash", "operator"? }])
 * defines which agents this deployment may serve and on whose authority.
 * tokenHash is the SHA-256 hex of the agent's token — the registry never
 * holds a plaintext credential, so leaking the env registry alone does not
 * let another process impersonate an agent.
 *
 * Enforcement: production (NODE_ENV=production) or MCP_REQUIRE_AGENT_IDENTITY
 * =true refuses to serve tools without an authenticated identity. Local dev
 * without a credential falls back to the AG-1 transport identity
 * (MCP_CALLER_IDENTITY, default "mcp-stdio") flagged authenticated:false on
 * every audit entry. A credential that is presented but FAILS validation is
 * always fatal — a bad token must never silently downgrade to the fallback.
 */

export interface AgentRegistryEntry {
  agentId: string;
  /** SHA-256 hex digest of the agent's token. */
  tokenHash: string;
  /** On whose authority this agent acts (operator id/email). */
  operator?: string;
}

export interface AgentIdentity {
  agentId: string | null;
  operator: string | null;
  authenticated: boolean;
  /**
   * The identity string stamped into credit_audit_log.performedByRole and
   * persisted rows: "agent:<id>" when authenticated, the AG-1 transport
   * fallback otherwise.
   */
  callerIdentity: string;
}

type Env = Record<string, string | undefined>;

const AGENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

export function identityEnforcementRequired(env: Env): boolean {
  return env.NODE_ENV === "production" || env.MCP_REQUIRE_AGENT_IDENTITY === "true";
}

export function parseAgentRegistry(raw: string): AgentRegistryEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("MCP_AGENT_REGISTRY is not valid JSON.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      'MCP_AGENT_REGISTRY must be a non-empty JSON array: [{"agentId":"...","tokenHash":"<sha256 hex>","operator":"..."}]',
    );
  }
  return parsed.map((entry: any, i: number) => {
    if (!entry || typeof entry.agentId !== "string" || !AGENT_ID_PATTERN.test(entry.agentId)) {
      throw new Error(
        `MCP_AGENT_REGISTRY entry ${i}: agentId must match ${AGENT_ID_PATTERN} (max 32 chars).`,
      );
    }
    if (typeof entry.tokenHash !== "string" || !/^[0-9a-f]{64}$/i.test(entry.tokenHash)) {
      throw new Error(`MCP_AGENT_REGISTRY entry ${i}: tokenHash must be a SHA-256 hex digest.`);
    }
    return {
      agentId: entry.agentId,
      tokenHash: entry.tokenHash.toLowerCase(),
      operator: typeof entry.operator === "string" && entry.operator ? entry.operator : undefined,
    };
  });
}

function tokenMatches(token: string, tokenHashHex: string): boolean {
  const presented = createHash("sha256").update(token).digest();
  const expected = Buffer.from(tokenHashHex, "hex");
  return expected.length === presented.length && timingSafeEqual(presented, expected);
}

export function resolveAgentIdentity(env: Env): AgentIdentity {
  const agentId = env.MCP_AGENT_ID?.trim() || null;
  const token = env.MCP_AGENT_TOKEN;
  const rawRegistry = env.MCP_AGENT_REGISTRY;

  if (agentId && !AGENT_ID_PATTERN.test(agentId)) {
    throw new Error(`MCP_AGENT_ID "${agentId}" must match ${AGENT_ID_PATTERN} (max 32 chars).`);
  }

  if (agentId && token && rawRegistry) {
    const registry = parseAgentRegistry(rawRegistry);
    const entry = registry.find((e) => e.agentId === agentId);
    if (entry && tokenMatches(token, entry.tokenHash)) {
      return {
        agentId,
        operator: entry.operator ?? env.MCP_OPERATOR?.trim() ?? null,
        authenticated: true,
        callerIdentity: `agent:${agentId}`,
      };
    }
    // A presented credential that fails validation is fatal, never a downgrade.
    throw new Error(
      `MCP agent identity handshake failed for "${agentId}": unknown agent or bad token.`,
    );
  }

  // No (complete) credential presented — AG-1 transport fallback.
  const callerIdentity = agentId
    ? `agent:${agentId}:unverified`
    : env.MCP_CALLER_IDENTITY?.trim() || "mcp-stdio";
  return {
    agentId,
    operator: env.MCP_OPERATOR?.trim() || null,
    authenticated: false,
    callerIdentity,
  };
}

export function assertDeploymentAllowed(identity: AgentIdentity, env: Env): void {
  if (identityEnforcementRequired(env) && !identity.authenticated) {
    throw new Error(
      "AG-2: this deployment requires an authenticated agent identity — set MCP_AGENT_ID and " +
        "MCP_AGENT_TOKEN matching an MCP_AGENT_REGISTRY entry. Refusing to serve tools.",
    );
  }
}
