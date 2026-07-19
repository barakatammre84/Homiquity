import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

// Interaction smoke for the component-test lane: proves render + user-event +
// the disabled contract work in happy-dom, so behavioral UI tests don't need a
// booted dev server.

describe("Button", () => {
  it("fires onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} data-testid="button-save">
        Save
      </Button>,
    );
    await user.click(screen.getByTestId("button-save"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled data-testid="button-save">
        Save
      </Button>,
    );
    await user.click(screen.getByTestId("button-save")).catch(() => {
      // user-event rejects clicks on pointer-events:none targets — that IS the contract.
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders as a native button with its label", () => {
    render(<Button data-testid="button-save">Save</Button>);
    const el = screen.getByTestId("button-save");
    expect(el.tagName).toBe("BUTTON");
    expect(el.textContent).toBe("Save");
  });
});
