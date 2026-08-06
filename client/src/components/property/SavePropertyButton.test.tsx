import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { SharePropertyButton } from "./SavePropertyButton";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

afterEach(cleanup);
beforeEach(() => {
  toast.mockReset();
});

/** Replace navigator.share / navigator.clipboard for one test. */
function withNavigator(share: unknown, writeText?: unknown) {
  Object.defineProperty(globalThis.navigator, "share", { value: share, configurable: true });
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

describe("SharePropertyButton", () => {
  it("uses the Web Share API when the browser has one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    withNavigator(share);
    render(<SharePropertyButton title="12 Oak St" />);

    fireEvent.click(screen.getByTestId("button-share-property"));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0]).toMatchObject({ title: "12 Oak St" });
    // The native sheet is its own confirmation; a toast on top would be noise.
    expect(toast).not.toHaveBeenCalled();
  });

  it("falls back to copying the link, and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withNavigator(undefined, writeText);
    render(<SharePropertyButton title="12 Oak St" />);

    fireEvent.click(screen.getByTestId("button-share-property"));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0].title).toBe("Link copied");
  });

  it("treats a dismissed share sheet as a cancellation, not a failure", async () => {
    // Closing the native sheet rejects with AbortError. Reporting that as an
    // error would scold the user for changing their mind.
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    withNavigator(vi.fn().mockRejectedValue(abort));
    render(<SharePropertyButton title="12 Oak St" />);

    fireEvent.click(screen.getByTestId("button-share-property"));

    await waitFor(() => expect(toast).not.toHaveBeenCalled());
  });

  it("reports a real failure with something the user can do instead", async () => {
    withNavigator(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    render(<SharePropertyButton title="12 Oak St" />);

    fireEvent.click(screen.getByTestId("button-share-property"));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const arg = toast.mock.calls[0][0];
    expect(arg.variant).toBe("destructive");
    expect(arg.description).toMatch(/address bar/);
  });
});
