import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { buildBorrowerGraph } from "../server/services/borrowerGraph";
import {
  resolveReviewItem,
  syncReviewItems,
} from "../server/services/income/reviewTriage";

const borrowerId = randomUUID();
const applicationA = randomUUID();
const applicationB = randomUUID();
const documentA = randomUUID();
const documentB = randomUUID();
const runB = randomUUID();
const logicalDocumentB = randomUUID();
const corruptItemId = randomUUID();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Application signal isolation fixtures require a local test database");
  }

  await pool.query(
    `INSERT INTO users (id,email,first_name,last_name,role)
     VALUES ($1,$2,'Fictional','Signal Borrower','buyer')`,
    [borrowerId, `signal-isolation-${borrowerId}@example.test`],
  );
  await pool.query(
    `INSERT INTO loan_applications
      (id,user_id,status,annual_income,monthly_debts,credit_score,loan_purpose)
     VALUES
      ($1,$3,'underwriting','120000','1200',701,'purchase'),
      ($2,$3,'underwriting','900000','9000',850,'refinance')`,
    [applicationA, applicationB, borrowerId],
  );
  await pool.query(
    `INSERT INTO documents
      (id,application_id,user_id,document_type,file_name,storage_path,status)
     VALUES
      ($1,$3,$4,'w2','Fictional app A W-2.pdf',$5,'verified'),
      ($2,$6,$4,'tax_return','Fictional app B return.pdf',$7,'verified')`,
    [
      documentA,
      documentB,
      applicationA,
      borrowerId,
      `/objects/${documentA}`,
      applicationB,
      `/objects/${documentB}`,
    ],
  );
  await pool.query(
    `INSERT INTO tax_extraction_runs
      (id,document_id,user_id,application_id,status,simulated,form_count,overall_confidence,started_at,completed_at)
     VALUES ($1,$2,$3,$4,'completed',true,1,'0.4000',now(),now())`,
    [runB, documentB, borrowerId, applicationB],
  );
  await pool.query(
    `INSERT INTO logical_documents
      (id,borrower_id,document_type,aggregated_confidence,status,tax_year,
       institution_name,source_document_id,extraction_run_id)
     VALUES ($1,$2,'w2','0.4000','needs_review',2025,'Fictional App B Employer',$3,$4)`,
    [logicalDocumentB, borrowerId, documentB, runB],
  );
  await pool.query(
    `INSERT INTO extracted_fields
      (logical_document_id,page_number,field_name,value_numeric,value_type,confidence,extraction_method)
     VALUES ($1,1,'wages','900000','currency','0.4000','fixture')`,
    [logicalDocumentB],
  );
});

afterAll(async () => {
  await pool.end();
});

describe.sequential("application-scoped financial signals", () => {
  it("builds the prediction graph from only the requested application", async () => {
    const graph = await buildBorrowerGraph(borrowerId, applicationA);

    expect(graph.applications.map((application) => application.id)).toEqual([applicationA]);
    expect(graph.activeApplicationId).toBe(applicationA);
    expect(graph.eligibility.creditScore).toBe(701);
    expect(graph.documents.map((document) => document.fileName)).toEqual([
      "Fictional app A W-2.pdf",
    ]);
    expect(graph.income).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amount: 900000, source: "document" }),
      ]),
    );
  });

  it("does not expose or mutate another application's tax review evidence", async () => {
    expect(await syncReviewItems(borrowerId, applicationA)).toEqual([]);

    const applicationBItems = await syncReviewItems(borrowerId, applicationB);
    const validItem = applicationBItems.find(
      (item) =>
        (item.evidence as { logicalDocumentId?: string } | null)?.logicalDocumentId ===
        logicalDocumentB,
    );
    expect(validItem).toBeTruthy();
    expect(validItem?.applicationId).toBe(applicationB);
    expect(validItem?.naturalKey).toContain(`app:${applicationB}:`);

    await pool.query(
      `INSERT INTO review_items
        (id,user_id,application_id,natural_key,item_type,tier,title,detail,evidence,status)
       VALUES
        ($1,$2,$3,$4,'extraction_low_confidence','flagged','Legacy cross-file item',
         'Must remain invisible and immutable from application A',$5::jsonb,'open')`,
      [
        corruptItemId,
        borrowerId,
        applicationA,
        `legacy-cross-file:${randomUUID()}`,
        JSON.stringify({ logicalDocumentId: logicalDocumentB, fieldName: "wages" }),
      ],
    );

    expect(await syncReviewItems(borrowerId, applicationA)).toEqual([]);
    expect(
      await resolveReviewItem({
        itemId: corruptItemId,
        applicationId: applicationA,
        actorId: borrowerId,
        action: "confirmed",
      }),
    ).toBeNull();

    const blocked = await pool.query(
      `SELECT r.status,f.human_verified
         FROM review_items r
         JOIN extracted_fields f ON f.logical_document_id=$2 AND f.field_name='wages'
        WHERE r.id=$1`,
      [corruptItemId, logicalDocumentB],
    );
    expect(blocked.rows[0]).toMatchObject({ status: "open", human_verified: false });

    const resolved = await resolveReviewItem({
      itemId: validItem!.id,
      applicationId: applicationB,
      actorId: borrowerId,
      action: "confirmed",
    });
    expect(resolved?.status).toBe("confirmed");
    const allowed = await pool.query(
      "SELECT human_verified FROM extracted_fields WHERE logical_document_id=$1 AND field_name='wages'",
      [logicalDocumentB],
    );
    expect(allowed.rows[0].human_verified).toBe(true);
  });
});
