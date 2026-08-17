import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddressInput } from "./AddressInput";

// The address autocomplete feeds the URLA property section, the URLA personal-info
// section and the funnel's rental-income step — i.e. the subject property and the
// borrower's own address.
//
// Both lookups used to swallow failure. `if (res.ok)` had no else on the
// autocomplete, and the details call had a completely EMPTY catch. /api/geocode/*
// answers 503 whenever GOOGLE_MAPS_API_KEY is unset
// (server/routes/geocode.ts:34), so neither path is exotic.

let fetchMock: ReturnType<typeof vi.fn>;

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url: "/api/geocode/autocomplete",
    statusText: "",
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

const SUGGESTION = {
  placeId: "place-1",
  description: "123 Main St, Austin, TX",
  mainText: "123 Main St",
  secondaryText: "Austin, TX",
};

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function typeAddress(text = "123 Main") {
  const input = screen.getByTestId("input-address-autocomplete");
  fireEvent.change(input, { target: { value: text } });
  // the component debounces at 300ms
  await new Promise(r => setTimeout(r, 400));
}

describe("address autocomplete", () => {
  it("shows suggestions when the lookup succeeds", async () => {
    fetchMock.mockResolvedValue(response(200, [SUGGESTION]));
    render(<AddressInput onSelect={vi.fn()} />);
    await typeAddress();

    await waitFor(() => expect(screen.queryByTestId("dropdown-address-suggestions")).toBeTruthy());
  });

  // THE REGRESSION. A failed lookup used to leave the previous input's
  // suggestions on screen and selectable.
  it("clears stale suggestions when a later lookup fails", async () => {
    fetchMock.mockResolvedValue(response(200, [SUGGESTION]));
    render(<AddressInput onSelect={vi.fn()} />);
    await typeAddress("123 Main");
    await waitFor(() => expect(screen.queryByTestId("dropdown-address-suggestions")).toBeTruthy());

    fetchMock.mockResolvedValue(response(503, { error: "Google Maps API key not configured" }));
    await typeAddress("123 Main St Apt");

    await waitFor(() =>
      expect(screen.queryByTestId("text-address-lookup-error")).toBeTruthy(),
    );
    // Results for an address the borrower has already typed past must not remain.
    expect(screen.queryByTestId("dropdown-address-suggestions")).toBeNull();
  });

  it("says lookup is unavailable rather than showing an empty, silent box", async () => {
    fetchMock.mockResolvedValue(response(503, { error: "Google Maps API key not configured" }));
    render(<AddressInput onSelect={vi.fn()} />);
    await typeAddress();

    await waitFor(() => expect(screen.queryByTestId("text-address-lookup-error")).toBeTruthy());
  });

  // THE WORSE REGRESSION. The field showed a complete address while onSelect
  // never fired, so zip/state/county/lat/lng were never captured.
  it("never leaves a complete-looking address with no structured data behind it", async () => {
    const onSelect = vi.fn();
    fetchMock.mockResolvedValue(response(200, [SUGGESTION]));
    render(<AddressInput onSelect={onSelect} />);
    await typeAddress();
    await waitFor(() => expect(screen.queryByTestId("button-suggestion-0")).toBeTruthy());

    // The details lookup fails after the input has already been filled in.
    fetchMock.mockResolvedValue(response(502, { error: "Geocoding failed" }));
    fireEvent.click(screen.getByTestId("button-suggestion-0"));

    await waitFor(() => expect(screen.queryByTestId("text-address-lookup-error")).toBeTruthy());
    // We cannot fabricate the structured fields, so we must not claim success.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("passes the structured result through when the details lookup succeeds", async () => {
    const onSelect = vi.fn();
    fetchMock.mockResolvedValue(response(200, [SUGGESTION]));
    render(<AddressInput onSelect={onSelect} />);
    await typeAddress();
    await waitFor(() => expect(screen.queryByTestId("button-suggestion-0")).toBeTruthy());

    fetchMock.mockResolvedValue(
      response(200, {
        formattedAddress: "123 Main St, Austin, TX 78701",
        lat: 30.2,
        lng: -97.7,
        zip: "78701",
        city: "Austin",
        state: "TX",
        streetAddress: "123 Main St",
        county: "Travis",
      }),
    );
    fireEvent.click(screen.getByTestId("button-suggestion-0"));

    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    expect(onSelect.mock.calls[0][0]).toMatchObject({ zip: "78701", state: "TX", county: "Travis" });
    expect(screen.queryByTestId("text-address-lookup-error")).toBeNull();
  });
});
