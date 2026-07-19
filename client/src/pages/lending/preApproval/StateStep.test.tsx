import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StateStep } from "./StateStep";
import { LICENSED_STATES, unlicensedStateMessage } from "@shared/companyIdentity";

// The licensed-state gate (roadmap A5) at render level, pinned to the SHARED
// footprint: an unlicensed state must show the notice and must NOT advance the
// funnel; a licensed state advances. Mirrors the server's 422.

beforeAll(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

describe("StateStep", () => {
  it("shows the unlicensed notice (with the shared message) for a state outside the footprint", () => {
    render(<StateStep value="WI" onSelectState={vi.fn()} onAdvance={vi.fn()} />);
    const notice = screen.getByTestId("notice-unlicensed-state");
    expect(notice.textContent).toContain("We can't take applications in Wisconsin yet");
    expect(notice.textContent).toContain(unlicensedStateMessage("WI"));
    expect(notice.querySelector('a[href="/disclosures"]')).toBeTruthy();
  });

  it("shows no notice for a licensed state", () => {
    const licensed = LICENSED_STATES[0];
    render(<StateStep value={licensed} onSelectState={vi.fn()} onAdvance={vi.fn()} />);
    expect(screen.queryByTestId("notice-unlicensed-state")).toBeNull();
  });

  it("selecting a licensed state advances; an unlicensed one does not", async () => {
    const user = userEvent.setup();
    const onSelectState = vi.fn();
    const onAdvance = vi.fn();
    render(<StateStep value="" onSelectState={onSelectState} onAdvance={onAdvance} />);

    await user.click(screen.getByTestId("button-state-combobox"));
    await user.click(await screen.findByTestId("option-state-WI"));
    expect(onSelectState).toHaveBeenCalledWith("WI");
    await new Promise((r) => setTimeout(r, 250));
    expect(onAdvance).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("button-state-combobox"));
    await user.click(await screen.findByTestId(`option-state-${LICENSED_STATES[0]}`));
    expect(onSelectState).toHaveBeenCalledWith(LICENSED_STATES[0]);
    await new Promise((r) => setTimeout(r, 250));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});
