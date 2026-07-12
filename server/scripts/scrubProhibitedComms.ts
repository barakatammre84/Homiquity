/**
 * Scrub prohibited LO → borrower messages.
 *
 * Finds STAFF-sent team_messages whose text is a Reg N §1014.3(q) approval
 * guarantee — the lint's hard-block category (`hardBlockMatches`). Such messages
 * predate the hard-block enforcement (or were sent via the old overridable
 * warning / inserted by tests) and must not sit in a borrower thread or appear
 * in a demo. Inbound borrower messages are never linted, so only staff senders
 * are considered.
 *
 * Dry-run by default (lists matches, changes nothing). Pass --apply to DELETE
 * them. Safe to run against dev or (founder-run) prod.
 *
 *   ./node_modules/.bin/tsx server/scripts/scrubProhibitedComms.ts
 *   ./node_modules/.bin/tsx server/scripts/scrubProhibitedComms.ts --apply
 */
import { db } from "../db";
import { teamMessages, users } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { isStaffRole } from "@shared/roles";
import { lintOutboundText } from "@shared/compliance/loCommsLint";

async function main() {
  const apply = process.argv.includes("--apply");

  const rows = await db
    .select({
      id: teamMessages.id,
      message: teamMessages.message,
      role: users.role,
    })
    .from(teamMessages)
    .leftJoin(users, eq(teamMessages.senderId, users.id));

  const offending = rows.filter(
    (r) =>
      typeof r.role === "string" &&
      isStaffRole(r.role) &&
      lintOutboundText(r.message).hardBlockMatches.length > 0,
  );

  console.log(
    `Scanned ${rows.length} team message(s); found ${offending.length} prohibited ` +
      `staff approval-guarantee message(s).`,
  );
  for (const o of offending) {
    const preview = o.message.length > 90 ? `${o.message.slice(0, 90)}…` : o.message;
    console.log(`  [${o.id}] ${preview}`);
  }

  if (offending.length === 0) {
    console.log("Nothing to scrub.");
    return;
  }
  if (!apply) {
    console.log("\nDry run — nothing changed. Re-run with --apply to DELETE these messages.");
    return;
  }

  const ids = offending.map((o) => o.id);
  await db.delete(teamMessages).where(inArray(teamMessages.id, ids));
  console.log(`\nDeleted ${ids.length} prohibited message(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
