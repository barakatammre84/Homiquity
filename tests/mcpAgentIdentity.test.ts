import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertDeploymentAllowed,
  identityEnforcementRequired,
  parseAgentRegistry,
  resolveAgentIdentity,
} from "../server/mcp/identity";

// ---------------------------------------------------------------------------
// AG-2: per-agent identity handshake for the MCP surface.
// Pure env-in / identity-out — no database, no transport.
// ---------------------------------------------------------------------------

const TOKEN = "s3cret-token-for-tests";
const TOKEN_HASH = createHash("sha256").update(TOKEN).digest("hex");

function registry(overrides: Record<string, any> = {}): string {
  return JSON.stringify([
    { agentId: "uw-copilot", tokenHash: TOKEN_HASH, operator: "ammre@bistelligent.com", ...overrides },
  ]);
}

describe("resolveAgentIdentity", () => {
  it("authenticates a valid credential and binds the registry operator", () => {
    const identity = resolveAgentIdentity({
      MCP_AGENT_ID: "uw-copilot",
      MCP_AGENT_TOKEN: TOKEN,
      MCP_AGENT_REGISTRY: registry(),
    });
    expect(identity).toEqual({
      agentId: "uw-copilot",
      operator: "ammre@bistelligent.com",
      authenticated: true,
      callerIdentity: "agent:uw-copilot",
    });
  });

  it("a presented credential that fails validation is fatal, never a downgrade", () => {
    expect(() =>
      resolveAgentIdentity({
        MCP_AGENT_ID: "uw-copilot",
        MCP_AGENT_TOKEN: "wrong-token",
        MCP_AGENT_REGISTRY: registry(),
      }),
    ).toThrow(/handshake failed/i);

    expect(() =>
      resolveAgentIdentity({
        MCP_AGENT_ID: "not-in-registry",
        MCP_AGENT_TOKEN: TOKEN,
        MCP_AGENT_REGISTRY: registry(),
      }),
    ).toThrow(/handshake failed/i);
  });

  it("falls back to the AG-1 transport identity when no credential is presented", () => {
    expect(resolveAgentIdentity({})).toEqual({
      agentId: null,
      operator: null,
      authenticated: false,
      callerIdentity: "mcp-stdio",
    });
    expect(resolveAgentIdentity({ MCP_CALLER_IDENTITY: "legacy-name" }).callerIdentity).toBe(
      "legacy-name",
    );
  });

  it("marks a bare agent id (no token/registry) as unverified", () => {
    const identity = resolveAgentIdentity({ MCP_AGENT_ID: "uw-copilot", MCP_OPERATOR: "ops@x.com" });
    expect(identity.authenticated).toBe(false);
    expect(identity.callerIdentity).toBe("agent:uw-copilot:unverified");
    expect(identity.operator).toBe("ops@x.com");
  });

  it("rejects malformed agent ids before touching the registry", () => {
    expect(() => resolveAgentIdentity({ MCP_AGENT_ID: "bad id with spaces" })).toThrow(
      /MCP_AGENT_ID/,
    );
    expect(() =>
      resolveAgentIdentity({ MCP_AGENT_ID: "x".repeat(40) }),
    ).toThrow(/MCP_AGENT_ID/);
  });
});

describe("parseAgentRegistry", () => {
  it("rejects malformed registries with actionable errors", () => {
    expect(() => parseAgentRegistry("not json")).toThrow(/not valid JSON/);
    expect(() => parseAgentRegistry("[]")).toThrow(/non-empty JSON array/);
    expect(() => parseAgentRegistry(JSON.stringify([{ agentId: "ok" }]))).toThrow(/tokenHash/);
    expect(() =>
      parseAgentRegistry(JSON.stringify([{ agentId: "ok", tokenHash: "plaintext-token" }])),
    ).toThrow(/SHA-256/);
  });

  it("normalizes tokenHash casing", () => {
    const [entry] = parseAgentRegistry(
      JSON.stringify([{ agentId: "ok", tokenHash: TOKEN_HASH.toUpperCase() }]),
    );
    expect(entry.tokenHash).toBe(TOKEN_HASH);
  });
});

describe("deployment enforcement (blocks unauthenticated production)", () => {
  it("production requires an authenticated identity", () => {
    const unauthenticated = resolveAgentIdentity({});
    expect(identityEnforcementRequired({ NODE_ENV: "production" })).toBe(true);
    expect(() =>
      assertDeploymentAllowed(unauthenticated, { NODE_ENV: "production" }),
    ).toThrow(/AG-2/);
  });

  it("MCP_REQUIRE_AGENT_IDENTITY=true enforces outside production too", () => {
    const unauthenticated = resolveAgentIdentity({});
    expect(() =>
      assertDeploymentAllowed(unauthenticated, { MCP_REQUIRE_AGENT_IDENTITY: "true" }),
    ).toThrow(/AG-2/);
  });

  it("an authenticated identity passes enforcement; dev without one is allowed", () => {
    const authenticated = resolveAgentIdentity({
      MCP_AGENT_ID: "uw-copilot",
      MCP_AGENT_TOKEN: TOKEN,
      MCP_AGENT_REGISTRY: registry(),
    });
    expect(() =>
      assertDeploymentAllowed(authenticated, { NODE_ENV: "production" }),
    ).not.toThrow();
    expect(() => assertDeploymentAllowed(resolveAgentIdentity({}), {})).not.toThrow();
  });
});
