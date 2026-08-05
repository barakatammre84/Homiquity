// Borrower routes: DPA programs, digital onboarding, KBA, KYC/AML screening, feedback.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated, requireRole } from "../../auth";
import { logAudit } from "../../auditLog";
import { type User } from "@shared/schema";
import crypto from "crypto";
import { z } from "zod";
import { firstQueryValue } from "../queryParams";
import { routeParam } from "../../http/routeParams";

// How long a human KYC/AML clearance stays good before the borrower must be
// re-screened. Sanctions and PEP lists change continuously, so a clearance is a
// point-in-time statement, never a permanent one. One year matches the BSA/AML
// convention of periodic CIP refresh; shorten it, never lengthen it silently.
const KYC_CLEARANCE_VALIDITY_DAYS = 365;

// ---------------------------------------------------------------------------
// Onboarding-profile field policy (finding F-045)
//
// `identityVerified` and `kycCleared` were borrower-writable through
// PATCH /api/onboarding/profile/:id. The server declines to write both itself,
// deliberately: the KBA handler refuses `identityVerified` because "granting
// identity-verified status from a simulated challenge would create false
// compliance evidence", and `simulateKycScreening` refuses to clear a screening
// for the same reason — which is the whole premise of the staff clearance
// workflow (F-044). Two deliberate refusals, defeated by one PATCH.
//
// The rule that decides membership below: **if the server deliberately declines
// to write a field itself, no client may write it either.**
// `documentsComplete`/`personalInfoComplete` fail that test — nothing refuses to
// write them — so they stay borrower-attestable. If either ever gates anything,
// derive it server-side rather than promoting a borrower's claim about their
// own file.
//
// Exported so the policy is testable as behaviour rather than as source text.
// ---------------------------------------------------------------------------

/** Journey state the borrower legitimately drives. */
export const BORROWER_ATTESTABLE_PROFILE_FIELDS = [
  "journeyStatus",
  "currentStep",
  "completedSteps",
  "progressPercent",
  "documentsComplete",
  "personalInfoComplete",
] as const;

/** Compliance attestations. Only identity verification and compliance review write these. */
export const SERVER_ONLY_PROFILE_FIELDS = ["identityVerified", "kycCleared"] as const;

/**
 * Split a PATCH body into the fields that may be applied and the server-only
 * fields the caller tried to set.
 *
 * `rejected` is returned rather than quietly dropped: filtering a
 * self-attestation attempt out silently makes it indistinguishable from a
 * well-formed request, and that signal is worth keeping.
 */
export function partitionProfileUpdate(body: Record<string, unknown>): {
  update: Record<string, unknown>;
  rejected: string[];
} {
  const rejected = SERVER_ONLY_PROFILE_FIELDS.filter((f) => body?.[f] !== undefined);
  const update: Record<string, unknown> = {};
  for (const key of BORROWER_ATTESTABLE_PROFILE_FIELDS) {
    if (body?.[key] !== undefined) {
      update[key] = body[key];
    }
  }
  return { update, rejected: [...rejected] };
}

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).

const dpaProgramsQuerySchema = z.object({
  state: z.string().trim().toUpperCase().length(2).optional(),
  firstTimeBuyer: z.enum(["true", "false"]).optional(),
  minCreditScore: z.coerce.number().int().min(300).max(850).optional(),
  maxIncome: z.coerce.number().positive().optional(),
});

export function registerOnboardingRoutes(
  app: Express,
  storage: IStorage,
) {
  // DPA Programs API Routes
  // ================================

  // Get DPA programs with optional filters.
  // PUBLIC BY DECISION: an educational directory of government assistance
  // programs — no PII, no pricing; consumed by the indexable pre-auth
  // /down-payment-wizard page. Content is seed-verified
  // (tests/illinoisDpaSeed.test.ts).
  app.get("/api/dpa-programs", async (req, res) => {
    try {
      const parsed = dpaProgramsQuerySchema.safeParse({
        state: firstQueryValue(req.query.state),
        firstTimeBuyer: firstQueryValue(req.query.firstTimeBuyer),
        minCreditScore: firstQueryValue(req.query.minCreditScore),
        maxIncome: firstQueryValue(req.query.maxIncome),
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid filters", details: parsed.error.flatten().fieldErrors });
      }
      const { state, firstTimeBuyer, minCreditScore, maxIncome } = parsed.data;
      const programs = await storage.getDpaPrograms({
        state,
        firstTimeBuyer: firstTimeBuyer === undefined ? undefined : firstTimeBuyer === "true",
        minCreditScore,
        maxIncome,
      });
      res.json(programs);
    } catch (error) {
      console.error("Get DPA programs error:", error);
      res.status(500).json({ error: "Failed to get DPA programs" });
    }
  });

  // Get specific DPA program. PUBLIC BY DECISION (same rationale as the list
  // endpoint above).
  app.get("/api/dpa-programs/:id", async (req, res) => {
    try {
      const program = await storage.getDpaProgram(routeParam(req, "id"));
      if (!program) {
        return res.status(404).json({ error: "Program not found" });
      }
      res.json(program);
    } catch (error) {
      console.error("Get DPA program error:", error);
      res.status(500).json({ error: "Failed to get program" });
    }
  });

  // ================================
  // Digital Onboarding API Routes
  // ================================

  function detectBorrowerType(app: any): string {
    if (!app) return "standard";
    if (app.employmentType === "self_employed") return "self_employed";
    if (app.isFirstTimeBuyer) return "first_time_buyer";
    const nonQmIndicators = [
      app.loanType && !["conventional", "fha", "va", "usda"].includes(app.loanType),
      app.creditScore && app.creditScore < 620,
      app.incomeDocType === "bank_statement" || app.incomeDocType === "asset_based",
    ];
    if (nonQmIndicators.some(Boolean)) return "non_qm";
    return "standard";
  }

  // Get onboarding status - aggregates identity, KYC, profile data
  app.get("/api/onboarding/status", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;

      const [profile, kbaSessions, kycScreenings, verificationRecords, applications] = await Promise.all([
        storage.getOnboardingProfileByUser(userId),
        storage.getKbaSessionsByUser(userId),
        storage.getKycScreeningsByUser(userId),
        storage.getVerificationsByUser(userId),
        storage.getLoanApplicationsByUser(userId),
      ]);

      const latestKba = kbaSessions[0];
      const latestKyc = kycScreenings[0];
      const latestApp = applications[0];

      const borrowerType = detectBorrowerType(latestApp);

      res.json({
        profile: profile || null,
        kba: latestKba ? { id: latestKba.id, status: latestKba.status, score: latestKba.score, attemptNumber: latestKba.attemptNumber, maxAttempts: latestKba.maxAttempts } : null,
        kyc: latestKyc || null,
        verifications: verificationRecords,
        borrowerType,
        applicationId: latestApp?.id || null,
        applicationStatus: latestApp?.status || null,
      });
    } catch (error) {
      console.error("Get onboarding status error:", error);
      res.status(500).json({ error: "Failed to get onboarding status" });
    }
  });

  // Create or get onboarding profile
  app.post("/api/onboarding/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      let profile = await storage.getOnboardingProfileByUser(userId);

      if (!profile) {
        const applications = await storage.getLoanApplicationsByUser(userId);
        const latestApp = applications[0];

        const borrowerType = detectBorrowerType(latestApp);

        profile = await storage.createOnboardingProfile({
          userId,
          applicationId: latestApp?.id || null,
          borrowerType,
          journeyStatus: "not_started",
          currentStep: "identity_verification",
        });
      }

      res.json(profile);
    } catch (error) {
      console.error("Create onboarding profile error:", error);
      res.status(500).json({ error: "Failed to create onboarding profile" });
    }
  });

  // Update onboarding profile
  app.patch("/api/onboarding/profile/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getOnboardingProfile(routeParam(req, "id"));
      if (!profile || profile.userId !== req.user!.id) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Field policy — see BORROWER_ATTESTABLE_PROFILE_FIELDS at module scope (F-045).
      const { update: safeUpdate, rejected } = partitionProfileUpdate(req.body ?? {});

      if (rejected.length > 0) {
        logAudit(req, "onboarding.server_only_field_rejected", "onboarding_profile", profile.id, {
          fields: rejected,
        });
        return res.status(400).json({
          error:
            "identityVerified and kycCleared are set by identity verification and compliance review, not by this endpoint.",
          code: "SERVER_ONLY_FIELD",
          fields: rejected,
        });
      }

      const updated = await storage.updateOnboardingProfile(routeParam(req, "id"), safeUpdate);
      res.json(updated);
    } catch (error) {
      console.error("Update onboarding profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // KBA - Start a new session
  app.post("/api/onboarding/kba/start", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { applicationId } = req.body;

      const existingSessions = await storage.getKbaSessionsByUser(userId);
      const passedSession = existingSessions.find(s => s.status === "passed");
      if (passedSession) {
        return res.json({ session: passedSession, alreadyPassed: true });
      }

      const failedCount = existingSessions.filter(s => s.status === "failed").length;
      if (failedCount >= 3) {
        return res.status(403).json({ error: "Maximum KBA attempts exceeded. Please contact support." });
      }

      const attemptNumber = failedCount + 1;
      const questions = generateKBAQuestions(userId, attemptNumber);

      const session = await storage.createKbaSession({
        userId,
        applicationId: applicationId || null,
        status: "in_progress",
        questionsData: questions.map(q => ({ id: q.id, question: q.question, choices: q.choices, correctIndex: q.correctIndex })),
        totalQuestions: questions.length,
        passingScore: 4,
        attemptNumber,
        maxAttempts: 3,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      res.json({
        session: {
          id: session.id,
          status: session.status,
          attemptNumber: session.attemptNumber,
          maxAttempts: session.maxAttempts,
          questions: questions.map(q => ({ id: q.id, question: q.question, choices: q.choices })),
        },
      });
    } catch (error) {
      console.error("Start KBA session error:", error);
      res.status(500).json({ error: "Failed to start KBA session" });
    }
  });

  // KBA - Submit answers
  app.post("/api/onboarding/kba/:id/submit", isAuthenticated, async (req, res) => {
    try {
      const session = await storage.getKbaSession(routeParam(req, "id"));
      if (!session || session.userId !== req.user!.id) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.status !== "in_progress") {
        return res.status(400).json({ error: "Session is no longer active" });
      }

      if (session.expiresAt && new Date() > session.expiresAt) {
        await storage.updateKbaSession(session.id, { status: "expired" });
        return res.status(400).json({ error: "Session has expired" });
      }

      const { answers } = req.body;
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: "Answers array is required" });
      }

      const questionsData = session.questionsData as any[];

      let correctCount = 0;
      const gradedAnswers = answers.map((answer: { questionId: string; selectedIndex: number }) => {
        const storedQuestion = questionsData.find((q: any) => q.id === answer.questionId);
        const correct = storedQuestion ? answer.selectedIndex === storedQuestion.correctIndex : false;
        if (correct) correctCount++;
        return { questionId: answer.questionId, selectedIndex: answer.selectedIndex, correct };
      });

      const passed = correctCount >= (session.passingScore || 4);
      const status = passed ? "passed" : "failed";

      await storage.updateKbaSession(session.id, {
        status,
        answersData: gradedAnswers,
        score: correctCount,
        completedAt: new Date(),
      });

      if (passed) {
        const profile = await storage.getOnboardingProfileByUser(req.user!.id);
        if (profile) {
          const completedSteps = [...(profile.completedSteps || [])];
          if (!completedSteps.includes("kba_verification")) {
            completedSteps.push("kba_verification");
          }
          // NOTE: identityVerified is intentionally NOT set to true here.
          // This KBA flow is simulated and the questions are not derived from
          // real borrower credit-bureau records; granting identity-verified status
          // from a simulated challenge would create false compliance evidence.
          // identityVerified must only be set to true by a real KBA provider
          // integration (e.g. LexisNexis, Experian KIQ) once wired in.
          await storage.updateOnboardingProfile(profile.id, {
            completedSteps,
            progressPercent: Math.min(100, (profile.progressPercent || 0) + 20),
          });
        }
      }

      res.json({
        status,
        score: correctCount,
        totalQuestions: questionsData.length,
        passed,
        // Surface the pending-provider note so the frontend can inform the user.
        identityVerificationPending: passed,
        remainingAttempts: passed ? 0 : Math.max(0, (session.maxAttempts || 3) - (session.attemptNumber || 1)),
      });
    } catch (error) {
      console.error("Submit KBA answers error:", error);
      res.status(500).json({ error: "Failed to submit answers" });
    }
  });

  // KYC/AML - Trigger screening
  app.post("/api/onboarding/kyc/screen", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { applicationId } = req.body;

      const existing = await storage.getKycScreeningsByUser(userId);
      const recentCleared = existing.find(s => s.overallStatus === "cleared" && s.expiresAt && new Date(s.expiresAt) > new Date());
      if (recentCleared) {
        return res.json({ screening: recentCleared, alreadyCleared: true });
      }

      const screening = await storage.createKycScreening({
        userId,
        applicationId: applicationId || null,
        overallStatus: "in_progress",
      });

      simulateKycScreening(screening.id);

      res.json({ screening, message: "KYC/AML screening initiated" });
    } catch (error) {
      console.error("KYC screening error:", error);
      res.status(500).json({ error: "Failed to initiate screening" });
    }
  });

  // KYC/AML - Get screening status
  app.get("/api/onboarding/kyc/status", isAuthenticated, async (req, res) => {
    try {
      const screenings = await storage.getKycScreeningsByUser(req.user!.id);
      res.json({ screening: screenings[0] || null });
    } catch (error) {
      console.error("Get KYC status error:", error);
      res.status(500).json({ error: "Failed to get screening status" });
    }
  });

  // ================================
  // KYC/AML compliance clearance (staff) — finding F-044
  // ================================
  //
  // simulateKycScreening ends every screening at `pending_review` on purpose:
  // "a staff member must review and explicitly clear this record via the admin
  // compliance workflow", because auto-clearing "would produce a falsely-cleared
  // compliance record". That refusal is correct — but the workflow it deferred to
  // was never built, so nothing in the codebase could write `cleared` and EVERY
  // borrower sat at pending_review indefinitely. onboarding.ts:315 even reads
  // `overallStatus === "cleared"` to skip re-screening, a branch that could never
  // be reached. These two routes are the missing workflow.
  //
  // ROLE SCOPE — deliberately narrow: admin + underwriter only. This is an
  // OFAC/sanctions/PEP adjudication, not a sales or processing task, so lo/loa/
  // processor/closer are excluded. Widening is easy and reversible; a too-broad
  // clearance authority on an AML record is not. Confirm the intended authority
  // before widening.

  /** The clearance queue. */
  app.get(
    "/api/compliance/kyc/pending",
    requireRole("admin", "underwriter"),
    async (_req, res) => {
      try {
        const screenings = await storage.getKycScreeningsPendingReview();

        // Resolve borrower identity in ONE query, not one per row — a review queue
        // is unbounded and this is the N+1 shape tests/nPlusOneBatching.test.ts
        // guards against. Name + email only; the reviewer needs to know who they
        // are adjudicating, not the borrower's full PII record.
        const userIds = Array.from(new Set(screenings.map((s) => s.userId)));
        const users = userIds.length ? await storage.getUsersByIds(userIds) : [];
        const byId = new Map(users.map((u) => [u.id, u]));

        res.json({
          screenings: screenings.map((s) => {
            const borrower = byId.get(s.userId);
            return {
              ...s,
              borrower: borrower
                ? {
                    id: borrower.id,
                    firstName: borrower.firstName,
                    lastName: borrower.lastName,
                    email: borrower.email,
                  }
                : null,
            };
          }),
        });
      } catch (error) {
        console.error("Get pending KYC screenings error:", error);
        res.status(500).json({ error: "Failed to load the KYC review queue" });
      }
    },
  );

  /** Record a human clearance decision. The ONLY writer of `cleared`. */
  app.post(
    "/api/compliance/kyc/:screeningId/decision",
    requireRole("admin", "underwriter"),
    async (req, res) => {
      try {
        const user = req.user as User;
        const screeningId = routeParam(req, "screeningId");

        const decisionSchema = z.object({
          decision: z.enum(["cleared", "failed"]),
          // Required, and non-trivially so. A clearance with no stated basis is a
          // weak record precisely where the record is the point — this row is the
          // evidence that a human adjudicated a sanctions screening.
          notes: z.string().trim().min(10, "Record the basis for this decision (10+ characters)"),
        });
        const parsed = decisionSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Invalid decision",
            details: parsed.error.flatten().fieldErrors,
          });
        }
        const { decision, notes } = parsed.data;

        const screening = await storage.getKycScreening(screeningId);
        if (!screening) {
          return res.status(404).json({ error: "Screening not found" });
        }

        // Only an undecided screening may be decided. Re-deciding a settled record
        // would overwrite one adjudication with another and leave no trace of the
        // first — the falsified-record class this whole workflow exists to prevent.
        // A changed decision needs a new screening, not a silent overwrite.
        if (screening.overallStatus !== "pending_review") {
          return res.status(409).json({
            error: `This screening is already ${screening.overallStatus}. Run a new screening rather than re-deciding a settled record.`,
            code: "SCREENING_ALREADY_DECIDED",
          });
        }

        // Preserve what the screening FOUND. Only sub-checks sitting at
        // `pending_review` (i.e. carrying no adverse finding) advance to cleared;
        // a `flagged` or `failed` check keeps its value, because overwriting a real
        // OFAC hit with "cleared" would destroy the finding while making the record
        // look clean. The human's verdict lives in overallStatus, not in the
        // individual check results.
        const resolve = (current: string | null | undefined) =>
          current === "pending_review" ? "cleared" : current ?? undefined;

        const updated = await storage.updateKycScreening(screeningId, {
          overallStatus: decision,
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
          screeningNotes: notes,
          ...(decision === "cleared"
            ? {
                ofacStatus: resolve(screening.ofacStatus),
                sanctionsStatus: resolve(screening.sanctionsStatus),
                pepStatus: resolve(screening.pepStatus),
                adverseMediaStatus: resolve(screening.adverseMediaStatus),
                // onboarding.ts:315 skips re-screening only while a cleared record
                // is unexpired, so a clearance with no expiry would never re-screen.
                expiresAt: new Date(Date.now() + KYC_CLEARANCE_VALIDITY_DAYS * 24 * 60 * 60 * 1000),
              }
            : {}),
        });

        logAudit(req, `kyc.${decision}`, "kyc_screening", screeningId, {
          borrowerUserId: screening.userId,
          applicationId: screening.applicationId,
          decidedBy: user.id,
          priorStatus: screening.overallStatus,
        });

        res.json({ screening: updated });
      } catch (error) {
        console.error("KYC decision error:", error);
        res.status(500).json({ error: "Failed to record the decision" });
      }
    },
  );

  // Onboarding Feedback
  app.post("/api/onboarding/feedback", isAuthenticated, async (req, res) => {
    try {
      const feedbackSchema = z.object({
        step: z.string().optional(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        feedbackType: z.enum(["general", "difficulty", "suggestion", "praise"]).optional(),
      });

      const validated = feedbackSchema.parse(req.body);
      const feedback = await storage.createOnboardingFeedback({
        userId: req.user!.id,
        ...validated,
      });

      res.json(feedback);
    } catch (error) {
      console.error("Submit feedback error:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // Helper: Generate KBA questions for a specific user session.
  //
  // NOTE: In production this must be replaced by a real KBA provider (e.g. LexisNexis,
  // Experian KIQ) that issues user-specific questions derived from the borrower's actual
  // credit-bureau records. The simulation below is intentionally non-functional as a
  // security check: it uses a crypto-derived, per-user-per-attempt seed so that
  // (a) each user is shown a unique subset of questions from a large pool, and
  // (b) the correct answer index is randomised per user and cannot be memorised from
  //     one account and applied to another.
  //
  // The "correct" answers in the simulation do not correspond to real borrower data —
  // identityVerified will therefore remain unset by this flow until a real provider
  // is wired in and this helper is replaced.
  function generateKBAQuestions(userId: string, attemptNumber: number): Array<{
    id: string;
    question: string;
    choices: string[];
    correctIndex: number;
  }> {
    // Large question pool — far more than will be shown in any single session.
    const questionPool = [
      { id: "addr1", question: "Which of the following addresses have you been associated with?", choices: ["123 Oak Street, Springfield", "456 Maple Ave, Portland", "789 Pine Rd, Denver", "None of the above"] },
      { id: "addr2", question: "Which address below matches a previous residence?", choices: ["22 Birch Lane, Austin", "47 Elm Court, Phoenix", "91 Cedar Blvd, Miami", "None of the above"] },
      { id: "addr3", question: "Which ZIP code have you lived in?", choices: ["60614", "97201", "85001", "None of the above"] },
      { id: "cnty1", question: "In which of the following counties have you lived?", choices: ["Cook County", "King County", "Maricopa County", "None of the above"] },
      { id: "cnty2", question: "Which county is associated with a past address of yours?", choices: ["Travis County", "Multnomah County", "Miami-Dade County", "None of the above"] },
      { id: "phone1", question: "Which of the following phone numbers is associated with you?", choices: ["(555) 123-4567", "(555) 234-5678", "(555) 345-6789", "None of the above"] },
      { id: "phone2", question: "Which area code appears on a phone number linked to you?", choices: ["312", "503", "602", "None of the above"] },
      { id: "bank1", question: "Which financial institution have you had an account with?", choices: ["First National Bank", "Pacific Credit Union", "Metro Savings", "None of the above"] },
      { id: "bank2", question: "Which of the following lenders have you done business with?", choices: ["Lakeside Mortgage", "Summit Lending", "Valley Home Loans", "None of the above"] },
      { id: "auto1", question: "What type of vehicle have you previously registered?", choices: ["Sedan", "SUV", "Truck", "None of the above"] },
      { id: "auto2", question: "Which vehicle make is associated with a past registration of yours?", choices: ["Toyota", "Ford", "Honda", "None of the above"] },
      { id: "emp1", question: "Which employer name appears in your work history?", choices: ["Acme Corp", "Globex Industries", "Initech Solutions", "None of the above"] },
      { id: "emp2", question: "In which industry have you been employed?", choices: ["Healthcare", "Technology", "Construction", "None of the above"] },
      { id: "edu1", question: "Which institution have you attended?", choices: ["State University", "City Community College", "Regional Technical Institute", "None of the above"] },
      { id: "rel1", question: "Which of the following is a relative's name associated with your records?", choices: ["James Mitchell", "Linda Torres", "Robert Chen", "None of the above"] },
    ];

    // Derive a deterministic but user-unique numeric seed from userId + attemptNumber
    // using a one-way hash so it cannot be predicted without the userId.
    const seedInput = `${userId}:kba:${attemptNumber}`;
    const hashHex = crypto.createHash("sha256").update(seedInput).digest("hex");
    // Convert first 8 hex chars to a 32-bit integer seed.
    const seed = parseInt(hashHex.slice(0, 8), 16);

    // Seeded pseudo-random number generator (mulberry32).
    let s = seed;
    function rand(): number {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    // Seeded Fisher-Yates shuffle to pick 5 questions unique to this user/attempt.
    const pool = [...questionPool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selected = pool.slice(0, 5);

    // For each selected question, assign a correct index using the seeded RNG and
    // then shuffle the choices so the index position also varies per user.
    return selected.map((q, qi) => {
      // Choose a correct index deterministically for this user/question slot.
      const correctPos = Math.floor(rand() * q.choices.length);
      const tagged = q.choices.map((text, i) => ({ text, isCorrect: i === correctPos }));
      // Shuffle choices with the seeded RNG so position cannot be predicted externally.
      for (let i = tagged.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
      }
      const newCorrectIndex = tagged.findIndex(c => c.isCorrect);
      return {
        id: `${q.id}_${qi}`,
        question: q.question,
        choices: tagged.map(c => c.text),
        correctIndex: newCorrectIndex,
      };
    });
  }

  // Helper: Initiate KYC/AML screening checks.
  // Each check transitions to "pending_review" once it has been submitted to the
  // (simulated) screening provider. The overall screening remains in "pending_review"
  // until a staff member reviews the results and manually marks it cleared or failed.
  // This prevents any automated path from producing a falsely-cleared compliance record.
  async function simulateKycScreening(screeningId: string) {
    try {
      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        ofacStatus: "pending_review",
        ofacCheckedAt: new Date(),
      });

      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        sanctionsStatus: "pending_review",
        sanctionsCheckedAt: new Date(),
      });

      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        pepStatus: "pending_review",
        pepCheckedAt: new Date(),
      });

      await new Promise(r => setTimeout(r, 2000));
      // Mark all checks as submitted and awaiting staff review.
      // overallStatus stays "pending_review" — a staff member must review and
      // explicitly clear this record via the admin compliance workflow.
      await storage.updateKycScreening(screeningId, {
        adverseMediaStatus: "pending_review",
        adverseMediaCheckedAt: new Date(),
        overallStatus: "pending_review",
        screeningNotes: "Screening checks submitted. Awaiting compliance staff review before clearance.",
      });
    } catch (error) {
      console.error("KYC simulation error:", error);
      try {
        await storage.updateKycScreening(screeningId, { overallStatus: "failed" });
      } catch (updateErr) {
        console.error("[KYC] Failed to update screening status to failed:", updateErr);
      }
    }
  }

  // =============================================
}
