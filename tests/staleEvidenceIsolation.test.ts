import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { buildBorrowerGraph } from "../server/services/borrowerGraph";
import {
  countOpenReviewItems,
  resolveReviewItem,
  syncReviewItems,
} from "../server/services/income/reviewTriage";

const borrowerId = randomUUID();
const applicationId = randomUUID();
const lineageId = randomUUID();
const versionIds = Array.from({ length: 6 }, () => randomUUID());
const currentDocumentId = versionIds[versionIds.length - 1];
const rejectedDocumentId = randomUUID();
const oldRunId = randomUUID();
const priorCurrentRunId = randomUUID();
const currentRunId = randomUUID();
const oldLogicalDocumentId = randomUUID();
const priorCurrentLogicalDocumentId = randomUUID();
const currentLogicalDocumentId = randomUUID();
let staleReviewItemId = "";
let staleReextractionReviewItemId = "";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Stale evidence fixtures require a local test database");
  }

  await pool.query(
    `INSERT INTO users (id,email,first_name,last_name,role)
     VALUES ($1,$2,'Fictional','Lineage Borrower','buyer')`,
    [borrowerId, `stale-evidence-${borrowerId}@example.test`],
  );
  await pool.query(
    `INSERT INTO loan_applications (id,user_id,status,loan_purpose)
     VALUES ($1,$2,'underwriting','purchase')`,
    [applicationId, borrowerId],
  );

  // Version 1 starts as the current file and creates a real review row through
  // production triage. Later versions reproduce the identical-finding
  // replacement that used to collide with that row's borrower-wide key.
  for (let index = 0; index < 1; index += 1) {
    const documentId = versionIds[index];
    await pool.query(
      `INSERT INTO documents
        (id,application_id,user_id,document_type,file_name,storage_path,status)
       VALUES ($1,$2,$3,'w2',$4,$5,'verified')`,
      [
        documentId,
        applicationId,
        borrowerId,
        `Fictional W-2 version ${index + 1}.pdf`,
        `/objects/${documentId}`,
      ],
    );
    await pool.query(
      `INSERT INTO document_lineage
        (application_id,document_id,lineage_id,version_number,replaces_document_id,
         subject_type,subject_id,recorded_by_user_id)
       VALUES ($1,$2,$3,$4,$5,'borrower',$6,$6)`,
      [
        applicationId,
        documentId,
        lineageId,
        index + 1,
        index === 0 ? null : versionIds[index - 1],
        borrowerId,
      ],
    );
  }

  await pool.query(
    `INSERT INTO tax_extraction_runs
      (id,document_id,user_id,application_id,status,simulated,form_count,overall_confidence,started_at,completed_at)
     VALUES ($1,$2,$3,$4,'completed',true,1,'0.4000',now(),now())`,
    [oldRunId, versionIds[0], borrowerId, applicationId],
  );
  await pool.query(
    `INSERT INTO logical_documents
      (id,loan_id,borrower_id,document_type,aggregated_confidence,status,tax_year,
       institution_name,source_document_id,extraction_run_id)
     VALUES ($1,$2,$3,'w2','0.4000','needs_review',2025,'Fictional Prior Employer',$4,$5)`,
    [oldLogicalDocumentId, applicationId, borrowerId, versionIds[0], oldRunId],
  );
  await pool.query(
    `INSERT INTO extracted_fields
      (logical_document_id,page_number,field_name,value_numeric,value_type,confidence,extraction_method)
     VALUES ($1,1,'wages','100000','currency','0.4000','fixture')`,
    [oldLogicalDocumentId],
  );
  const [initialReviewItem] = await syncReviewItems(borrowerId, applicationId);
  if (!initialReviewItem) throw new Error("Expected the original low-confidence review item");
  staleReviewItemId = initialReviewItem.id;

  for (let index = 1; index < versionIds.length; index += 1) {
    const documentId = versionIds[index];
    await pool.query(
      `INSERT INTO documents
        (id,application_id,user_id,document_type,file_name,storage_path,status)
       VALUES ($1,$2,$3,'w2',$4,$5,'verified')`,
      [
        documentId,
        applicationId,
        borrowerId,
        `Fictional W-2 version ${index + 1}.pdf`,
        `/objects/${documentId}`,
      ],
    );
    await pool.query(
      `INSERT INTO document_lineage
        (application_id,document_id,lineage_id,version_number,replaces_document_id,
         subject_type,subject_id,recorded_by_user_id)
       VALUES ($1,$2,$3,$4,$5,'borrower',$6,$6)`,
      [applicationId, documentId, lineageId, index + 1, versionIds[index - 1], borrowerId],
    );
  }

  await pool.query(
    `INSERT INTO tax_extraction_runs
      (id,document_id,user_id,application_id,status,simulated,form_count,overall_confidence,started_at,completed_at)
     VALUES ($1,$2,$3,$4,'completed',true,1,'0.4000',now(),now())`,
    [priorCurrentRunId, currentDocumentId, borrowerId, applicationId],
  );
  await pool.query(
    `INSERT INTO logical_documents
      (id,loan_id,borrower_id,document_type,aggregated_confidence,status,tax_year,
       institution_name,source_document_id,extraction_run_id)
     VALUES ($1,$2,$3,'w2','0.4000','needs_review',2025,'Fictional Prior Employer',$4,$5)`,
    [
      priorCurrentLogicalDocumentId,
      applicationId,
      borrowerId,
      currentDocumentId,
      priorCurrentRunId,
    ],
  );
  await pool.query(
    `INSERT INTO extracted_fields
      (logical_document_id,page_number,field_name,value_numeric,value_type,confidence,extraction_method)
     VALUES ($1,1,'wages','100000','currency','0.4000','fixture')`,
    [priorCurrentLogicalDocumentId],
  );
  const [priorCurrentItem] = await syncReviewItems(borrowerId, applicationId);
  if (
    !priorCurrentItem ||
    (priorCurrentItem.evidence as { logicalDocumentId?: string }).logicalDocumentId !==
      priorCurrentLogicalDocumentId
  ) {
    throw new Error("Expected the current file's first extraction review item");
  }
  staleReextractionReviewItemId = priorCurrentItem.id;

  await pool.query(
    `INSERT INTO documents
      (id,application_id,user_id,document_type,file_name,storage_path,status)
     VALUES ($1,$2,$3,'tax_return','Fictional rejected return.pdf',$4,'rejected')`,
    [rejectedDocumentId, applicationId, borrowerId, `/objects/${rejectedDocumentId}`],
  );
  await pool.query(
    `INSERT INTO document_lineage
      (application_id,document_id,lineage_id,version_number,subject_type,subject_id,recorded_by_user_id)
     VALUES ($1,$2,$3,1,'borrower',$4,$4)`,
    [applicationId, rejectedDocumentId, randomUUID(), borrowerId],
  );

  await pool.query(
    `INSERT INTO tax_extraction_runs
      (id,document_id,user_id,application_id,status,simulated,form_count,overall_confidence,started_at,completed_at)
     VALUES ($1,$2,$3,$4,'completed',true,1,'0.4000',now() + interval '1 second',now() + interval '1 second')`,
    [currentRunId, currentDocumentId, borrowerId, applicationId],
  );
  await pool.query(
    `INSERT INTO logical_documents
      (id,loan_id,borrower_id,document_type,aggregated_confidence,status,tax_year,
       institution_name,source_document_id,extraction_run_id)
     VALUES ($1,$2,$3,'w2','0.4000','needs_review',2025,'Fictional Prior Employer',$4,$5)`,
    [
      currentLogicalDocumentId,
      applicationId,
      borrowerId,
      currentDocumentId,
      currentRunId,
    ],
  );
  await pool.query(
    `INSERT INTO extracted_fields
      (logical_document_id,page_number,field_name,value_numeric,value_type,confidence,extraction_method)
     VALUES ($1,1,'wages','100000','currency','0.4000','fixture')`,
    [currentLogicalDocumentId],
  );
});

afterAll(async () => {
  await pool.end();
});

describe.sequential("current document evidence isolation", () => {
  it("uses only the current accepted version in borrower and prediction inputs", async () => {
    const graph = await buildBorrowerGraph(borrowerId, applicationId);

    expect(graph.documents.map((document) => document.fileName)).toEqual([
      "Fictional W-2 version 6.pdf",
    ]);
    expect(graph.documentsUploaded).toBe(1);
    expect(graph.documentsVerified).toBe(1);
    expect(graph.documentsMissing).toContain("tax_return");
  });

  it("replaces a stale review item with actionable work for identical current evidence", async () => {
    const currentItems = await syncReviewItems(borrowerId, applicationId);
    expect(
      currentItems.map((item) => ({
        id: item.id,
        logicalDocumentId: (item.evidence as { logicalDocumentId?: string }).logicalDocumentId,
        itemType: item.itemType,
      })),
    ).toEqual([
      expect.objectContaining({
        logicalDocumentId: currentLogicalDocumentId,
        itemType: "extraction_low_confidence",
      }),
    ]);
    expect(currentItems[0].id).not.toBe(staleReviewItemId);
    expect(
      (currentItems[0].evidence as { logicalDocumentId?: string }).logicalDocumentId,
    ).toBe(currentLogicalDocumentId);
    expect(await countOpenReviewItems(applicationId)).toBe(1);

    expect(
      await resolveReviewItem({
        itemId: staleReviewItemId,
        applicationId,
        actorId: borrowerId,
        action: "confirmed",
      }),
    ).toBeNull();
    expect(
      await resolveReviewItem({
        itemId: staleReextractionReviewItemId,
        applicationId,
        actorId: borrowerId,
        action: "confirmed",
      }),
    ).toBeNull();

    const result = await pool.query(
      `SELECT r.id,r.status,f.human_verified
         FROM review_items r
         JOIN extracted_fields f
           ON f.logical_document_id = CASE
                WHEN r.id=$1 THEN $3
                WHEN r.id=$2 THEN $4
              END
          AND f.field_name='wages'
        WHERE r.id IN ($1,$2)
        ORDER BY r.id`,
      [
        staleReviewItemId,
        staleReextractionReviewItemId,
        oldLogicalDocumentId,
        priorCurrentLogicalDocumentId,
      ],
    );
    expect(result.rows).toEqual([
      expect.objectContaining({ status: "open", human_verified: false }),
      expect.objectContaining({ status: "open", human_verified: false }),
    ]);

    expect(
      await resolveReviewItem({
        itemId: currentItems[0].id,
        applicationId,
        actorId: borrowerId,
        action: "confirmed",
      }),
    ).toMatchObject({ status: "confirmed" });
    expect(await countOpenReviewItems(applicationId)).toBe(0);
  });
});
