import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { VerifyDocumentsCard } from "./VerifyDocumentsCard";
import type { TaskDocumentWithFile } from "./DocumentsCard";

afterEach(cleanup);

const doc = (id: string, fileName: string, isVerified = false) =>
  ({ id, isVerified, document: { fileName } }) as TaskDocumentWithFile;

const renderCard = (documents: TaskDocumentWithFile[], onVerify = vi.fn(), isPending = false) => {
  render(
    <VerifyDocumentsCard
      documents={documents}
      verificationNotes=""
      onVerificationNotesChange={() => {}}
      onVerify={onVerify}
      isPending={isPending}
    />,
  );
  return onVerify;
};

describe("VerifyDocumentsCard", () => {
  it("renders a row per document, not just the last one", () => {
    // The bug this fixes: both buttons used to act on
    // documents[documents.length - 1], so earlier uploads on a multi-document
    // task could never be verified or rejected — while the card said
    // "verify or reject them".
    renderCard([doc("d1", "2023-return.pdf"), doc("d2", "2024-return.pdf")]);
    expect(screen.getByText("2023-return.pdf")).toBeTruthy();
    expect(screen.getByText("2024-return.pdf")).toBeTruthy();
    expect(screen.getAllByTestId(/^button-approve-document-/)).toHaveLength(2);
    expect(screen.getAllByTestId(/^button-reject-document-/)).toHaveLength(2);
  });

  it("approves the document whose row was clicked", () => {
    const onVerify = renderCard([doc("d1", "a.pdf"), doc("d2", "b.pdf"), doc("d3", "c.pdf")]);
    fireEvent.click(screen.getByTestId("button-approve-document-d1"));
    expect(onVerify).toHaveBeenCalledWith("d1", true);
  });

  it("rejects the document whose row was clicked", () => {
    const onVerify = renderCard([doc("d1", "a.pdf"), doc("d2", "b.pdf")]);
    fireEvent.click(screen.getByTestId("button-reject-document-d2"));
    expect(onVerify).toHaveBeenCalledWith("d2", false);
  });

  it("never sends another row's id", () => {
    const onVerify = renderCard([doc("first", "a.pdf"), doc("last", "b.pdf")]);
    fireEvent.click(screen.getByTestId("button-approve-document-first"));
    expect(onVerify).toHaveBeenCalledTimes(1);
    expect(onVerify).toHaveBeenCalledWith("first", true);
    expect(onVerify).not.toHaveBeenCalledWith("last", true);
  });

  it("marks an already-verified document without hiding its controls", () => {
    // A verified document keeps its buttons: staff can still reject one that
    // was approved in error, which is the only route back.
    renderCard([doc("d1", "a.pdf", true)]);
    expect(screen.getByText("Verified")).toBeTruthy();
    expect(screen.getByTestId("button-reject-document-d1")).toBeTruthy();
  });

  it("disables every row while a verdict is in flight", () => {
    renderCard([doc("d1", "a.pdf"), doc("d2", "b.pdf")], vi.fn(), true);
    for (const b of screen.getAllByTestId(/^button-(approve|reject)-document-/)) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("keeps one shared notes field, not one per document", () => {
    // The server writes verificationNotes to the task, not to the document,
    // so per-row notes would imply a granularity that does not exist.
    renderCard([doc("d1", "a.pdf"), doc("d2", "b.pdf")]);
    expect(screen.getAllByTestId("input-verification-notes")).toHaveLength(1);
  });
});
