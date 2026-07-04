import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture emails instead of sending/logging them.
vi.mock("../server/services/emailService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/services/emailService")>();
  return { ...actual, sendEmail: vi.fn(async () => true) };
});

import { notifyNewLead } from "../server/services/leadNotifications";
import { emailTemplates, sendEmail } from "../server/services/emailService";
import type { IStorage } from "../server/storage";
import type { Lead } from "@shared/schema";

const baseLead = {
  id: "lead-1",
  source: "landing_page",
  firstName: "Ava",
  lastName: "Nguyen",
  email: "ava@example.com",
  phone: "+1 555 0100",
  loanPurpose: "purchase",
  propertyState: "TX",
  status: "new",
} as unknown as Lead;

function fakeStorage(roles: string[]) {
  const createNotification = vi.fn(async (n: unknown) => n);
  const storage = {
    getStaffUsersForTeamDisplay: vi.fn(async () =>
      roles.map((role, i) => ({ id: `u${i}`, role })),
    ),
    createNotification,
  } as unknown as IStorage;
  return { storage, createNotification };
}

beforeEach(() => {
  vi.mocked(sendEmail).mockClear();
});

describe("notifyNewLead (speed-to-lead, G-A)", () => {
  it("notifies every lead-desk member (admin/lo/loa) and skips post-application roles", async () => {
    const { storage, createNotification } = fakeStorage(["admin", "lo", "loa", "processor", "underwriter", "closer"]);
    await notifyNewLead(storage, baseLead);
    expect(createNotification).toHaveBeenCalledTimes(3);
    const first = createNotification.mock.calls[0][0] as Record<string, unknown>;
    expect(first.type).toBe("lead_received");
    expect(first.entityType).toBe("lead");
    expect(first.entityId).toBe("lead-1");
    expect(String(first.body)).toContain("Ava Nguyen");
    expect(String(first.body)).toContain("purchase");
  });

  it("sends the borrower acknowledgment when the lead has an email", async () => {
    const { storage } = fakeStorage(["lo"]);
    await notifyNewLead(storage, baseLead);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = vi.mocked(sendEmail).mock.calls[0][0];
    expect(email.to).toBe("ava@example.com");
    expect(email.html).toContain("Ava");
  });

  it("skips the acknowledgment when the lead has no email (phone-only)", async () => {
    const { storage } = fakeStorage(["lo"]);
    await notifyNewLead(storage, { ...baseLead, email: null } as Lead);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("a failing leg never throws out of notifyNewLead (intake must not 500)", async () => {
    const { storage } = fakeStorage(["lo"]);
    vi.mocked(storage.getStaffUsersForTeamDisplay).mockRejectedValueOnce(new Error("db down"));
    await expect(notifyNewLead(storage, baseLead)).resolves.toBeUndefined();
    // The other leg still ran.
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("lead acknowledgment copy stays inside the compliance rails", () => {
  // Reg Z §1026.24: any rate/payment/APR/cost figure would trigger full
  // disclosure requirements. Reg B / Reg N: no approval or eligibility
  // implication — this acknowledges an inquiry, it is not a credit decision.
  it("carries no trigger terms or approval language", () => {
    const { subject, html } = emailTemplates.leadReceived("Ava");
    const text = `${subject} ${html}`.toLowerCase().replace(/<[^>]+>/g, " ").replace(/#[0-9a-f]{3,8}\b/g, " ").replace(/\d+px|\d+%/g, " ");
    for (const banned of ["$", " apr", "rate", "payment", "approved", "pre-approved", "prequalif", "qualify", "eligib", "guarantee"]) {
      expect(text, `banned term "${banned}" found in lead acknowledgment copy`).not.toContain(banned);
    }
    // No numerals in the rendered copy at all (after stripping style values).
    expect(text).not.toMatch(/\b\d+(\.\d+)?\s*(percent|bps)\b/);
  });

  it("identifies the request and offers the ignore-this path", () => {
    const { html } = emailTemplates.leadReceived(null);
    expect(html).toContain("Hi there");
    expect(html).toContain("didn't make this request");
  });
});
