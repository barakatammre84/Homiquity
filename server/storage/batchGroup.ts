// Grouping helpers for the batched (`inArray`) read pattern — the house
// alternative to a per-row query in a list view (see /api/dashboard).
//
// The contract these helpers exist to protect: a batched read must return
// EXACTLY what N single-row reads would have returned, per key. Two rules make
// that true, and both are easy to get wrong by hand:
//
//   1. Run the single-row query's `orderBy` unchanged on the batched query.
//      Bucketing below preserves arrival order, and filtering a sorted list
//      keeps the relative order of the rows that survive — so each bucket
//      comes out in the same order the per-application query produced.
//   2. Every requested key gets an entry, including keys with no rows, so a
//      batched read answers exactly the question it was asked: you get back a
//      bucket for every id you handed in. Callers that fall back with `?? []`
//      do not depend on this — it is the storage boundary's contract, so a
//      caller reading `map.get(id)` directly cannot mistake "no rows" for
//      "never loaded".

/** Bucket rows by key, preserving arrival order within each bucket. */
export function groupRowsByKey<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(row);
    else grouped.set(key, [row]);
  }
  return grouped;
}

/**
 * Bucket rows by key, then guarantee an (empty) entry for every requested key.
 * Use when the caller iterates the keys it asked for rather than the map.
 */
export function groupRowsByKeyDense<T>(
  keys: readonly string[],
  rows: T[],
  keyOf: (row: T) => string,
): Map<string, T[]> {
  const grouped = groupRowsByKey(rows, keyOf);
  for (const key of keys) {
    if (!grouped.has(key)) grouped.set(key, []);
  }
  return grouped;
}

/**
 * Index rows by key, keeping the FIRST row seen per key — the batched
 * equivalent of a single-row `.limit(1)` read under the same `orderBy`.
 */
export function indexRowsByKey<T>(rows: T[], keyOf: (row: T) => string): Map<string, T> {
  const indexed = new Map<string, T>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!indexed.has(key)) indexed.set(key, row);
  }
  return indexed;
}
