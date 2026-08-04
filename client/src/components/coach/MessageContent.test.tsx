import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageContent } from "./MessageContent";

// Characterization tests for the coach's mini-markdown renderer (TEAM_PRACTICES
// §5.2). MessageContent is the only thing standing between raw model output and
// the borrower's screen — ChatMessage renders it in all three of its branches —
// so these pin two separate contracts:
//
//  1. The formatting vocabulary the coach prompt is allowed to emit: **bold**,
//     ##/### headings, and bullet/numbered lists. Anything outside that set must
//     degrade to plain text rather than disappear or crash.
//  2. That model output is rendered as TEXT, never as live markup. The renderer
//     builds React elements and never touches dangerouslySetInnerHTML; the last
//     test is the regression guard for anyone who "optimizes" that away.
//
// Written against React 18 ahead of the React 19 bump (#301) so the suite can
// prove the render output is unchanged by the upgrade.

describe("MessageContent", () => {
  it("renders a plain line as a paragraph", () => {
    const { container } = render(<MessageContent content="Your DTI looks healthy." />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].textContent).toBe("Your DTI looks healthy.");
  });

  it("renders **bold** spans as <strong>, keeping the surrounding text inline", () => {
    const { container } = render(
      <MessageContent content="Your rate is **6.25%** today." />,
    );
    const strong = container.querySelectorAll("strong");
    expect(strong).toHaveLength(1);
    expect(strong[0].textContent).toBe("6.25%");
    // The paragraph still reads as one sentence — bold must not split the line.
    expect(container.querySelector("p")?.textContent).toBe("Your rate is 6.25% today.");
  });

  it("renders multiple bold spans in a single line", () => {
    const { container } = render(
      <MessageContent content="**Income** and **assets** are verified." />,
    );
    expect([...container.querySelectorAll("strong")].map((n) => n.textContent)).toEqual([
      "Income",
      "assets",
    ]);
  });

  it("renders ## and ### as headings with distinct emphasis", () => {
    const { container } = render(
      <MessageContent content={"## Next steps\n### Documents"} />,
    );
    const [h2, h3] = [...container.querySelectorAll("p")];
    expect(h2.textContent).toBe("Next steps");
    expect(h2.className).toContain("font-semibold");
    expect(h3.textContent).toBe("Documents");
    expect(h3.className).toContain("font-semibold");
    // ### is the smaller of the two — that difference is the whole point of
    // having both levels.
    expect(h3.className).toContain("text-sm");
    expect(h2.className).not.toContain("text-sm");
  });

  it("groups consecutive bullets into ONE list rather than one list per line", () => {
    const { container } = render(
      <MessageContent content={"- Pay stubs\n- W-2s\n- Bank statements"} />,
    );
    expect(container.querySelectorAll("ul")).toHaveLength(1);
    expect([...container.querySelectorAll("li")].map((n) => n.textContent)).toEqual([
      "Pay stubs",
      "W-2s",
      "Bank statements",
    ]);
  });

  it("accepts both - and * as bullet markers", () => {
    const { container } = render(<MessageContent content={"* Alpha\n- Beta"} />);
    expect(container.querySelectorAll("ul")).toHaveLength(1);
    expect([...container.querySelectorAll("li")].map((n) => n.textContent)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("groups consecutive numbered items into ONE ordered list", () => {
    const { container } = render(
      <MessageContent content={"1. Upload documents\n2. Review terms\n3. Sign"} />,
    );
    expect(container.querySelectorAll("ol")).toHaveLength(1);
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });

  it("preserves the number the coach emitted instead of renumbering from 1", () => {
    // A continued list ("3." first) must not silently become "1." — the coach
    // references step numbers in its prose.
    const { container } = render(<MessageContent content={"3. Third\n4. Fourth"} />);
    const text = container.querySelector("ol")?.textContent ?? "";
    expect(text).toContain("3.");
    expect(text).toContain("4.");
    expect(text).not.toContain("1.");
  });

  it("normalizes the 1) marker style to 1.", () => {
    const { container } = render(<MessageContent content="1) Parenthesis style" />);
    expect(container.querySelectorAll("ol")).toHaveLength(1);
    expect(container.querySelector("ol")?.textContent).toContain("1.");
  });

  it("renders bold inside list items", () => {
    const { container } = render(<MessageContent content="- Bring **two** forms of ID" />);
    expect(container.querySelector("li strong")?.textContent).toBe("two");
    expect(container.querySelector("li")?.textContent).toBe("Bring two forms of ID");
  });

  it("keeps lists separated by prose as distinct lists", () => {
    const { container } = render(
      <MessageContent content={"- One\n\nThen this:\n\n- Two"} />,
    );
    expect(container.querySelectorAll("ul")).toHaveLength(2);
  });

  it("renders a blank line as spacing, not as an empty paragraph", () => {
    const { container } = render(<MessageContent content={"First\n\nSecond"} />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelectorAll("div.h-2")).toHaveLength(1);
  });

  it("renders an empty message without crashing", () => {
    const { container } = render(<MessageContent content="" />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });

  it("renders a realistic mixed coach reply end to end", () => {
    const { container } = render(
      <MessageContent
        content={
          "## Your options\n" +
          "You have **two** paths.\n" +
          "\n" +
          "1. Lock now\n" +
          "2. Float\n" +
          "\n" +
          "### Documents\n" +
          "- Pay stubs\n" +
          "- W-2s"
        }
      />,
    );
    expect(container.querySelectorAll("ol")).toHaveLength(1);
    expect(container.querySelectorAll("ul")).toHaveLength(1);
    expect(container.querySelectorAll("li")).toHaveLength(4);
    expect(screen.getByText("two").tagName).toBe("STRONG");
    expect(container.textContent).toContain("Your options");
    expect(container.textContent).toContain("Documents");
  });

  it("renders model output as text, never as live markup", () => {
    // The coach is an LLM and its output can be steered by borrower-supplied
    // text. This renderer must never grow a dangerouslySetInnerHTML path.
    const hostile = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const { container } = render(<MessageContent content={hostile} />);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    // The angle brackets survive as literal characters the borrower can read.
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
});
