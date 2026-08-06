/**
 * XSD-validation of generated MISMO 3.4 XML against the official Fannie Mae /
 * MISMO reference schema checked into docs/fannie-mae/schemas/ (see L6 in
 * CTO_ROADMAP.md). This is a stricter check than validateMISMOXML() in
 * server/mismo.ts, which only catches our own hand-built structural mistakes
 * (missing declaration, dangling xlink refs, etc.) — this one validates the
 * full element tree against the real schema.
 *
 * Shells out to the system `xmllint` binary (libxml2) because there is no
 * pure-JS XSD validator for a schema this size (MISMO_3_0.xsd is ~32k lines).
 * When xmllint isn't installed, callers get `skipped: true` rather than a
 * false failure — this must never turn an environment without libxml2 into a
 * false "invalid" result.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url)); // .../server/services
export const MISMO_BASE_XSD = path.resolve(
  here,
  "../../docs/fannie-mae/schemas/uldd-phase5-extension/MISMO_3_0.xsd",
);
/**
 * The ULDD Phase 5 extension schema that ships alongside the base model. It
 * declares the `ULDD:OTHER` wrapper and every `*_EXTENSION` container Fannie
 * layers on top of MISMO 3.0.
 */
export const ULDD_EXTENSION_XSD = path.resolve(
  here,
  "../../docs/fannie-mae/schemas/uldd-phase5-extension/ULDD_Phase_5_Extension.xsd",
);

export interface XsdValidationResult {
  /** true when xmllint ran and found no schema violations. */
  valid: boolean;
  /** raw xmllint validity-error lines, one per violation. */
  errors: string[];
  /** true when xmllint is not installed — errors/valid are meaningless. */
  skipped: boolean;
}

let xmllintAvailable: boolean | undefined;

function hasXmllint(): boolean {
  if (xmllintAvailable === undefined) {
    try {
      execFileSync("xmllint", ["--version"], { stdio: "ignore" });
      xmllintAvailable = true;
    } catch {
      xmllintAvailable = false;
    }
  }
  return xmllintAvailable;
}

/**
 * Validates `xml` against the XSD at `xsdPath` using `xmllint --schema`.
 * Pure w.r.t. inputs (writes to a throwaway temp file only); safe to call
 * from unit tests.
 */
export function validateAgainstXsd(xml: string, xsdPath: string): XsdValidationResult {
  if (!hasXmllint()) {
    return { valid: false, errors: [], skipped: true };
  }

  const dir = mkdtempSync(path.join(tmpdir(), "mismo-xsd-"));
  const xmlPath = path.join(dir, "doc.xml");
  try {
    writeFileSync(xmlPath, xml);
    execFileSync("xmllint", ["--noout", "--schema", xsdPath, xmlPath], { stdio: "pipe" });
    return { valid: true, errors: [], skipped: false };
  } catch (err) {
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString("utf8") ?? String(err);
    const errors = stderr
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.endsWith("fails to validate"));
    return { valid: false, errors, skipped: false };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Validates a generated MISMO export against BOTH schemas of the ULDD Phase 5
 * distribution — the base model *and* the Fannie extension — rather than the
 * base model alone.
 *
 * Why this exists (2026-08-06): the base model's `EXTENSION` container is
 * `<xsd:any namespace="##any" processContents="lax"/>` (MISMO_3_0.xsd:6016).
 * `lax` means "validate against a declaration if one can be found, otherwise
 * skip silently". With only `MISMO_3_0.xsd` loaded, no ULDD-namespace
 * declaration is resolvable, so **everything inside every EXTENSION was
 * skipped** — a fabricated ULDD element name, a fabricated ULDD container, and
 * a bad value for a real ULDD indicator all validated clean. That is the exact
 * class of defect this gate exists to catch, and it was invisible.
 *
 * The wrapper schema is generated per call rather than checked in: it needs
 * absolute `schemaLocation` paths, and a committed .xsd would be one more file
 * that has to survive bundling/deploy to keep the gate honest.
 */
export function validateMismoExport(xml: string): XsdValidationResult {
  if (!hasXmllint()) {
    return { valid: false, errors: [], skipped: true };
  }
  const dir = mkdtempSync(path.join(tmpdir(), "mismo-xsd-wrapper-"));
  const wrapperPath = path.join(dir, "mismo-with-uldd.xsd");
  // A checkout path may legally contain XML-significant characters (&, <, ").
  const attr = (p: string) =>
    p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  try {
    writeFileSync(
      wrapperPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:import namespace="http://www.mismo.org/residential/2009/schemas" schemaLocation="${attr(MISMO_BASE_XSD)}"/>
  <xsd:import namespace="http://www.datamodelextension.org/Schema/ULDD" schemaLocation="${attr(ULDD_EXTENSION_XSD)}"/>
</xsd:schema>`,
    );
    return validateAgainstXsd(xml, wrapperPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Extracts the distinct MISMO element names xmllint flagged as unexpected —
 * a stable summary of *what* is non-conformant, independent of line numbers
 * (which shift with any DTO/formatting change and would make a full-message
 * baseline brittle).
 */
export function extractOffendingElements(errors: string[]): string[] {
  const names = new Set<string>();
  for (const line of errors) {
    const match = line.match(/Element '\{[^}]*\}([A-Za-z0-9_]+)'/);
    if (match) {
      names.add(match[1]);
    }
  }
  return Array.from(names).sort();
}
