import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CostLineItem } from "./CostLineItem";

afterEach(cleanup);

describe("CostLineItem", () => {
  it("renders the label and a formatted amount", () => {
    render(<CostLineItem label="Origination Fee" amount={1250} />);
    expect(screen.getByText("Origination Fee")).toBeTruthy();
    expect(screen.getByText("$1,250")).toBeTruthy();
  });

  it("renders a credit as a negative, not as its magnitude", () => {
    // Lender credits are passed in as -le.lenderCredits. If the sign were
    // dropped, a credit would read on the disclosure as an additional charge.
    render(<CostLineItem label="Lender Credits" amount={-2000} />);
    expect(screen.getByText("Lender Credits")).toBeTruthy();
    expect(screen.getByText(/-.*2,000/)).toBeTruthy();
  });

  it("shows a zero cost as $0 rather than a blank", () => {
    // A missing fee line on a TRID disclosure would read as "not disclosed";
    // $0 is the honest rendering of a fee that genuinely is zero.
    const { container } = render(<CostLineItem label="Survey" amount={0} />);
    expect(container.textContent).toContain("$0");
  });

  it("bolds only when asked, so subtotals stay distinguishable from line items", () => {
    const plain = render(<CostLineItem label="Points" amount={500} />).container.firstChild as HTMLElement;
    expect(plain.className).not.toContain("font-semibold");
    cleanup();
    const total = render(<CostLineItem label="Subtotal" amount={500} bold />).container.firstChild as HTMLElement;
    expect(total.className).toContain("font-semibold");
  });
});
