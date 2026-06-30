import type { Express } from "express";
import type { IStorage } from "../storage";
import { requireRole } from "../auth";
import { logAudit } from "../auditLog";
import { lookupMatrixCellSchema } from "@shared/schema";
import { LookupResolverService } from "../services/lookupResolver";
import { z } from "zod";

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
        const matrix = await storage.getLookupMatrix(req.params.id);
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
        const matrix = await storage.getLookupMatrix(req.params.id);
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

        const updated = await storage.updateLookupMatrix(req.params.id, {
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
        const matrix = await storage.getLookupMatrix(req.params.id);
        if (!matrix) {
          return res.status(404).json({ error: "Lookup matrix not found" });
        }

        if (matrix.lifecycleStatus !== "ACTIVE") {
          return res.status(400).json({
            error: `Only ACTIVE matrices can be retired (current status: ${matrix.lifecycleStatus})`,
          });
        }

        const updated = await storage.updateLookupMatrix(req.params.id, {
          lifecycleStatus: "RETIRED",
          expirationDate: new Date(),
        });

        LookupResolverService.invalidate(matrix.matrixCode);

        await logAudit(req, "MATRIX_RETIRE", "lookup_matrix", matrix.id, {
          matrixCode: matrix.matrixCode,
          version: matrix.version,
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
        const matrix = await storage.getLookupMatrix(req.params.id);
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

        const updated = await storage.updateLookupMatrix(
          req.params.id,
          updates,
        );

        LookupResolverService.invalidate(matrix.matrixCode);

        await logAudit(req, "MATRIX_RESCHEDULE", "lookup_matrix", matrix.id, {
          matrixCode: matrix.matrixCode,
          version: matrix.version,
          updatedFields: Object.keys(updates),
        });

        res.json(updated);
      } catch (error) {
        console.error("Reschedule lookup matrix error:", error);
        res.status(500).json({ error: "Failed to reschedule lookup matrix" });
      }
    },
  );
}
