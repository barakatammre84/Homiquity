import {
  pgTable,
  uuid,
  integer,
  pgEnum,
  numeric,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod";

// ============================================================================
// DYNAMIC LOOKUP MATRICES
// Versioned, date-aware policy/pricing matrices that move regulatory
// thresholds (DTI caps, LLPA grid, PMI cards, VA residual, asset haircuts)
// out of code and into the database for full audit lineage.
// ============================================================================

export const lifecycleStatusEnum = pgEnum("policy_lifecycle_status", [
  "DRAFT",
  "ACTIVE",
  "RETIRED",
]);

// Master metadata table for rulesets and grids
export const lookupMatrices = pgTable(
  "lookup_matrices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matrixCode: varchar("matrix_code", { length: 100 }).notNull(), // e.g., 'CONVENTIONAL_PMI', 'VA_RESIDUAL', 'FANNIE_LLPA'
    description: text("description"),
    version: integer("version").default(1).notNull(),
    lifecycleStatus: lifecycleStatusEnum("lifecycle_status")
      .default("DRAFT")
      .notNull(),
    previousVersionId: uuid("previous_version_id").references((): AnyPgColumn => lookupMatrices.id),
    effectiveDate: timestamp("effective_date", { withTimezone: true }).notNull(),
    expirationDate: timestamp("expiration_date", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Bumped on every lifecycle mutation (activate/retire/reschedule/create).
    // The resolver derives a cross-process invalidation stamp from
    // MAX(updated_at) per matrix_code so other server instances stop serving a
    // stale/expired value within one short refresh window instead of waiting
    // out the full local cache TTL.
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("matrix_code_version_idx").on(table.matrixCode, table.version),
    index("matrix_active_temporal_idx").on(
      table.matrixCode,
      table.lifecycleStatus,
      table.effectiveDate,
    ),
  ],
);

// Multi-dimensional range bounds and coordinate intersections
export const lookupMatrixCells = pgTable(
  "lookup_matrix_cells",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matrixId: uuid("matrix_id")
      .references(() => lookupMatrices.id, { onDelete: "cascade" })
      .notNull(),
    // Dimension 1: Numeric interval (e.g., FICO, household size)
    dim1Min: numeric("dim1_min", { precision: 14, scale: 2 }),
    dim1Max: numeric("dim1_max", { precision: 14, scale: 2 }),
    // Dimension 2: Numeric interval (e.g., LTV, loan amount)
    dim2Min: numeric("dim2_min", { precision: 14, scale: 2 }),
    dim2Max: numeric("dim2_max", { precision: 14, scale: 2 }),
    // Dimension 3: Categorical lookup identifier (e.g., region name or household size)
    dim3Identifier: varchar("dim3_identifier", { length: 100 }),
    // Uniform target output parameter
    outputValue: numeric("output_value", { precision: 12, scale: 6 }).notNull(),
  },
  (table) => [
    index("cell_matrix_id_idx").on(table.matrixId),
    index("cell_multi_dim_lookup_idx").on(
      table.matrixId,
      table.dim1Min,
      table.dim1Max,
      table.dim2Min,
      table.dim2Max,
      table.dim3Identifier,
    ),
  ],
);

// Setup Relations
export const lookupMatricesRelations = relations(lookupMatrices, ({ many }) => ({
  cells: many(lookupMatrixCells),
}));

export const lookupMatrixCellsRelations = relations(
  lookupMatrixCells,
  ({ one }) => ({
    matrix: one(lookupMatrices, {
      fields: [lookupMatrixCells.matrixId],
      references: [lookupMatrices.id],
    }),
  }),
);

// Zod validation schemas for API verification & seed scripts
export const lookupAxisTypeSchema = z.enum([
  "NUMERIC_INTERVAL",
  "EXACT_MATCH",
  "ENUM_SET",
]);

export const lookupAxisDefinitionSchema = z.object({
  dim1Name: z.string().min(1),
  dim1Type: lookupAxisTypeSchema,
  dim2Name: z.string().min(1).optional(),
  dim2Type: lookupAxisTypeSchema.optional(),
  dim3Name: z.string().min(1).optional(),
  dim3Type: lookupAxisTypeSchema.optional(),
});

export const lookupMatrixSchema = z.object({
  matrixCode: z.string().min(1).max(100),
  description: z.string().optional(),
  version: z.number().int().positive(),
  lifecycleStatus: z.enum(["DRAFT", "ACTIVE", "RETIRED"]),
  previousVersionId: z.string().uuid().nullable().optional(),
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date().nullable().optional(),
  axisDefinition: lookupAxisDefinitionSchema,
});

export const lookupMatrixCellSchema = z.object({
  dim1Min: z.number().nullable().optional(),
  dim1Max: z.number().nullable().optional(),
  dim2Min: z.number().nullable().optional(),
  dim2Max: z.number().nullable().optional(),
  dim3Identifier: z.string().nullable().optional(),
  outputValue: z.number(),
});

export type LookupMatrix = typeof lookupMatrices.$inferSelect;
export type InsertLookupMatrix = typeof lookupMatrices.$inferInsert;
export type LookupMatrixCell = typeof lookupMatrixCells.$inferSelect;
export type InsertLookupMatrixCell = typeof lookupMatrixCells.$inferInsert;
export type PolicyLifecycleStatus = (typeof lifecycleStatusEnum.enumValues)[number];
