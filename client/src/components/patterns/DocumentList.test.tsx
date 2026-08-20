import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentList } from "./DocumentList";

// Pins the vault rules (§6/§8): titles come from the data layer's slug map
// (a missing entry renders a safe placeholder and errors in dev — never the
// raw slug, never view-layer normalization), duplicates carry a subject, and
// dates read as plain English.

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DocumentList", () => {
  it("resolves titles from the slug map, disambiguates subjects, speaks plain dates", () => {
    render(
      <DocumentList
        titles={{ w2_2025: "W-2 (2025)" }}
        groups={[
          {
            label: "Income",
            documents: [
              {
                id: "1",
                slug: "w2_2025",
                subject: "Alex",
                status: "verified",
                date: { verb: "You uploaded", on: "Aug 12, 2026" },
              },
              {
                id: "2",
                slug: "w2_2025",
                subject: "Jordan",
                status: "uploaded",
                date: { verb: "Sent to you", on: "Aug 14, 2026" },
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getAllByText("W-2 (2025)")).toHaveLength(2);
    expect(screen.getByText("· For Alex")).toBeTruthy();
    expect(screen.getByText("· For Jordan")).toBeTruthy();
    expect(screen.getByText("Sent to you on Aug 14, 2026")).toBeTruthy();
    expect(screen.queryByText("w2_2025")).toBeNull();
  });

  it("never renders a raw slug when the map has no entry", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <DocumentList
        groups={[
          { label: "Other", documents: [{ id: "3", slug: "bank_stmt_q2" }] },
        ]}
      />,
    );
    expect(screen.queryByText("bank_stmt_q2")).toBeNull();
    expect(screen.getByText("Document (name missing)")).toBeTruthy();
    expect(error).toHaveBeenCalled();
  });
});
