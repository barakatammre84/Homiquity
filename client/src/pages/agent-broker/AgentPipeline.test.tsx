import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import AgentPipeline from "./AgentPipeline";

// A failed load must not render as "No referred clients in the pipeline yet"
// (finding ux-01). `data` defaults to `[]`, so before the error branch existed
// an API failure told an agent their referrals had produced nothing — the
// opposite of the truth, and the kind of thing that gets acted on.

function renderPipeline() {
  // Same default queryFn the app installs, so the page fails (and succeeds) here
  // exactly the way it does in production — including ApiError, which is what
  // friendlyApiError needs to surface the server's own message.
  const client = new QueryClient({
    defaultOptions: {
      queries: { queryFn: getQueryFn({ on401: "throw" }), retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <AgentPipeline />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AgentPipeline", () => {
  it("shows an honest error with retry when the pipeline fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Pipeline service unavailable" }), {
            status: 503,
          }),
      ),
    );

    renderPipeline();

    await waitFor(() => expect(screen.getByTestId("agent-pipeline-error")).toBeTruthy());

    // The server's own message reaches the user (ApiError → friendlyApiError).
    expect(screen.getByTestId("agent-pipeline-error").textContent).toContain(
      "Pipeline service unavailable",
    );
    // And a retry is offered.
    expect(screen.getByTestId("agent-pipeline-error-retry")).toBeTruthy();
  });

  it("never claims the pipeline is empty when the request failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));

    renderPipeline();

    await waitFor(() => expect(screen.getByTestId("agent-pipeline-error")).toBeTruthy());
    // The regression this guards: the empty state must not be what the user sees.
    expect(screen.queryByTestId("card-empty-pipeline")).toBeNull();
    expect(screen.queryByText(/No referred clients in the pipeline yet/i)).toBeNull();
  });

  it("still shows the empty state when the request genuinely returns nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));

    renderPipeline();

    await waitFor(() => expect(screen.getByTestId("card-empty-pipeline")).toBeTruthy());
    // Empty is still empty — the error branch must not swallow the real case.
    expect(screen.queryByTestId("agent-pipeline-error")).toBeNull();
  });
});
