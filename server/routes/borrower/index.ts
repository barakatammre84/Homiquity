// Borrower-facing route registrars — split from the old 4,295-line
// server/routes/borrower.ts. Each ./<group>.ts registers one feature area;
// the calls below run in the ORIGINAL registration order, so Express route
// matching is unchanged. Add new borrower routes to the matching group file.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { registerCalculatorRoutes } from "./calculators";
import { registerApplicationPropertyRoutes } from "./applicationProperties";
import { registerUrlaRoutes } from "./urla";
import { registerJourneyGoalRoutes } from "./journeyGoals";
import { registerRateLockRoutes } from "./rateLocks";
import { registerConsentRoutes } from "./consents";
import { registerPartnerOrderRoutes } from "./partnerOrders";
import { registerDealTeamRoutes } from "./dealTeam";
import { registerDocumentPackageRoutes } from "./documentPackages";
import { registerMessagingRoutes } from "./messaging";
import { registerOnboardingRoutes } from "./onboarding";
import { registerRealtorProgramRoutes } from "./realtorPrograms";
import { registerGuaranteeHomeownerRoutes } from "./guaranteesHomeowner";
import { registerScenarioWaitlistRoutes } from "./scenariosWaitlist";

export { verifyInternalStaffApplicationAccess } from "./access";

export function registerBorrowerRoutes(
  app: Express,
  storage: IStorage,
) {
  registerCalculatorRoutes(app, storage);
  registerApplicationPropertyRoutes(app, storage);
  registerUrlaRoutes(app, storage);
  registerJourneyGoalRoutes(app, storage);
  registerRateLockRoutes(app, storage);
  registerConsentRoutes(app, storage);
  registerPartnerOrderRoutes(app, storage);
  registerDealTeamRoutes(app, storage);
  registerDocumentPackageRoutes(app, storage);
  registerMessagingRoutes(app, storage);
  registerOnboardingRoutes(app, storage);
  registerRealtorProgramRoutes(app, storage);
  registerGuaranteeHomeownerRoutes(app, storage);
  registerScenarioWaitlistRoutes(app, storage);
}
