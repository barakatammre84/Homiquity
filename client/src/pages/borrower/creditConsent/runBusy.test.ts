import { describe, it, expect, vi } from "vitest";
import { runBusy } from "./runBusy";

describe("runBusy", () => {
  it("holds the flag for the duration of the action", async () => {
    const seen: boolean[] = [];
    let during: boolean | undefined;
    let busy = false;
    const set = (v: boolean) => { busy = v; seen.push(v); };

    await runBusy(set, async () => { during = busy; });

    expect(during).toBe(true);
    expect(seen).toEqual([true, false]);
  });

  it("releases the flag when the action rejects", async () => {
    // The bug this exists to prevent: mutateAsync rejects on failure, so the
    // old `await ...; setSubmitting(false)` left the authorize button disabled
    // and spinning forever, with no way back except a page reload.
    const seen: boolean[] = [];
    await runBusy(v => seen.push(v), async () => { throw new Error("500"); });
    expect(seen).toEqual([true, false]);
  });

  it("does not re-throw — the mutation's onError already told the user", async () => {
    // An escaping rejection here would be unhandled: nothing awaits the click
    // handler. Swallowing it is the point, not an oversight.
    await expect(runBusy(() => {}, async () => { throw new Error("boom"); })).resolves.toBeUndefined();
  });

  it("releases the flag when the action rejects synchronously", async () => {
    const seen: boolean[] = [];
    await runBusy(v => seen.push(v), () => { throw new Error("sync"); });
    expect(seen).toEqual([true, false]);
  });

  it("runs the action exactly once", async () => {
    const action = vi.fn(async () => {});
    await runBusy(() => {}, action);
    expect(action).toHaveBeenCalledTimes(1);
  });
});
