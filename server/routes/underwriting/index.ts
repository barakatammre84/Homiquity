// Underwriting route registrars — split from the old 1,483-line
// server/routes/underwriting.ts. Calls run in the ORIGINAL order, so Express
// route matching is unchanged.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { registerCalculationRoutes } from "./calculations";
import { registerDecisionRoutes } from "./decisions";
import { registerPipelineRoutes } from "./pipeline";
import { registerStaffRoutes } from "./staff";
import { registerSubmissionRoutes } from "./submissions";
import { registerDeliveryRoutes } from "./delivery";
import { registerComplianceDashboardRoutes } from "./compliance";

export function registerUnderwritingRoutes(
  app: Express,
  storage: IStorage,
) {
  registerCalculationRoutes(app, storage);
  registerDecisionRoutes(app, storage);
  registerPipelineRoutes(app, storage);
  registerStaffRoutes(app, storage);
  registerSubmissionRoutes(app, storage);
  registerDeliveryRoutes(app, storage);
  registerComplianceDashboardRoutes(app, storage);
}
