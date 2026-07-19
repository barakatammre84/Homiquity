import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RestoreDraftBanner, AuthGateOverlay, FunnelFooter } from "./FunnelChrome";

describe("FunnelFooter", () => {
  it("pins the regulatory copy: soft inquiry, no commitment, broker disclosure, Equal Housing", () => {
    render(<FunnelFooter />);
    const text = screen.getByTestId("footer-compliance").textContent ?? "";
    expect(text).toContain("soft credit inquiry");
    expect(text).toContain("will not affect your credit score");
    expect(text).toContain("Pre-approval is not a commitment to lend");
    expect(text).toContain("does not make credit decisions or fund loans");
    expect(text).toContain("Equal Housing Opportunity");
  });
});

describe("AuthGateOverlay", () => {
  it("offers signup and sign-in, and can be dismissed back to the form", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<AuthGateOverlay onDismiss={onDismiss} />);
    expect(screen.getByTestId("button-auth-gate-signup").closest("a")?.getAttribute("href")).toBe("/signup");
    expect(screen.getByTestId("button-auth-gate-login").closest("a")?.getAttribute("href")).toBe("/login");
    await user.click(screen.getByTestId("button-auth-gate-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("RestoreDraftBanner", () => {
  it("adopting a draft is an explicit decision — restore and dismiss both offered (#249)", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const onDismiss = vi.fn();
    render(<RestoreDraftBanner onRestore={onRestore} onDismiss={onDismiss} />);
    await user.click(screen.getByTestId("button-restore-draft"));
    expect(onRestore).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId("button-dismiss-restore"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
