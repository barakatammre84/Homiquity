import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated } from "../auth";
import { logAudit } from "../auditLog";
import { isClientRole, type User } from "@shared/schema";
import {
  toBorrowerSubmissionView,
  toCreditConsentView,
  toPlatformConsentView,
  type BorrowerSubmissionView,
} from "@shared/myDataSharing";
import { getCreditConsentsByUser } from "../services/creditService";

interface ApplicationSharingView {
  id: string;
  status: string;
  propertyAddress: string | null;
  createdAt: string | null;
  submissions: BorrowerSubmissionView[];
}

export function registerMyDataRoutes(app: Express, storage: IStorage) {
  /**
   * Borrower "My Data" transparency dashboard: which wholesale lenders have
   * received this borrower's file, what each package contained, submission
   * status, and the consent ledger (FCRA credit authorizations + platform
   * eConsent records).
   *
   * Access model: strictly self-scoped. Everything is keyed off the session
   * user id — no client-supplied ids are accepted, so there is no object-level
   * authorization surface. Client roles only: staff and partner roles read
   * submissions through the pipeline views, which carry their own deal-team
   * gates. Rows are mapped through the @shared/myDataSharing whitelists so
   * staff notes, readiness snapshots, and the raw MISMO XML never leave the
   * server.
   */
  app.get("/api/my-data/sharing", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isClientRole(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const applications = await storage.getLoanApplicationsByUser(user.id);
      const applicationViews: ApplicationSharingView[] = [];
      for (const application of applications) {
        const submissions = await storage.getLenderSubmissionsByApplication(application.id);
        applicationViews.push({
          id: application.id,
          status: application.status,
          propertyAddress: application.propertyAddress ?? null,
          createdAt: application.createdAt?.toISOString() ?? null,
          submissions: submissions.map(toBorrowerSubmissionView),
        });
      }

      const [creditConsents, platformConsents] = await Promise.all([
        getCreditConsentsByUser(user.id),
        storage.getBorrowerConsentsByUser(user.id),
      ]);

      // PII-adjacent read (consent ledger carries FCRA disclosure evidence):
      // every view of the sharing dashboard leaves an audit trail.
      await logAudit(req, "my_data.sharing_viewed", "user", user.id, {
        applicationCount: applicationViews.length,
        submissionCount: applicationViews.reduce((n, a) => n + a.submissions.length, 0),
        consentCount: creditConsents.length + platformConsents.length,
      });

      res.json({
        generatedAt: new Date().toISOString(),
        applications: applicationViews,
        consents: {
          credit: creditConsents.map(toCreditConsentView),
          platform: platformConsents.map(toPlatformConsentView),
        },
      });
    } catch (error) {
      console.error("My data sharing error:", error);
      res.status(500).json({ error: "Failed to load your data sharing summary" });
    }
  });
}
