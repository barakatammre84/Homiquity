import { describe, expect, it } from "vitest";

import { formatCspReports } from "../server/app";

/**
 * CSP violation reports must name the script that caused them, and must not
 * carry a credential into the log while doing it.
 *
 * WHY THIS FILE EXISTS
 *
 * A recurring `script-src`/`eval` violation fired on every load of /signup and
 * /dashboard in production. It was impossible to chase, because the log line
 * carried only the directive, the blocked keyword and the page — never the
 * source file, line, or the evaluated sample. Every chunk the page loads was
 * downloaded and grepped by hand for `eval(`, `new Function`, `(0,eval)`,
 * `["eval"]`, `WebAssembly` and `setTimeout("…")`; all came back clean, and the
 * investigation dead-ended on missing report fields rather than on evidence.
 *
 * So the first group below pins the fields that make a report actionable. The
 * second pins the Reporting API shape, which previously logged a line of
 * all-"?" — present in the log, carrying nothing. The third pins the redaction:
 * a violation on a token-bearing recovery URL must not write the token down.
 */

const LEGACY = {
  "csp-report": {
    "document-uri": "https://www.homiquity.com/signup",
    "violated-directive": "script-src",
    "effective-directive": "script-src",
    "blocked-uri": "eval",
    "source-file": "https://www.homiquity.com/assets/index-CAwOuPUX.js",
    "line-number": 42,
    "column-number": 7,
    "script-sample": "call to eval() blocked",
  },
};

const REPORTING_API = [
  {
    type: "csp-violation",
    url: "https://www.homiquity.com/dashboard",
    body: {
      documentURL: "https://www.homiquity.com/dashboard",
      effectiveDirective: "script-src",
      blockedURL: "eval",
      sourceFile: "https://www.homiquity.com/assets/index-CAwOuPUX.js",
      lineNumber: 99,
      columnNumber: 3,
      sample: "call to eval() blocked",
    },
  },
];

describe("formatCspReports — the fields that make a report actionable", () => {
  it("names the source file, line and column for a legacy report-uri payload", () => {
    const [line] = formatCspReports(LEGACY);
    expect(line).toContain("source=https://www.homiquity.com/assets/index-CAwOuPUX.js:42:7");
  });

  it("includes the evaluated sample — the field that identifies the caller", () => {
    const [line] = formatCspReports(LEGACY);
    expect(line).toContain('sample="call to eval() blocked"');
  });

  it("still reports directive, blocked and page", () => {
    const [line] = formatCspReports(LEGACY);
    expect(line).toContain("directive=script-src");
    expect(line).toContain("blocked=eval");
    expect(line).toContain("page=https://www.homiquity.com/signup");
  });
});

describe("formatCspReports — Reporting API (report-to) envelopes", () => {
  it("parses the array-of-envelopes shape instead of logging all-'?'", () => {
    const [line] = formatCspReports(REPORTING_API);
    // The regression: indexing body["csp-report"] on an array yielded undefined
    // for every field, producing a line that looked like a log entry and told
    // nobody anything.
    expect(line).not.toContain("directive=?");
    expect(line).not.toContain("source=?");
    expect(line).toContain("source=https://www.homiquity.com/assets/index-CAwOuPUX.js:99:3");
  });

  it("emits one line per envelope when a batch arrives", () => {
    expect(formatCspReports([...REPORTING_API, ...REPORTING_API])).toHaveLength(2);
  });

  it("caps the batch so an unauthenticated POST cannot flood the log", () => {
    // The 50kb body limit still admits thousands of tiny envelopes, and the
    // endpoint takes no credential — one log line each would be a flood
    // primitive, not a diagnostic.
    const flood = Array.from({ length: 500 }, () => REPORTING_API[0]);
    expect(formatCspReports(flood).length).toBeLessThanOrEqual(10);
  });
});

describe("formatCspReports — redaction", () => {
  it("strips the query string so a reset token never reaches the log", () => {
    const [line] = formatCspReports({
      "csp-report": {
        "document-uri": "https://www.homiquity.com/reset-password?token=live-single-use-secret",
        "violated-directive": "script-src",
        "blocked-uri": "eval",
      },
    });
    expect(line).not.toContain("live-single-use-secret");
    expect(line).toContain("page=https://www.homiquity.com/reset-password?<redacted>");
  });

  it("redacts a token carried on source-file too", () => {
    const [line] = formatCspReports({
      "csp-report": { "source-file": "https://www.homiquity.com/verify-email?token=another-secret" },
    });
    expect(line).not.toContain("another-secret");
  });

  it("leaves bare keyword blocked-uri values alone", () => {
    // "eval" / "inline" are not URLs; redaction must not mangle them.
    for (const keyword of ["eval", "inline", "wasm-eval"]) {
      const [line] = formatCspReports({ "csp-report": { "blocked-uri": keyword } });
      expect(line).toContain(`blocked=${keyword}`);
    }
  });

  it("truncates an oversized sample rather than dumping it into the log", () => {
    // The spec caps script-sample at 40 chars; a non-conforming client must not
    // be able to write an arbitrary payload to the log.
    const [line] = formatCspReports({ "csp-report": { "script-sample": "A".repeat(5000) } });
    expect(line.length).toBeLessThan(400);
  });
});

describe("formatCspReports — malformed input", () => {
  it.each([undefined, null, {}, [], "not-json", 42])("does not throw on %j", (input) => {
    expect(() => formatCspReports(input)).not.toThrow();
  });

  it("renders unknown fields as '?' rather than 'undefined'", () => {
    const [line] = formatCspReports({});
    expect(line).toContain("directive=?");
    expect(line).not.toContain("undefined");
  });
});
