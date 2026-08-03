// Storage domain: Mortgage rate programs + rates.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { eq, desc, and, or, asc, isNull } from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import { mortgageRatePrograms, mortgageRates, type MortgageRateProgram, type InsertMortgageRateProgram, type MortgageRate, type InsertMortgageRate } from "@shared/schema";
import { rateLoanTypeIncludesUnclassified, type RateLoanType } from "@shared/rateLoanTypes";
import { ContentStorage } from "./content";
export class RatesStorage extends ContentStorage {
  // Mortgage Rate Programs
  async createMortgageRateProgram(data: InsertMortgageRateProgram): Promise<MortgageRateProgram> {
    const [program] = await db.insert(mortgageRatePrograms).values(data).returning();
    return program;
  }

  async getMortgageRateProgram(id: string): Promise<MortgageRateProgram | undefined> {
    const [program] = await db
      .select()
      .from(mortgageRatePrograms)
      .where(eq(mortgageRatePrograms.id, id))
      .limit(1);
    return program;
  }

  async getMortgageRateProgramBySlug(slug: string): Promise<MortgageRateProgram | undefined> {
    const [program] = await db
      .select()
      .from(mortgageRatePrograms)
      .where(eq(mortgageRatePrograms.slug, slug))
      .limit(1);
    return program;
  }

  async getAllMortgageRatePrograms(): Promise<MortgageRateProgram[]> {
    return await db
      .select()
      .from(mortgageRatePrograms)
      .orderBy(asc(mortgageRatePrograms.displayOrder));
  }

  async getActiveMortgageRatePrograms(): Promise<MortgageRateProgram[]> {
    return await db
      .select()
      .from(mortgageRatePrograms)
      .where(eq(mortgageRatePrograms.isActive, true))
      .orderBy(asc(mortgageRatePrograms.displayOrder));
  }

  async updateMortgageRateProgram(id: string, data: Partial<MortgageRateProgram>): Promise<MortgageRateProgram | undefined> {
    const { id: programId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(mortgageRatePrograms)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(mortgageRatePrograms.id, id))
      .returning();
    return updated;
  }

  async deleteMortgageRateProgram(id: string): Promise<void> {
    await db.delete(mortgageRatePrograms).where(eq(mortgageRatePrograms.id, id));
  }

  // Mortgage Rates
  async createMortgageRate(data: InsertMortgageRate): Promise<MortgageRate> {
    const [rate] = await db.insert(mortgageRates).values(data).returning();
    return rate;
  }

  async getMortgageRate(id: string): Promise<MortgageRate | undefined> {
    const [rate] = await db
      .select()
      .from(mortgageRates)
      .where(eq(mortgageRates.id, id))
      .limit(1);
    return rate;
  }

  async getMortgageRatesByProgram(programId: string): Promise<MortgageRate[]> {
    return await db
      .select()
      .from(mortgageRates)
      .where(eq(mortgageRates.programId, programId));
  }

  /**
   * Public rate lookup.
   *
   * `loanType` narrows to the products advertisable under one product heading
   * (see `shared/rateLoanTypes.ts` for why this is enforced here rather than in
   * each page's render path). Omit it for the "all rates" surfaces.
   */
  async getMortgageRatesForLocation(state?: string, zipcode?: string, loanType?: RateLoanType): Promise<(MortgageRate & { program: MortgageRateProgram })[]> {
    // A null program.loan_type counts as the requested type only where an
    // unclassified program is indistinguishable from it — conventional today.
    const loanTypeFilter = loanType
      ? (rateLoanTypeIncludesUnclassified(loanType)
          ? or(eq(mortgageRatePrograms.loanType, loanType), isNull(mortgageRatePrograms.loanType))
          : eq(mortgageRatePrograms.loanType, loanType))
      : undefined;

    // Get rates with location matching: zipcode > state > national (null)
    const results = await db
      .select({
        id: mortgageRates.id,
        state: mortgageRates.state,
        zipcode: mortgageRates.zipcode,
        programId: mortgageRates.programId,
        rate: mortgageRates.rate,
        apr: mortgageRates.apr,
        points: mortgageRates.points,
        pointsCost: mortgageRates.pointsCost,
        loanAmount: mortgageRates.loanAmount,
        downPaymentPercent: mortgageRates.downPaymentPercent,
        creditScoreMin: mortgageRates.creditScoreMin,
        isActive: mortgageRates.isActive,
        effectiveDate: mortgageRates.effectiveDate,
        expiresAt: mortgageRates.expiresAt,
        createdBy: mortgageRates.createdBy,
        updatedBy: mortgageRates.updatedBy,
        createdAt: mortgageRates.createdAt,
        updatedAt: mortgageRates.updatedAt,
        program: mortgageRatePrograms,
      })
      .from(mortgageRates)
      .innerJoin(mortgageRatePrograms, eq(mortgageRates.programId, mortgageRatePrograms.id))
      .where(and(
        eq(mortgageRates.isActive, true),
        eq(mortgageRatePrograms.isActive, true),
        loanTypeFilter
      ))
      .orderBy(asc(mortgageRatePrograms.displayOrder));

    // Filter by location preference: zipcode > state > national
    const ratesByProgram = new Map<string, typeof results[0]>();
    
    for (const rate of results) {
      const existing = ratesByProgram.get(rate.programId);
      
      // Calculate priority: zipcode match = 3, state match = 2, national = 1
      const getPriority = (r: typeof rate) => {
        if (zipcode && r.zipcode === zipcode) return 3;
        if (state && r.state === state && !r.zipcode) return 2;
        if (!r.state && !r.zipcode) return 1;
        return 0;
      };
      
      const newPriority = getPriority(rate);
      const existingPriority = existing ? getPriority(existing) : 0;
      
      if (newPriority > existingPriority) {
        ratesByProgram.set(rate.programId, rate);
      }
    }
    
    return Array.from(ratesByProgram.values());
  }

  async getAllMortgageRates(): Promise<(MortgageRate & { program: MortgageRateProgram })[]> {
    return await db
      .select({
        id: mortgageRates.id,
        state: mortgageRates.state,
        zipcode: mortgageRates.zipcode,
        programId: mortgageRates.programId,
        rate: mortgageRates.rate,
        apr: mortgageRates.apr,
        points: mortgageRates.points,
        pointsCost: mortgageRates.pointsCost,
        loanAmount: mortgageRates.loanAmount,
        downPaymentPercent: mortgageRates.downPaymentPercent,
        creditScoreMin: mortgageRates.creditScoreMin,
        isActive: mortgageRates.isActive,
        effectiveDate: mortgageRates.effectiveDate,
        expiresAt: mortgageRates.expiresAt,
        createdBy: mortgageRates.createdBy,
        updatedBy: mortgageRates.updatedBy,
        createdAt: mortgageRates.createdAt,
        updatedAt: mortgageRates.updatedAt,
        program: mortgageRatePrograms,
      })
      .from(mortgageRates)
      .innerJoin(mortgageRatePrograms, eq(mortgageRates.programId, mortgageRatePrograms.id))
      .orderBy(asc(mortgageRatePrograms.displayOrder), desc(mortgageRates.createdAt));
  }

  async updateMortgageRate(id: string, data: Partial<MortgageRate>): Promise<MortgageRate | undefined> {
    const { id: rateId, createdAt, createdBy, ...cleanData } = data as any;
    const [updated] = await db
      .update(mortgageRates)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(mortgageRates.id, id))
      .returning();
    return updated;
  }

  async deleteMortgageRate(id: string): Promise<void> {
    await db.delete(mortgageRates).where(eq(mortgageRates.id, id));
  }

}
