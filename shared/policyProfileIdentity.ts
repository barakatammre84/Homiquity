/**
 * How a policy profile is named and versioned.
 *
 * profile_id and version are free varchars in the schema, and version is
 * commented "CRITICAL for legal compliance" — so the convention lives here,
 * enforced in one place, rather than being retyped by whoever opens the
 * create dialog.
 *
 * Convention: {AUTHORITY}_{PRODUCT}_{YYYY}_Q{n}, e.g. FNMA_CONVENTIONAL_2026_Q3.
 * Authority, product and the effective quarter are what actually distinguish
 * one policy from another in mortgage lending, so the identifier is derivable
 * from the fields the operator has already filled in.
 *
 * Pure: no clock, no I/O. The quarter comes from the effective date the
 * operator chose, never from today.
 */

/**
 * Authority enum value -> the abbreviation used in a profile id.
 *
 * The GSEs get their standard market abbreviations (Fannie Mae is FNMA,
 * Freddie Mac is FHLMC); everything else already is its own abbreviation.
 */
export const AUTHORITY_ABBREVIATION: Record<string, string> = {
  FANNIE: "FNMA",
  FREDDIE: "FHLMC",
  FHA: "FHA",
  VA: "VA",
  LENDER: "LENDER",
  BROKER: "BROKER",
};

export const POLICY_AUTHORITIES = ["FANNIE", "FREDDIE", "FHA", "VA", "LENDER", "BROKER"] as const;
export const POLICY_PRODUCT_TYPES = ["CONVENTIONAL", "FHA", "VA", "HELOC"] as const;

/** Calendar quarter, 1-4, of a yyyy-mm-dd date. */
export function quarterOf(effectiveDate: string): number {
  const month = Number(effectiveDate.slice(5, 7));
  return Math.floor((month - 1) / 3) + 1;
}

export interface ProfileIdParts {
  authority: string;
  productType: string;
  /** yyyy-mm-dd. */
  effectiveDate: string;
}

/**
 * Build the profile id for a new policy.
 *
 * An unmapped authority falls back to its own value rather than being dropped:
 * a new authority should produce an odd-looking id that someone notices, not
 * an id missing its first segment.
 */
export function buildProfileId({ authority, productType, effectiveDate }: ProfileIdParts): string {
  const abbr = AUTHORITY_ABBREVIATION[authority] ?? authority;
  const year = effectiveDate.slice(0, 4);
  return `${abbr}_${productType}_${year}_Q${quarterOf(effectiveDate)}`;
}

/** The version a brand-new policy starts at. */
export const INITIAL_POLICY_VERSION = "1.0.0";

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

/** Parse "1.2.3". Returns null for anything that is not three integers. */
export function parseVersion(version: string): SemVer | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/**
 * The next minor version: 1.0.0 -> 1.1.0, 1.4.7 -> 1.5.0.
 *
 * Returns null rather than guessing when the source version is not semver.
 * Version is the field the compliance record hangs off, so a clone of an
 * unparseable version is refused and the operator sets it deliberately —
 * inventing one would put a fabricated version on a policy document.
 */
export function bumpMinorVersion(version: string): string | null {
  const parsed = parseVersion(version);
  if (!parsed) return null;
  return `${parsed.major}.${parsed.minor + 1}.0`;
}

/** Highest version among the given ones, ignoring unparseable entries. */
export function highestVersion(versions: string[]): string | null {
  let best: { raw: string; v: SemVer } | null = null;
  for (const raw of versions) {
    const v = parseVersion(raw);
    if (!v) continue;
    if (
      !best ||
      v.major > best.v.major ||
      (v.major === best.v.major && v.minor > best.v.minor) ||
      (v.major === best.v.major && v.minor === best.v.minor && v.patch > best.v.patch)
    ) {
      best = { raw, v };
    }
  }
  return best?.raw ?? null;
}

/**
 * The version a clone should take, given every version already in use for
 * that profile id.
 *
 * Bumps from the HIGHEST existing version, not from the one being cloned, so
 * cloning the same source twice yields 1.1.0 then 1.2.0 instead of colliding
 * on 1.1.0 — which the unique index on (profile_id, version) would reject.
 */
export function nextCloneVersion(sourceVersion: string, existingVersions: string[]): string | null {
  const highest = highestVersion([sourceVersion, ...existingVersions]);
  if (!highest) return null;
  return bumpMinorVersion(highest);
}
