import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  DeclarationsGroup,
  type DeclarationAnswer,
} from "./DeclarationsGroup";

// Pins the bulk-answer escape hatch's one critical rule (§6): the master
// checkbox is DERIVED from the answers, never stored — flipping any single
// answer releases it automatically, so the two controls can never disagree.

const QUESTIONS = [
  { id: "judgments", label: "Are there any outstanding judgments against you?" },
  { id: "bankruptcy", label: "Have you declared bankruptcy in the past 7 years?" },
  { id: "foreclosure", label: "Have you had a property foreclosed in the past 7 years?" },
];

function Harness() {
  const [answers, setAnswers] = useState<
    Record<string, DeclarationAnswer | undefined>
  >({});
  return (
    <DeclarationsGroup
      legend="Declarations"
      required
      questions={QUESTIONS}
      answers={answers}
      onAnswersChange={setAnswers}
    />
  );
}

const pressed = (testId: string) =>
  screen.getByTestId(testId).getAttribute("aria-pressed");
const masterState = () =>
  screen.getByTestId("declarations-group-master").getAttribute("data-state");

describe("DeclarationsGroup", () => {
  it("checking the master answers every question 'No'", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId("declarations-group-master"));
    for (const q of QUESTIONS) {
      expect(pressed(`declarations-group-${q.id}-no`)).toBe("true");
    }
  });

  it("flipping one answer to Yes releases the master automatically", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId("declarations-group-master"));
    expect(masterState()).toBe("checked");

    await user.click(screen.getByTestId("declarations-group-bankruptcy-yes"));
    expect(masterState()).toBe("unchecked");
    expect(pressed("declarations-group-judgments-no")).toBe("true");
  });

  it("every question stays individually rendered and answerable", () => {
    render(<Harness />);
    for (const q of QUESTIONS) {
      expect(screen.getByText(q.label)).toBeTruthy();
      const yes = screen.getByTestId(
        `declarations-group-${q.id}-yes`,
      ) as HTMLButtonElement;
      expect(yes.disabled).toBe(false);
    }
  });

  it("puts the required marker on the group, never on options", () => {
    render(<Harness />);
    const group = screen.getByTestId("declarations-group");
    const legend = group.querySelector("legend");
    expect(legend?.textContent).toContain("*");
    for (const q of QUESTIONS) {
      expect(
        screen.getByTestId(`declarations-group-${q.id}-yes`).textContent,
      ).not.toContain("*");
    }
  });
});
