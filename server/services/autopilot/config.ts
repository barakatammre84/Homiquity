import { db } from "../../db";
import { autopilotConfig, type AutopilotGuidelineMode } from "@shared/schema";

/**
 * Autopilot operator config + kill switch (autopilot_config, one global row).
 *
 * Homiquity is a broker: Autopilot perceives (extraction) and pre-flights
 * (deterministic package-readiness + guideline-cited follow-ups). It never
 * decides — the lender does. This module is the on/off + capability gate every
 * orchestrator entry consults.
 *
 * Read posture: cached for a short TTL so per-event checks never hit the DB on
 * the hot path; flipping the kill switch OFF takes effect within one TTL (Blend
 * promises "within 5 minutes"; we do 30s). Fails CLOSED — any error yields the
 * disabled default, so the agent never runs on a config it couldn't read.
 */

export interface AutopilotConfig {
  enabled: boolean;
  followUpGenerationEnabled: boolean;
  applicationDataUpdatesEnabled: boolean;
  /** null / empty = all loan officers; otherwise only these LO user ids. */
  loanOfficerAllowlist: string[] | null;
  guidelineMode: AutopilotGuidelineMode;
}

/** Disabled default — used before activation and whenever the row can't be read. */
const DISABLED_DEFAULT: AutopilotConfig = {
  enabled: false,
  followUpGenerationEnabled: true,
  applicationDataUpdatesEnabled: true,
  loanOfficerAllowlist: null,
  guidelineMode: "fannie_mae",
};

const CACHE_TTL_MS = 30_000;
let cache: { value: AutopilotConfig; at: number } | null = null;

/** Call after any write to the config row so the change is picked up immediately. */
export function invalidateAutopilotConfigCache(): void {
  cache = null;
}

export async function getAutopilotConfig(): Promise<AutopilotConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  try {
    const [row] = await db.select().from(autopilotConfig).limit(1);
    const value: AutopilotConfig = row
      ? {
          enabled: row.enabled,
          followUpGenerationEnabled: row.followUpGenerationEnabled,
          applicationDataUpdatesEnabled: row.applicationDataUpdatesEnabled,
          loanOfficerAllowlist:
            Array.isArray(row.loanOfficerAllowlist) && row.loanOfficerAllowlist.length > 0
              ? row.loanOfficerAllowlist
              : null,
          guidelineMode: (row.guidelineMode as AutopilotGuidelineMode) ?? "fannie_mae",
        }
      : DISABLED_DEFAULT;
    cache = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.error("[Autopilot] Failed to read config — failing closed (disabled):", err);
    return DISABLED_DEFAULT;
  }
}

/**
 * The master gate every orchestrator entry checks. Honors both the kill switch
 * and the pilot allowlist (scoped to the application's owning loan officer).
 */
export async function isAutopilotEnabled(loanOfficerId?: string | null): Promise<boolean> {
  const cfg = await getAutopilotConfig();
  if (!cfg.enabled) return false;
  if (cfg.loanOfficerAllowlist) {
    return !!loanOfficerId && cfg.loanOfficerAllowlist.includes(loanOfficerId);
  }
  return true;
}

export async function canGenerateFollowUps(): Promise<boolean> {
  return (await getAutopilotConfig()).followUpGenerationEnabled;
}

export async function canUpdateApplicationData(): Promise<boolean> {
  return (await getAutopilotConfig()).applicationDataUpdatesEnabled;
}
