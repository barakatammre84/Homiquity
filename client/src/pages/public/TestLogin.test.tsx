import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The quick-login cards once sent hardcoded "<name>123" passwords that
// POST /api/test-login (single DEV_TEST_PASSWORD gate) never accepted — every
// card 401'd silently. These tests pin the fixed contract: cards send the
// user-entered shared password, and never call the API without one.

const apiRequest = vi.fn();
const toast = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  queryClient: { invalidateQueries: vi.fn() },
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/test-login", vi.fn()],
}));

import TestLogin from "./TestLogin";

// The page renders inside App.tsx's QueryClientProvider, so the test must too.
// It previously rendered bare and passed only because the component reached for
// the module-singleton queryClient, which needs no provider — the very coupling
// this migration removes. useQueryClient() throws without a provider, which is
// the honest behaviour: it says the component was being rendered in a tree it
// never actually runs in.
function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  apiRequest.mockResolvedValue({
    json: async () => ({ user: { firstName: "Aspiring", role: "aspiring_owner" } }),
  });
});

describe("TestLogin quick cards (shared DEV_TEST_PASSWORD contract)", () => {
  it("never calls the API without the shared password — prompts for it instead", () => {
    render(<TestLogin />);
    fireEvent.click(screen.getByTestId("card-login-aspiring_owner"));
    expect(apiRequest).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/shared dev password/i) }),
    );
  });

  it("sends the user-entered shared password for the clicked account", async () => {
    render(<TestLogin />);
    fireEvent.change(screen.getByTestId("input-shared-password"), {
      target: { value: "s3cret-dev" },
    });
    fireEvent.click(screen.getByTestId("card-login-aspiring_owner"));
    expect(apiRequest).toHaveBeenCalledWith("POST", "/api/test-login", {
      email: "renter@test.com",
      password: "s3cret-dev",
    });
  });

  it("shares one password state between the cards and the manual form", () => {
    render(<TestLogin />);
    fireEvent.change(screen.getByTestId("input-shared-password"), {
      target: { value: "same-pass" },
    });
    expect((screen.getByTestId("input-password") as HTMLInputElement).value).toBe("same-pass");
  });

  it("renders no fake per-account passwords anywhere", () => {
    const { container } = render(<TestLogin />);
    expect(container.textContent).not.toMatch(/\b\w+123\b/);
    expect(container.textContent).toContain("DEV_TEST_PASSWORD");
  });
});
