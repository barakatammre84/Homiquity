// Storage domain: Content categories, articles, FAQs.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import {
  eq,
  desc,
  and,
  sql,
  or,
  ilike,
  asc,
  arrayOverlaps,
} from "drizzle-orm";
import { parseProductFamilies, parseTransactionPurposes } from "@shared/loanProducts";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  contentCategories,
  articles,
  faqs,
  type ContentCategory,
  type InsertContentCategory,
  type Article,
  type InsertArticle,
  type Faq,
  type InsertFaq,
} from "@shared/schema";
import { VerificationsStorage } from "./verifications";
export class ContentStorage extends VerificationsStorage {
  // Content Categories
  async createContentCategory(data: InsertContentCategory): Promise<ContentCategory> {
    const [category] = await db.insert(contentCategories).values(data).returning();
    return category;
  }

  async getContentCategory(id: string): Promise<ContentCategory | undefined> {
    const [category] = await db
      .select()
      .from(contentCategories)
      .where(eq(contentCategories.id, id))
      .limit(1);
    return category;
  }

  async getContentCategoryBySlug(slug: string): Promise<ContentCategory | undefined> {
    const [category] = await db
      .select()
      .from(contentCategories)
      .where(eq(contentCategories.slug, slug))
      .limit(1);
    return category;
  }

  async getAllContentCategories(): Promise<ContentCategory[]> {
    return await db
      .select()
      .from(contentCategories)
      .orderBy(asc(contentCategories.displayOrder));
  }

  async getActiveContentCategories(): Promise<ContentCategory[]> {
    return await db
      .select()
      .from(contentCategories)
      .where(eq(contentCategories.isActive, true))
      .orderBy(asc(contentCategories.displayOrder));
  }

  async updateContentCategory(id: string, data: Partial<ContentCategory>): Promise<ContentCategory | undefined> {
    const { id: catId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(contentCategories)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(contentCategories.id, id))
      .returning();
    return updated;
  }

  async deleteContentCategory(id: string): Promise<void> {
    await db.delete(contentCategories).where(eq(contentCategories.id, id));
  }

  // Articles (Learning Center)
  async createArticle(data: InsertArticle): Promise<Article> {
    const [article] = await db.insert(articles).values(data).returning();
    return article;
  }

  async getArticle(id: string): Promise<Article | undefined> {
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);
    return article;
  }

  async getArticleBySlug(slug: string): Promise<Article | undefined> {
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.slug, slug))
      .limit(1);
    return article;
  }

  async getAllArticles(): Promise<Article[]> {
    return await db
      .select()
      .from(articles)
      .orderBy(desc(articles.createdAt));
  }

  async getPublishedArticles(): Promise<Article[]> {
    return await db
      .select()
      .from(articles)
      .where(eq(articles.status, "published"))
      .orderBy(desc(articles.publishedAt));
  }

  /**
   * Published articles related to a persona page, matched on the taxonomy.
   *
   * This is what wires a persona page (/va-loans, /refinance, /self-employed)
   * back to the education content that answers the objection a visitor arrives
   * with — the direction that was missing entirely.
   *
   * Both axes matter and they are ANDed. Family alone is too coarse for some
   * pages: nearly all purchase content is `conventional`, so a /refinance page
   * filtering on family would surface a first-time-buyer guide, which is worse
   * than showing nothing. Filtering on purpose instead (rate_term_refi,
   * cash_out_refi) targets it properly.
   *
   * Array OVERLAP (&&) within each axis: an article tagged
   * [conventional, fha] is relevant to an FHA page.
   *
   * Uses drizzle's `arrayOverlaps` rather than a hand-written sql`&&` template.
   * The template form binds the JS array as a SINGLE parameter, which
   * node-postgres serializes to the bare string "fha" and Postgres then rejects
   * with `malformed array literal` — visible only against a real database, not
   * in unit tests.
   */
  async getRelatedArticles(opts: {
    families?: readonly string[];
    purposes?: readonly string[];
    limit?: number;
  }): Promise<Article[]> {
    const families = parseProductFamilies(opts.families);
    const purposes = parseTransactionPurposes(opts.purposes);
    // No recognised filter means "everything", which is not what a related-
    // content module wants — return nothing rather than the whole library.
    if (families.length === 0 && purposes.length === 0) return [];

    const conditions = [eq(articles.status, "published")];
    if (families.length > 0) {
      conditions.push(arrayOverlaps(articles.loanProductFamilies, families));
    }
    if (purposes.length > 0) {
      conditions.push(arrayOverlaps(articles.transactionPurposes, purposes));
    }

    return await db
      .select()
      .from(articles)
      .where(and(...conditions))
      .orderBy(desc(articles.publishedAt))
      .limit(opts.limit ?? 3);
  }

  async getArticlesByCategory(categoryId: string): Promise<Article[]> {
    return await db
      .select()
      .from(articles)
      .where(and(
        eq(articles.categoryId, categoryId),
        eq(articles.status, "published")
      ))
      .orderBy(desc(articles.publishedAt));
  }

  async searchArticles(query: string): Promise<Article[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db
      .select()
      .from(articles)
      .where(and(
        eq(articles.status, "published"),
        or(
          ilike(articles.title, searchTerm),
          ilike(articles.excerpt, searchTerm),
          ilike(articles.content, searchTerm)
        )
      ))
      .orderBy(desc(articles.publishedAt));
  }

  async updateArticle(id: string, data: Partial<Article>): Promise<Article | undefined> {
    const { id: artId, createdAt, viewCount, ...cleanData } = data as any;
    const [updated] = await db
      .update(articles)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(articles.id, id))
      .returning();
    return updated;
  }

  async incrementArticleViewCount(id: string): Promise<void> {
    await db
      .update(articles)
      .set({ viewCount: sql`${articles.viewCount} + 1` })
      .where(eq(articles.id, id));
  }

  async deleteArticle(id: string): Promise<void> {
    await db.delete(articles).where(eq(articles.id, id));
  }

  // FAQs
  async createFaq(data: InsertFaq): Promise<Faq> {
    const [faq] = await db.insert(faqs).values(data).returning();
    return faq;
  }

  async getFaq(id: string): Promise<Faq | undefined> {
    const [faq] = await db
      .select()
      .from(faqs)
      .where(eq(faqs.id, id))
      .limit(1);
    return faq;
  }

  async getAllFaqs(): Promise<Faq[]> {
    return await db
      .select()
      .from(faqs)
      .orderBy(asc(faqs.displayOrder), desc(faqs.createdAt));
  }

  async getPublishedFaqs(): Promise<Faq[]> {
    return await db
      .select()
      .from(faqs)
      .where(eq(faqs.status, "published"))
      .orderBy(asc(faqs.displayOrder));
  }

  async getPopularFaqs(): Promise<Faq[]> {
    return await db
      .select()
      .from(faqs)
      .where(and(
        eq(faqs.status, "published"),
        eq(faqs.isPopular, true)
      ))
      .orderBy(asc(faqs.displayOrder));
  }

  async getFaqsByCategory(categoryId: string): Promise<Faq[]> {
    return await db
      .select()
      .from(faqs)
      .where(and(
        eq(faqs.categoryId, categoryId),
        eq(faqs.status, "published")
      ))
      .orderBy(asc(faqs.displayOrder));
  }

  async searchFaqs(query: string): Promise<Faq[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db
      .select()
      .from(faqs)
      .where(and(
        eq(faqs.status, "published"),
        or(
          ilike(faqs.question, searchTerm),
          ilike(faqs.answer, searchTerm)
        )
      ))
      .orderBy(asc(faqs.displayOrder));
  }

  async updateFaq(id: string, data: Partial<Faq>): Promise<Faq | undefined> {
    const { id: faqId, createdAt, viewCount, helpfulCount, notHelpfulCount, ...cleanData } = data as any;
    const [updated] = await db
      .update(faqs)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(faqs.id, id))
      .returning();
    return updated;
  }

  async incrementFaqViewCount(id: string): Promise<void> {
    await db
      .update(faqs)
      .set({ viewCount: sql`${faqs.viewCount} + 1` })
      .where(eq(faqs.id, id));
  }

  async markFaqHelpful(id: string, helpful: boolean): Promise<void> {
    if (helpful) {
      await db
        .update(faqs)
        .set({ helpfulCount: sql`${faqs.helpfulCount} + 1` })
        .where(eq(faqs.id, id));
    } else {
      await db
        .update(faqs)
        .set({ notHelpfulCount: sql`${faqs.notHelpfulCount} + 1` })
        .where(eq(faqs.id, id));
    }
  }

  async deleteFaq(id: string): Promise<void> {
    await db.delete(faqs).where(eq(faqs.id, id));
  }

}
