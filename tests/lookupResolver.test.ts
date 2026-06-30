import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  LookupResolverService,
  lookupResolver,
  type StampReader,
  type ValueResolver,
} from "../server/services/lookupResolver";

// ---------------------------------------------------------------------------
// Hermetic cache-coherence tests.
//
// The resolved-value cache is per-process and in-memory. Production runs on an
// autoscale deployment, so more than one instance can serve traffic and a
// lifecycle mutation handled by one instance never reaches another instance's
// local cache. These tests simulate that by giving two LookupResolverService
// instances independent caches but a SHARED backing store (the `store` object),
// exactly like two server processes sharing one database.
//
// No real database is touched: the stamp reader and value resolver are injected.
// ---------------------------------------------------------------------------

interface SharedStore {
  stamp: number; // cross-process invalidation stamp (MAX(updated_at) analogue)
  value: number; // current resolved value
  expiresAt: number | null; // matrix expiration as epoch-ms
}

const CODE = "CONVENTIONAL_DTI_CAP";

function makeStore(): SharedStore {
  return { stamp: 1, value: 43, expiresAt: null };
}

/**
 * Simulates a lifecycle mutation (activate/retire/reschedule): the value
 * changes and the shared stamp advances, just like updateLookupMatrix bumping
 * updated_at in the database.
 */
function mutate(store: SharedStore, newValue: number): void {
  store.value = newValue;
  store.stamp += 1;
}

function makeReaders(store: SharedStore) {
  const stampReads = { count: 0 };
  const valueResolves = { count: 0 };

  const stampReader: StampReader = async () => {
    stampReads.count += 1;
    return store.stamp;
  };
  const valueResolver: ValueResolver = async () => {
    valueResolves.count += 1;
    return { value: store.value, expiresAt: store.expiresAt };
  };

  return { stampReader, valueResolver, stampReads, valueResolves };
}

describe("LookupResolverService — caching", () => {
  it("caches resolved values so repeated reads do not re-resolve (default strict mode)", async () => {
    const store = makeStore();
    const { stampReader, valueResolver, valueResolves } = makeReaders(store);
    // No stampWindowMs => default strict mode (stamp checked every read). The
    // value cache still serves repeated reads because the stamp is unchanged.
    const resolver = new LookupResolverService({
      stampReader,
      valueResolver,
    });

    expect(await resolver.resolveMatrixValue({ matrixCode: CODE })).toBe(43);
    expect(await resolver.resolveMatrixValue({ matrixCode: CODE })).toBe(43);
    expect(await resolver.resolveMatrixValue({ matrixCode: CODE })).toBe(43);

    // Only the first call hit the (expensive) value resolver.
    expect(valueResolves.count).toBe(1);
  });
});

describe("LookupResolverService — same-process invalidation", () => {
  it("reflects a lifecycle change immediately after invalidate()", async () => {
    const store = makeStore();
    const { stampReader, valueResolver, valueResolves } = makeReaders(store);
    const resolver = new LookupResolverService({
      stampReader,
      valueResolver,
      stampWindowMs: 60_000, // long window: only invalidate() should free it
    });

    expect(await resolver.resolveMatrixValue({ matrixCode: CODE })).toBe(43);

    // Operator activates a new matrix version on THIS instance.
    mutate(store, 50);
    resolver.invalidateInstance(CODE);

    // The very next read returns the new value, despite the long stamp window.
    expect(await resolver.resolveMatrixValue({ matrixCode: CODE })).toBe(50);
    expect(valueResolves.count).toBe(2);
  });

  it("invalidate() without a code clears everything", async () => {
    const store = makeStore();
    const { stampReader, valueResolver } = makeReaders(store);
    const resolver = new LookupResolverService({
      stampReader,
      valueResolver,
      stampWindowMs: 60_000,
    });

    await resolver.resolveMatrixValue({ matrixCode: CODE });
    mutate(store, 99);
    resolver.invalidateInstance();
    expect(await resolver.resolveMatrixValue({ matrixCode: CODE })).toBe(99);
  });
});

describe("LookupResolverService — cross-process (multi-instance) coherence", () => {
  it("a sibling instance picks up a change immediately in default (strict) mode", async () => {
    const store = makeStore();
    const a = makeReaders(store);
    const b = makeReaders(store);

    // Two independent caches, one shared store == two processes, one database.
    // No stampWindowMs => default strict mode, i.e. the production default.
    const instanceA = new LookupResolverService({
      stampReader: a.stampReader,
      valueResolver: a.valueResolver,
    });
    const instanceB = new LookupResolverService({
      stampReader: b.stampReader,
      valueResolver: b.valueResolver,
    });

    expect(await instanceA.resolveMatrixValue({ matrixCode: CODE })).toBe(43);
    expect(await instanceB.resolveMatrixValue({ matrixCode: CODE })).toBe(43);

    // Instance A handles the mutation and clears ONLY its own cache.
    mutate(store, 50);
    instanceA.invalidateInstance(CODE);

    // Instance B was never told, but the shared stamp moved, so its next read
    // sees the new value rather than quoting the stale/expired 43.
    expect(await instanceB.resolveMatrixValue({ matrixCode: CODE })).toBe(50);
    // B had to re-resolve (1 initial + 1 after stamp change).
    expect(b.valueResolves.count).toBe(2);
  });

  it("opt-in performance mode (stampWindowMs>0) coalesces stamp reads, then converges", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T12:00:00Z"));
    try {
      const store = makeStore();
      const b = makeReaders(store);
      const instanceB = new LookupResolverService({
        stampReader: b.stampReader,
        valueResolver: b.valueResolver,
        stampWindowMs: 1000,
      });

      expect(await instanceB.resolveMatrixValue({ matrixCode: CODE })).toBe(43);

      // A mutation happens elsewhere mid-window.
      mutate(store, 50);

      // Within the window, B keeps serving the coalesced value and does not even
      // re-read the stamp (load protection).
      expect(await instanceB.resolveMatrixValue({ matrixCode: CODE })).toBe(43);
      expect(b.stampReads.count).toBe(1);

      // After the window elapses, B re-reads the stamp, sees the change, and
      // converges on the fresh value.
      await vi.advanceTimersByTimeAsync(1500);
      expect(await instanceB.resolveMatrixValue({ matrixCode: CODE })).toBe(50);
      expect(b.stampReads.count).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("LookupResolverService — expiration cap", () => {
  it("never serves a value past its matrix expiration, even without a mutation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T12:00:00Z"));
    try {
      const store = makeStore();
      store.expiresAt = Date.now() + 1000; // matrix expires in 1s
      const { stampReader, valueResolver, valueResolves } = makeReaders(store);
      const resolver = new LookupResolverService({
        stampReader,
        valueResolver,
        stampWindowMs: 60_000,
        valueTtlMs: 60_000, // long TTL; the expiration cap must still win
      });

      expect(await resolver.resolveMatrixValue({ matrixCode: CODE })).toBe(43);
      expect(valueResolves.count).toBe(1);

      // Past the matrix's expiration, the cached entry must not be reused.
      await vi.advanceTimersByTimeAsync(1500);
      await resolver.resolveMatrixValue({ matrixCode: CODE });
      expect(valueResolves.count).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("LookupResolverService — static invalidate", () => {
  it("delegates to the shared singleton instance", async () => {
    const spy = vi.spyOn(lookupResolver, "invalidateInstance");
    LookupResolverService.invalidate(CODE);
    expect(spy).toHaveBeenCalledWith(CODE);
    spy.mockRestore();
  });
});
