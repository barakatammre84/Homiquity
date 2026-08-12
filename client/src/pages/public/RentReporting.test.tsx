import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// The rent-reporting waitlist, rendered.
//
// tests/rentReportingSurface.test.ts pins the page's COPY by reading the file as
// text — that catches a barred claim being reintroduced, but it cannot tell you the
// component mounts. This lane does: it renders the real component in happy-dom and
// asserts what a visitor actually sees, plus the one behaviour that matters
// (submitting posts email-only to the public capture endpoint).
//
// It exists partly because live browser verification is awkward here: the preview
// launcher binds to the primary checkout, so a worktree's new route 404s in the
// dev-server preview even when the code is correct. A colocated component test is
// glob-matched by vitest.client.config.ts, so unlike the node lane it can never be
// silently stranded outside an include list — and it runs on every PR.

vi.mock("@/components/SEOHead", () => ({ SEOHead: () => null }));

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import RentReporting from "./RentReporting";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  toast.mockReset();
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RentReporting — what a visitor sees", () => {
  it("renders", () => {
    render(<RentReporting />);
    expect(screen.getByTestId("text-rent-reporting-title")).toBeTruthy();
  });

  it("states up front that nothing is being reported yet", () => {
    render(<RentReporting />);
    const alert = screen.getByTestId("alert-not-yet-reporting");
    expect(alert.textContent).toMatch(/not reporting to the credit bureaus yet/i);
    expect(alert.textContent).toMatch(/will not be charged/i);
  });

  it("shows no price anywhere on the page", () => {
    // The pitch's "$5/mo" and "$49 one-time" cards. Nothing may be sold before a
    // tradeline exists, so nothing priced may render.
    const { container } = render(<RentReporting />);
    expect(container.textContent).not.toMatch(/\$\s?\d/);
  });

  it("carries the limits disclosure, including that late payments are reported too", () => {
    render(<RentReporting />);
    const disclosure = screen.getByTestId("text-rent-disclosure").textContent ?? "";
    expect(disclosure).toMatch(/not credit\s+repair/i);
    expect(disclosure).toMatch(/results vary/i);
    expect(disclosure).toMatch(/late or missed payments/i);
    expect(disclosure).toMatch(/does not decide whether you qualify/i);
  });

  it("renders no phone input — TCPA governs calls and texts, so we don't collect one", () => {
    const { container } = render(<RentReporting />);
    expect(container.querySelector('input[type="tel"]')).toBeNull();
    expect(container.querySelector('input[autocomplete="tel"]')).toBeNull();
  });
});

describe("RentReporting — submission", () => {
  it("posts email-only to the public capture endpoint, tagged with its own source", async () => {
    render(<RentReporting />);
    fireEvent.change(screen.getByTestId("input-rent-email"), {
      target: { value: "renter@example.com" },
    });
    fireEvent.click(screen.getByTestId("button-rent-waitlist-submit"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/email-capture");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      email: "renter@example.com",
      source: "rent_reporting_waitlist",
      website: "",
    });
    // No phone, no name, no consent payload — there is nothing here to consent to.
    expect(Object.keys(body).sort()).toEqual(["email", "source", "website"]);
  });

  it("confirms without implying anything happened to the visitor's credit file", async () => {
    render(<RentReporting />);
    fireEvent.change(screen.getByTestId("input-rent-email"), {
      target: { value: "renter@example.com" },
    });
    fireEvent.click(screen.getByTestId("button-rent-waitlist-submit"));

    const panel = await screen.findByTestId("panel-rent-waitlist-done");
    expect(panel.textContent).toMatch(/nothing is being reported/i);
  });

  it("never posts an invalid address", async () => {
    // Two guards stack here: the browser's own constraint validation on
    // <input type="email">, and the regex in the submit handler. Which one fires
    // first is an implementation detail — assert the outcome, which is that nothing
    // reaches the endpoint. (Asserting the toast would pin the wrong one: native
    // validation blocks the submit before the handler ever runs.)
    render(<RentReporting />);
    fireEvent.change(screen.getByTestId("input-rent-email"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByTestId("button-rent-waitlist-submit"));

    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("panel-rent-waitlist-done")).toBeNull();
  });

  it("never posts an empty address", async () => {
    render(<RentReporting />);
    fireEvent.click(screen.getByTestId("button-rent-waitlist-submit"));

    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
