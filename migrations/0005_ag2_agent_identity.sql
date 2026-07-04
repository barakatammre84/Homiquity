-- AG-2: per-agent identity stamped on rows the MCP surface persists.
-- credit_pulls.agent_identity — which AI agent performed the pull (requested_by stays the borrower).
-- properties.avm_agent_identity — which AI agent wrote the AVM refresh.
ALTER TABLE "credit_pulls" ADD COLUMN IF NOT EXISTS "agent_identity" varchar(120);
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "avm_agent_identity" varchar(120);
