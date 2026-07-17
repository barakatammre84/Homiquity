// Agent/broker route registrars — split from the old 1,305-line
// server/routes/agent-broker.ts. Calls run in the ORIGINAL order, so Express
// route matching is unchanged.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { registerAgentDirectoryRoutes } from "./agents";
import { registerProfileBrokerRoutes } from "./profileBroker";
import { registerInviteRoutes } from "./invites";
import { registerAnalyticsOpsRoutes } from "./analyticsOps";
import { registerReferralCoBrandRoutes } from "./referralsCoBrand";
import { registerDealDeskRoutes } from "./dealDesk";

export function registerAgentBrokerRoutes(
  app: Express,
  storage: IStorage,
) {
  registerAgentDirectoryRoutes(app, storage);
  registerProfileBrokerRoutes(app, storage);
  registerInviteRoutes(app, storage);
  registerAnalyticsOpsRoutes(app, storage);
  registerReferralCoBrandRoutes(app, storage);
  registerDealDeskRoutes(app, storage);
}
