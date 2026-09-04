import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { BASE_URL } from "./setup";

const appId = randomUUID(), otherAppId = randomUUID(), documentId = randomUUID(), factId = randomUUID();
const borrowerId = randomUUID();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const cookies: Record<string, string> = {};
const endpoint = `/api/loan-applications/${appId}/file-review`;
async function request(role: string, path = endpoint, body?: unknown) {
  return fetch(`${BASE_URL}${path}`, { method: body === undefined ? "GET" : "POST", headers: {
    Cookie: cookies[role] ?? "", Origin: BASE_URL, "Content-Type": "application/json",
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function current() { const response = await request("lo"); expect(response.status).toBe(200); return response.json(); }
async function save(revision: string, role = "lo") { return request(role, endpoint, { expectedRevision: revision, acknowledged: true }); }

beforeAll(async () => {
  // This suite creates only fictional records in the disposable local/CI database.
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("File review fixtures require a local test database");
  for (const role of ["admin", "lo", "loa", "closer", "buyer", "broker", "lender"]) {
    const response = await fetch(`${BASE_URL}/api/test-login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE_URL }, body: JSON.stringify({ email: `${role}@test.com`, password: process.env.DEV_TEST_PASSWORD || "test1234" }) });
    expect(response.status).toBe(200); cookies[role] = response.headers.get("set-cookie")!.split(";")[0];
  }
  // Intake resumes the shared test buyer's newest draft. Give this suite its own
  // borrower so parallel intake cannot resume a fixture that afterAll removes.
  await pool.query("INSERT INTO users (id,email,role) VALUES ($1,$2,'buyer')", [borrowerId, `file-review-${borrowerId}@example.test`]);
  await pool.query("INSERT INTO loan_applications (id,user_id,status) VALUES ($1,$3,'draft'),($2,$3,'draft')", [appId, otherAppId, borrowerId]);
  await pool.query("INSERT INTO deal_team_members (application_id,user_id,team_role,is_active) VALUES ($1,'test-lo','lo',true),($1,'test-closer','closer',true)", [appId]);
  await pool.query("INSERT INTO documents (id,application_id,user_id,document_type,file_name,storage_path,status) VALUES ($1,$2,$3,'bank_statement','Fictional statement.pdf','/objects/fictional-file-review','uploaded')", [documentId, appId, borrowerId]);
  await pool.query("INSERT INTO extracted_fields (id,document_id,field_name,value_numeric,value_type,confidence,extraction_method) VALUES ($1,$2,'closing_balance','3000','currency','0.9','fixture')", [factId, documentId]);
});
afterAll(async () => {
  await pool.query("DELETE FROM file_review_checkpoints WHERE application_id IN ($1,$2)", [appId, otherAppId]);
  await pool.query("DELETE FROM audit_logs WHERE target_id IN ($1,$2)", [appId, otherAppId]);
  await pool.query("DELETE FROM extracted_fields WHERE id=$1", [factId]);
  await pool.query("DELETE FROM documents WHERE id=$1", [documentId]);
  await pool.query("DELETE FROM deal_team_members WHERE application_id IN ($1,$2)", [appId, otherAppId]);
  await pool.query("DELETE FROM loan_applications WHERE id IN ($1,$2)", [appId, otherAppId]);
  await pool.query("DELETE FROM users WHERE id=$1", [borrowerId]);
  await pool.end();
});

describe.sequential("Core review inside the existing authenticated loan file", () => {
  it("requires a signed-in session", async () => { expect((await request("anonymous")).status).toBe(401); });
  it.each(["buyer", "broker", "lender"])("denies the %s role", async role => { expect((await request(role)).status).toBe(403); });
  it("denies an officer outside the deal team", async () => { expect((await request("loa")).status).toBe(404); });
  it("enforces exact application membership and read-only closer access", async () => {
    expect((await request("lo", `/api/loan-applications/${otherAppId}/file-review`)).status).toBe(404);
    const view = await current(); expect(view.manifest.documents.count).toBe(1); expect(view.manifest.facts.count).toBe(1);
    expect(view.documents[0].name).toBe("Fictional statement.pdf");
    expect(JSON.stringify(view)).not.toContain("/objects/fictional");
    const closer = await (await request("closer")).json(); expect(closer.canSave).toBe(false);
    expect((await save(view.revision, "closer")).status).toBe(403);
  });
  it("does not mistake an empty application for a reviewed file", async () => {
    const response = await request("admin", `/api/loan-applications/${otherAppId}/file-review`);
    const data = await response.json(); expect(data.canSave).toBe(false);
    expect((await request("admin", `/api/loan-applications/${otherAppId}/file-review`, { acknowledged: true, expectedRevision: data.revision })).status).toBe(409);
  });
  it("persists one review and its audit record without verifying outstanding documents or values", async () => {
    const before = await current();
    expect((await request("lo", endpoint, { expectedRevision: before.revision })).status).toBe(400);
    expect((await save(before.revision)).status).toBe(201);
    expect((await save(before.revision)).status).toBe(200);
    const after = await current(); expect(after.checkpoints).toHaveLength(1); expect(after.checkpoints[0].isStale).toBe(false);
    expect(after.unreviewedDocumentCount).toBe(1); expect(after.unreviewedFactCount).toBe(1);
    const audit = await pool.query("SELECT count(*) FROM audit_logs WHERE target_id=$1 AND action='file_review.checkpoint_recorded'", [appId]); expect(Number(audit.rows[0].count)).toBe(1);
  });
  it("rejects stale saves and retains the older review after document and value changes", async () => {
    const before = await current();
    await pool.query("UPDATE documents SET status='verified',reviewed_by_user_id='test-lo',reviewed_at=now(),updated_at=now() WHERE id=$1", [documentId]);
    await pool.query("UPDATE extracted_fields SET value_numeric='3500' WHERE id=$1", [factId]);
    expect((await save(before.revision)).status).toBe(409);
    const changed = await current(); expect(changed.checkpoints[0].isStale).toBe(true);
    expect(changed.checkpoints[0].staleReasons).toContain("Uploaded documents changed after this review.");
    expect(changed.checkpoints[0].staleReasons).toContain("Extracted values changed after this review.");
    expect((await save(changed.revision)).status).toBe(201);
    const after = await current(); expect(after.checkpoints).toHaveLength(2); expect(after.checkpoints[0].version).toBe(2);
    expect(after.checkpoints[0].isStale).toBe(false); expect(after.checkpoints[1].isStale).toBe(true);
  });
  it("handles simultaneous saves without duplicate history or an internal error", async () => {
    await pool.query("UPDATE extracted_fields SET value_numeric='3700' WHERE id=$1", [factId]);
    const view = await current(); const responses = await Promise.all([save(view.revision), save(view.revision)]);
    expect(responses.map(response => response.status)).toContain(201);
    for (const response of responses) expect([200, 201, 409]).toContain(response.status);
    expect((await current()).checkpoints).toHaveLength(3);
  });
  it("includes both extraction paths and excludes contradictory application references", async () => {
    const foreignDoc = randomUUID();
    const forms = Array.from({ length: 4 }, () => randomUUID());
    const facts = Array.from({ length: 4 }, () => randomUUID());
    try {
      await pool.query("INSERT INTO documents (id,application_id,user_id,document_type,file_name,storage_path) VALUES ($1,$2,$3,'other','Other file.pdf','/objects/fictional-other-review')", [foreignDoc, otherAppId, borrowerId]);
      await pool.query(`INSERT INTO logical_documents (id,loan_id,source_document_id,borrower_id,document_type,aggregated_confidence) VALUES
        ($1,$5,NULL,$9,'w2','0.9'),
        ($2,NULL,$7,$9,'w2','0.9'),
        ($3,$6,$7,$9,'w2','0.9'),
        ($4,$5,$8,$9,'w2','0.9')`, [...forms, appId, otherAppId, documentId, foreignDoc, borrowerId]);
      await pool.query(`INSERT INTO extracted_fields (id,document_id,logical_document_id,field_name,value_type,confidence,extraction_method) VALUES
        ($1,NULL,$5,'wages','currency','0.9','fixture'),
        ($2,$8,$6,'wages','currency','0.9','fixture'),
        ($3,$8,$7,'wages','currency','0.9','fixture'),
        ($4,$9,$5,'wages','currency','0.9','fixture')`, [...facts, ...forms.slice(0, 3), documentId, foreignDoc]);
      const view = await current();
      expect(view.manifest.documents.count).toBe(1);
      expect(view.manifest.forms.count).toBe(2);
      expect(view.manifest.facts.count).toBe(3);
    } finally {
      await pool.query("DELETE FROM extracted_fields WHERE id=ANY($1::varchar[])", [facts]);
      await pool.query("DELETE FROM logical_documents WHERE id=ANY($1::varchar[])", [forms]);
      await pool.query("DELETE FROM documents WHERE id=$1", [foreignDoc]);
    }
  });
  it("preserves history but does not save new reviews on a closed application", async () => {
    await pool.query("UPDATE loan_applications SET status='funded' WHERE id=$1", [appId]);
    const view = await current();
    expect(view.checkpoints).toHaveLength(3); expect(view.canSave).toBe(false);
    expect((await save(view.revision)).status).toBe(409);
  });
  it("revokes review access when the deal-team membership is removed", async () => {
    await pool.query("UPDATE deal_team_members SET is_active=false WHERE application_id=$1 AND user_id='test-lo'", [appId]);
    expect((await request("lo")).status).toBe(404); expect((await save("a".repeat(64))).status).toBe(404);
  });
});
