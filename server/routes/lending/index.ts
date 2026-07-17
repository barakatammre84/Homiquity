// Lending route registrars — split from the old 2,358-line
// server/routes/lending.ts (#193 borrower.ts doctrine). Calls run in the
// ORIGINAL registration order, so Express route matching is unchanged.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { registerDashboardRoutes } from "./dashboard";
import { registerApplicationRoutes } from "./applications";
import { registerPricingRoutes } from "./pricing";
import { registerDeliveryRoutes } from "./delivery";
import { registerDocumentRoutes } from "./documents";
import { registerStatusDecisionRoutes } from "./statusDecisions";
import { registerLetterRoutes } from "./letters";

export function registerLendingRoutes(
  app: Express,
  storage: IStorage,
) {
  registerDashboardRoutes(app, storage);
  registerApplicationRoutes(app, storage);
  registerPricingRoutes(app, storage);
  registerDeliveryRoutes(app, storage);
  registerDocumentRoutes(app, storage);
  registerStatusDecisionRoutes(app, storage);
  registerLetterRoutes(app, storage);
}
