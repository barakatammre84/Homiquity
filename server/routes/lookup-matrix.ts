import type { Express } from "express";
import type { IStorage } from "../storage";
import { requireRole } from "../auth";
import { logAudit } from "../auditLog";
import { lookupMatrixCellSchema } from "@shared/schema";
import { LookupResolverService } from "../services/lookupResolver";
import { z } from "zod";
import { routeParam } from "../http/routeParams";

/**
 * Staff admin surface for the versioned, date-effective lookup matrices that
 * drive underwriting/pricing decisions. Lets staff publish a new version of a
 * matrix, activate it (optionally future-dated), and retire (expire) an old
 * version WITHOUT running the bulk reseed script.
 *
 * Lifecycle (shared/schema/lookup.ts -> policy_lifecycle_status):
 *   DRAFT   -> staged, never resolved by the engine
 *   ACTIVE  -> resolvable once effectiveDate <= now and not past expirationDate
 *   RETIRED -> permanently expired, never resolved
 *
 * A future-dated matrix is simply an ACTIVE row whose effectiveDate is in the
 * future; the resolver already ignores it until it becomes effective and always
 * prefers the highest version among active, effective, non-expired rows.
 *
 * Every mutation writes to the audit log (who changed which matrix) and clears
 * the resolver cache for that matrix code so stale/expired pricing can never be
 * quoted after a lifecycle change.
 */

const createMatrixSchema = z.object({
  matrixCode: z.string().min(1).max(100),
  description: z.string().optional(),
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date().nullable().optional(),
  cells: z.array(lookupMatrixCellSchema).min(1),
});

const numToStr = (v: number | null | undefined): string | null =>
  v === null || v === undefined ? null : v.toString();

// A minimal view of a matrix version used to reason about coverage.
type CoverageRow = {
  id: string;
  effectiveDate: Date;
  expirationDate: Date | null;
};

// Mirrors the resolver's selection rule: a version provides live coverage only
// when it is ACTIVE, already effective, and not yet expired. (Lifecycle status
// is filtered upstream; this checks the temporal window.)
const isCurrentlyEffective = (row: CoverageRow, now: Date): boolean =>
  row.effectiveDate.getTime() <= now.getTime() &&
  (row.expirationDate === null ||
    row.expirationDate.getTime() >= now.getTime());

// Returns the ACTIVE versions for a matrix code, reduced to the fields needed
// to evaluate temporal coverage.
async function getActiveCoverageRows(
  storage: IStorage,
  matrixCode: string,
): Promise<CoverageRow[]> {
  const rows = await storage.getLookupMatrices({
    matrixCode,
    lifecycleStatus: "ACTIVE",
  });
  return rows.map((r) => ({
    id: r.id,
    effectiveDate: r.effectiveDate,
    expirationDate: r.expirationDate,
  }));
}

// A lifecycle action "creates a gap" when the matrix code has live coverage
// right now but would have none after the action is applied. Pre-existing gaps
// (no coverage before and after) are not attributed to this action.
const createsCoverageGap = (
  before: CoverageRow[],
  after: CoverageRow[],
  now: Date,
): boolean =>
  before.some((r) => isCurrentlyEffective(r, now)) &&
  !after.some((r) => isCurrentlyEffective(r, now));

// Standard 409 used when an action would strand a matrix code with no
// resolvable version. Staff can re-submit with `confirmCoverageGap: true`.
function coverageGapResponse(res: any, matrixCode: string, action: string) {
  return res.status(409).json({
    error: "COVERAGE_GAP",
    matrixCode,
    message:
      `${action} would leave matrix code "${matrixCode}" with no ACTIVE, ` +
      `currently-effective version. Any borrower pricing or underwriting ` +
      `decision that relies on it will hard-fail until a replacement version ` +
      `is both ACTIVE and effective. Re-submit the same request with ` +
      `"confirmCoverageGap": true to proceed and accept this gap.`,
  });
}

export function registerLookupMatrixRoutes(app: Express, storage: IStorage) {
  // List matrices (one row per version), with cell counts. Optional filters.
  app.get(
    "/api/lookup-matrices",
    requireRole("admin", "underwriter"),
    async (req, res) => {
      try {
        const { matrixCode, lifecycleStatus } = req.query;
        const filters: { matrixCode?: string; lifecycleStatus?: string } = {};
        if (matrixCode && typeof matrixCode === "string")
          filters.matrixCode = matrixCode;
        if (lifecycleStatus && typeof lifecycleStatus === "string")
          filters.lifecycleStatus = lifecycleStatus;

        const matrices = await storage.getLookupMatrices(filters);
        res.json(matrices);
      } catch (error) {
        console.error("Get lookup matrices error:", error);
        res.status(500).json({ error: "Failed to get lookup matrices" });
      }
    },
  );

  // Get a single matrix version with its cells.
  app.get(
    "/api/lookup-matrices/:id",
    requireRole("admin", "underwriter"),
    async (req, res) => {
      try {
        const matrix = await storage.getLookupMatrix(routeParam(req, "id"));
        if (!matrix) {
          return res.status(404).json({ error: "Lookup matrix not found" });
        }
        res.json(matrix);
      } catch (error) {
        console.error("Get lookup matrix error:", error);
        res.status(500).json({ error: "Failed to get lookup matrix" });
      }
    },
  );

  // Publish a new DRAFT version of a matrix. Version auto-increments from the
  // highest existing version for the code; previousVersionId links to the
  // currently active version if one exists.
  app.post(
    "/api/lookup-matrices",
    requireRole("admin"),
    async (req, res) => {
      try {
        const parsed = createMatrixSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Invalid matrix data",
            details: parsed.error.flatten(),
          });
        }

        const { matrixCode, description, effectiveDate, expirationDate, cells } =
          parsed.data;

        if (
          expirationDate &&
          expirationDate.getTime() <= effectiveDate.getTime()
        ) {
          return res.status(400).json({
            error: "expirationDate must be after effectiveDate",
          });
        }

        const maxVersion = await storage.getMaxLookupMatrixVersion(matrixCode);
        const currentActive = await storage.getActiveLookupMatrix(matrixCode);

        const created = await storage.createLookupMatrix(
          {
            matrixCode,
            description: description ?? null,
            version: maxVersion + 1,
            lifecycleStatus: "DRAFT",
            previousVersionId: currentActive?.id ?? null,
            effectiveDate,
            expirationDate: expirationDate ?? null,
          },
          cells.map((c) => ({
            matrixId: "", // overwritten in storage with the new matrix id
            dim1Min: numToStr(c.dim1Min),
            dim1Max: numToStr(c.dim1Max),
            dim2Min: numToStr(c.dim2Min),
            dim2Max: numToStr(c.dim2Max),
            dim3Identifier: c.dim3Identifier ?? null,
            outputValue: c.outputValue.toString(),
          })),
        );

        await logAudit(req, "MATRIX_CREATE", "lookup_matrix", created.id, {
          matrixCode: created.matrixCode,
          version: created.version,
          cellCount: created.cells.length,
          previousVersionId: created.previousVersionId,
        });

        res.status(201).json(created);
      } catch (error) {
        console.error("Create lookup matrix error:", error);
        res.status(500).json({ error: "Failed to create lookup matrix" });
      }
    },
  );

  // Activate a DRAFT matrix (publish it live). An effectiveDate in the future
  // keeps it dormant until that date; the previously active version of the same
  // code is automatically retired so only one lineage is live.
  app.post(
    "/api/lookup-matrices/:id/activate",
    requireRole("admin"),
    async (req, res) => {
      try {
        const matrix = await storage.getLookupMatrix(routeParam(req, "id"));
        if (!matrix) {
          return res.status(404).json({ error: "Lookup matrix not found" });
        }

        if (matrix.lifecycleStatus !== "DRAFT") {
          return res.status(400).json({
            error: `Only DRAFT matrices can be activated (current status: ${matrix.lifecycleStatus})`,
          });
        }

        const previousActive = await storage.getActiveLookupMatrix(
          matrix.matrixCode,
        );

        // Coverage-gap guard: activating retires the prior live version and the
        // newly-activated one only counts once its effectiveDate arrives. A
        // future-dated activation therefore strands the code with no resolvable
        // version in the meantime. Simulate the post-action ACTIVE set and block
        // unless staff explicitly confirm.
        const now = new Date();
        const before = await getActiveCoverageRows(storage, matrix.matrixCode);
        const after: CoverageRow[] = before.filter(
          (r) => r.id !== previousActive?.id,
        );
        after.push({
          id: matrix.id,
          effectiveDate: matrix.effectiveDate,
          expirationDate: matrix.expirationDate,
        });
        const wouldGap = createsCoverageGap(before, after, now);
        const confirmGap = req.body?.confirmCoverageGap === true;
        if (wouldGap && !confirmGap) {
          return coverageGapResponse(res, matrix.matrixCode, "Activating this matrix");
        }

        const updated = await storage.updateLookupMatrix(routeParam(req, "id"), {
          lifecycleStatus: "ACTIVE",
        });

        let retiredPreviousId: string | null = null;
        if (previousActive && previousActive.id !== matrix.id) {
          await storage.updateLookupMatrix(previousActive.id, {
            lifecycleStatus: "RETIRED",
            expirationDate: new Date(),
          });
          retiredPreviousId = previousActive.id;
        }

        LookupResolverService.invalidate(matrix.matrixCode);

        await logAudit(req, "MATRIX_ACTIVATE", "lookup_matrix", matrix.id, {
          matrixCode: matrix.matrixCode,
          version: matrix.version,
          effectiveDate: matrix.effectiveDate,
          futureDated: matrix.effectiveDate.getTime() > Date.now(),
          retiredPreviousId,
          coverageGapConfirmed: wouldGap,
        });

        res.json(updated);
      } catch (error) {
        console.error("Activate lookup matrix error:", error);
        res.status(500).json({ error: "Failed to activate lookup matrix" });
      }
    },
  );

  // Retire (expire) an ACTIVE matrix so the resolver stops quoting it.
  app.post(
    "/api/lookup-matrices/:id/retire",
    requireRole("admin"),
    async (req, res) => {
      try {
        const matrix = await storage.getLookupMatrix(routeParam(req, "id"));
        if (!matrix) {
          return res.status(404).json({ error: "Lookup matrix not found" });
        }

        if (matrix.lifecycleStatus !== "ACTIVE") {
          return res.status(400).json({
            error: `Only ACTIVE matrices can be retired (current status: ${matrix.lifecycleStatus})`,
          });
        }

        // Coverage-gap guard: if this is the only currently-effective version for
        // the code, retiring it leaves the resolver with nothing to quote. Block
        // unless staff explicitly confirm.
        const now = new Date();
        const before = await getActiveCoverageRows(storage, matrix.matrixCode);
        const after = before.filter((r) => r.id !== matrix.id);
        const wouldGap = createsCoverageGap(before, after, now);
        const confirmGap = req.body?.confirmCoverageGap === true;
        if (wouldGap && !confirmGap) {
          return coverageGapResponse(res, matrix.matrixCode, "Retiring this matrix");
        }

        const updated = await storage.updateLookupMatrix(routeParam(req, "id"), {
          lifecycleStatus: "RETIRED",
          expirationDate: new Date(),
        });

        LookupResolverService.invalidate(matrix.matrixCode);

        await logAudit(req, "MATRIX_RETIRE", "lookup_matrix", matrix.id, {
          matrixCode: matrix.matrixCode,
          version: matrix.version,
          coverageGapConfirmed: wouldGap,
        });

        res.json(updated);
      } catch (error) {
        console.error("Retire lookup matrix error:", error);
        res.status(500).json({ error: "Failed to retire lookup matrix" });
      }
    },
  );

  // Reschedule a not-yet-effective ACTIVE matrix (adjust future effectiveDate
  // or expirationDate) without re-publishing.
  app.patch(
    "/api/lookup-matrices/:id/schedule",
    requireRole("admin"),
    async (req, res) => {
      try {
        const matrix = await storage.getLookupMatrix(routeParam(req, "id"));
        if (!matrix) {
          return res.status(404).json({ error: "Lookup matrix not found" });
        }

        if (matrix.lifecycleStatus === "RETIRED") {
          return res.status(400).json({
            error: "Cannot reschedule a RETIRED matrix",
          });
        }

        const scheduleSchema = z.object({
          effectiveDate: z.coerce.date().optional(),
          expirationDate: z.coerce.date().nullable().optional(),
        });
        const parsed = scheduleSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Invalid schedule data",
            details: parsed.error.flatten(),
          });
        }

        const effectiveDate =
          parsed.data.effectiveDate ?? matrix.effectiveDate;
        const expirationDate =
          parsed.data.expirationDate !== undefined
            ? parsed.data.expirationDate
            : matrix.expirationDate;

        if (
          expirationDate &&
          expirationDate.getTime() <= effectiveDate.getTime()
        ) {
          return res.status(400).json({
            error: "expirationDate must be after effectiveDate",
          });
        }

        const updates: { effectiveDate?: Date; expirationDate?: Date | null } =
          {};
        if (parsed.data.effectiveDate !== undefined)
          updates.effectiveDate = parsed.data.effectiveDate;
        if (parsed.data.expirationDate !== undefined)
          updates.expirationDate = parsed.data.expirationDate;

        // Coverage-gap guard: pushing an ACTIVE version's effectiveDate into the
        // future (or pulling its expirationDate into the past) can remove the
        // only live coverage for the code. Simulate the change against the
        // current ACTIVE set and block unless staff explicitly confirm. (DRAFT
        // versions provide no coverage, so rescheduling them is never a gap.)
        const now = new Date();
        const before = await getActiveCoverageRows(storage, matrix.matrixCode);
        const after = before.map((r) =>
          r.id === matrix.id ? { ...r, effectiveDate, expirationDate } : r,
        );
        const wouldGap = createsCoverageGap(before, after, now);
        const confirmGap = req.body?.confirmCoverageGap === true;
        if (wouldGap && !confirmGap) {
          return coverageGapResponse(
            res,
            matrix.matrixCode,
            "Rescheduling this matrix",
          );
        }

        const updated = await storage.updateLookupMatrix(
          routeParam(req, "id"),
          updates,
        );

        LookupResolverService.invalidate(matrix.matrixCode);

        await logAudit(req, "MATRIX_RESCHEDULE", "lookup_matrix", matrix.id, {
          matrixCode: matrix.matrixCode,
          version: matrix.version,
          updatedFields: Object.keys(updates),
          coverageGapConfirmed: wouldGap,
        });

        res.json(updated);
      } catch (error) {
        console.error("Reschedule lookup matrix error:", error);
        res.status(500).json({ error: "Failed to reschedule lookup matrix" });
      }
    },
  );
}
