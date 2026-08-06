import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

import { friendlyApiError } from "../client/src/lib/errorMessage";

/**
 * What a borrower reads when document upload is unconfigured.
 *
 * Object storage has no credentials in production, so /api/uploads/request-url
 * returns 503 UPLOADS_UNCONFIGURED for every attempt. That envelope is not
 * swallowed: friendlyApiError has a deliberate-503 carve-out that passes an
 * enveloped 503 through verbatim, and UploadDocumentDialog renders it straight
 * into the toast. So the server string IS the user-facing copy.
 *
 * It said "temporarily unavailable — please try again later". Both halves were
 * false. Storage is unconfigured, not degraded: waiting changes nothing and
 * retrying can never succeed. A borrower could retry a pay stub indefinitely,
 * believing the failure was transient or caused by their file.
 */

const DOCS = readFileSync(
  path.join(path.resolve(__dirname, ".."), "server/routes/documents.ts"),
  "utf8",
);

/**
 * The exact string the route returns for UPLOADS_UNCONFIGURED — read from the
 * source so the assertions track the real copy rather than a restatement of it.
 * Anchored on the 503 that opens the same object literal, so an explanatory
 * comment of any length between `error:` and the string cannot shift the window.
 */
const message = (() => {
  const at = DOCS.indexOf('code: "UPLOADS_UNCONFIGURED"');
  const open = DOCS.lastIndexOf("res.status(503)", at);
  const block = DOCS.slice(open, at);
  const m = [...block.matchAll(/error:\s*"((?:[^"\\]|\\.)*)"/g)];
  return m.length ? m[m.length - 1][1] : "";
})();

describe("the unconfigured-upload message", () => {
  it("does not promise a retry that cannot succeed", () => {
    expect(message).not.toMatch(/try again/i);
    expect(message).not.toMatch(/temporarily/i);
    expect(message).not.toMatch(/later/i);
  });

  it("says retrying will not help, explicitly", () => {
    expect(message).toMatch(/retrying won't help/i);
  });

  it("tells the borrower it is not their file", () => {
    // Otherwise the natural inference from a failed upload is a bad PDF.
    expect(message).toMatch(/not a problem with your file/i);
  });

  it("gives a route that actually works today", () => {
    expect(message).toMatch(/loan officer/i);
  });
});

describe("the message reaches the borrower unchanged", () => {
  it("survives friendlyApiError's 5xx suppression via the deliberate-503 carve-out", () => {
    // Without the carve-out this would be replaced by the generic fallback and
    // the honest copy would never be seen.
    const thrown = `503: ${JSON.stringify({ error: message, code: "UPLOADS_UNCONFIGURED" })}`;
    expect(friendlyApiError(new Error(thrown), "FALLBACK")).toBe(message);
  });

  it("a 500 without an envelope is still suppressed", () => {
    // Guard against the carve-out being widened into a leak of internal errors.
    expect(friendlyApiError(new Error("500: internal boom"), "FALLBACK")).toBe("FALLBACK");
  });
});
