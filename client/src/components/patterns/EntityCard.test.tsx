import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EntityCard, EntityCollection } from "./EntityCard";

// Pins §5: the saved state keeps each question beside its answer, and Add
// lives on the collection — outside every card.

describe("EntityCard", () => {
  it("saved state keeps each question beside its answer", () => {
    render(
      <EntityCard
        title="Asset 1 — Checking account"
        state="saved"
        summary={[
          { question: "Bank", answer: "First Federal" },
          { question: "Is this your current residence?", answer: "Yes" },
        ]}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    const summary = screen.getByTestId("entity-card-summary").textContent!;
    expect(summary).toContain("Bank");
    expect(summary).toContain("First Federal");
    expect(summary).toContain("Is this your current residence?");
    expect(screen.getByTestId("entity-card-delete").textContent).toContain("Delete");
  });
});

describe("EntityCollection", () => {
  it("renders Add on the collection, outside the cards", () => {
    render(
      <EntityCollection label="Your assets" addLabel="Add another asset" onAdd={() => {}}>
        <EntityCard title="Asset 1" state="saved" summary={[]} />
      </EntityCollection>,
    );

    const add = screen.getByTestId("entity-collection-add");
    expect(add.closest('[data-testid="entity-card"]')).toBeNull();
  });
});
