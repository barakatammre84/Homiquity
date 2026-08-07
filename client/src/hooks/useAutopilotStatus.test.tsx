import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { autopilotKeys } from "@/lib/queryClient";
import { useAutopilotStatus } from "./useAutopilotStatus";

// The Autopilot status is LIVE server state on a borrower-facing surface, and
// the failure this hook exists to prevent is silent: the server closes every SSE
// stream on a 300s timer and leans on the browser's transparent reconnect, but a
// reconnect that meets a 401 or a 502 fails the connection PERMANENTLY (per the
// EventSource spec) — so without an `error` listener the stream dies once and
// the banner keeps asserting a frozen "we're reviewing your file" forever.
//
// These pin the three things that make that impossible: frames land in the
// shared cache entry, a permanent failure is reported as `lost`, and a TRANSIENT
// error (the 300s teardown re-handshaking) is NOT.

const CONNECTING = 0;
const CLOSED = 2;

interface Listener {
  (event: unknown): void;
}

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static CONNECTING = CONNECTING;
  static CLOSED = CLOSED;

  readyState = CONNECTING;
  onerror: (() => void) | null = null;
  closed = false;
  private listeners: Record<string, Listener[]> = {};

  constructor(
    readonly url: string,
    readonly init?: { withCredentials?: boolean },
  ) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, fn: Listener) {
    (this.listeners[type] ??= []).push(fn);
  }

  close() {
    this.closed = true;
    this.readyState = CLOSED;
  }

  /** Drive the stream from a test. */
  emit(type: string, data?: unknown) {
    this.emitRaw(type, JSON.stringify(data));
  }

  /** Deliver a frame whose payload is not what the client expects. */
  emitRaw(type: string, data: string) {
    for (const fn of this.listeners[type] ?? []) fn({ data });
  }

  /** Simulate an `error` with the readyState the browser would have set. */
  fail(readyState: number) {
    this.readyState = readyState;
    this.onerror?.();
  }
}

const STATUS = {
  phase: "reviewing",
  message: "We're reviewing your file.",
  readiness: { completed: 2, total: 5 },
  readyToSubmitToLender: false,
  outstandingConditions: 0,
};

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderStatus(applicationId: string | null = "app-1") {
  return renderHook(() => useAutopilotStatus(applicationId), { wrapper });
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // These assert the STREAM, so the snapshot endpoint is held pending.
        // A resolving stub would also mask the race the hook now prevents:
        // a snapshot landing after a live frame must never overwrite it.
        queryFn: () => new Promise<never>(() => {}),
      },
    },
  });
});

describe("useAutopilotStatus — the stream writes to the cache", () => {
  it("subscribes to the file's stream with credentials", () => {
    renderStatus();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe("/api/autopilot/stream/app-1");
    expect(FakeEventSource.instances[0].init?.withCredentials).toBe(true);
  });

  it("lands a status frame in the SHARED cache entry, not in local state", async () => {
    const { result } = renderStatus();

    act(() => FakeEventSource.instances[0].emit("status", STATUS));

    await waitFor(() => expect(result.current.status).toMatchObject({ phase: "reviewing" }));
    // The point of the rewiring: a second reader (or an invalidation) sees the
    // same value, because the stream wrote to the cache rather than a useState.
    expect(client.getQueryData(autopilotKeys.status("app-1"))).toMatchObject({
      phase: "reviewing",
    });
  });

  it("keeps the last good value when a frame is malformed", async () => {
    const { result } = renderStatus();
    act(() => FakeEventSource.instances[0].emit("status", STATUS));
    await waitFor(() => expect(result.current.status).not.toBeNull());

    // A proxy or an error page delivered on the stream — not JSON.
    act(() => FakeEventSource.instances[0].emitRaw("status", "<!doctype html>"));

    expect(result.current.status).toMatchObject({ phase: "reviewing" });
  });

  it("stops fetching the snapshot once the stream is live, so it cannot clobber", async () => {
    const { result } = renderStatus();
    act(() => FakeEventSource.instances[0].emit("status", STATUS));
    await waitFor(() => expect(result.current.live).toBe("live"));

    // The stream opens by pushing its own snapshot, so a concurrent read is
    // redundant — and a slow one resolving after a fresh frame would replace
    // newer live data with an older value.
    const entry = client.getQueryCache().find({ queryKey: autopilotKeys.status("app-1") });
    expect(entry?.observers[0]?.options.enabled).toBe(false);
  });

  it("tears the stream down when the application changes", () => {
    const { rerender } = renderHook(({ id }) => useAutopilotStatus(id), {
      wrapper,
      initialProps: { id: "app-1" as string | null },
    });
    rerender({ id: "app-2" });

    expect(FakeEventSource.instances[0].closed).toBe(true);
    expect(FakeEventSource.instances[1].url).toBe("/api/autopilot/stream/app-2");
  });
});

describe("useAutopilotStatus — a dead stream is reported, never hidden", () => {
  it("reports `lost` when the browser gives up (readyState CLOSED)", async () => {
    const { result } = renderStatus();
    act(() => FakeEventSource.instances[0].emit("open"));
    act(() => FakeEventSource.instances[0].emit("status", STATUS));
    await waitFor(() => expect(result.current.live).toBe("live"));

    // A 401 after the session expires, or a 502 mid-deploy: the EventSource spec
    // says fail the connection — the browser will NOT retry.
    act(() => FakeEventSource.instances[0].fail(CLOSED));

    await waitFor(() => expect(result.current.live).toBe("lost"));
    // The value is still rendered — it is the last thing we heard — but the
    // caller can now say so instead of vouching for it.
    expect(result.current.status).toMatchObject({ phase: "reviewing" });
  });

  it("does NOT report `lost` for a transient error the browser will retry", async () => {
    const { result } = renderStatus();
    act(() => FakeEventSource.instances[0].emit("open"));
    await waitFor(() => expect(result.current.live).toBe("live"));

    // This is the ordinary case: the server's 300s teardown, which the browser
    // re-handshakes on its own. Flagging it would flash "live updates paused"
    // at every borrower every five minutes.
    act(() => FakeEventSource.instances[0].fail(CONNECTING));

    expect(result.current.live).toBe("live");
  });

  it("opens no stream and stays connecting without an application id", () => {
    const { result } = renderStatus(null);
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(result.current.live).toBe("connecting");
    expect(result.current.status).toBeNull();
  });

  it("falls back to `lost` when EventSource is unavailable entirely", () => {
    vi.stubGlobal("EventSource", function Broken() {
      throw new Error("blocked");
    });
    const { result } = renderStatus();
    expect(result.current.live).toBe("lost");
  });
});
