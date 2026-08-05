import { describe, it, expect } from "vitest";
import { bucketTasks } from "./taskBuckets";
import type { Task } from "@shared/schema";

// Each case below corresponds to a defect this page has already shipped once.
// The buckets decide what a borrower is told they still owe, so a wrong bucket
// either hides work or invents it.

const task = (over: Partial<Task> & { id: string }): Task =>
  ({
    applicationId: "app-active",
    title: "t",
    taskType: "document_request",
    status: "OPEN",
    verificationStatus: null,
    ...over,
  }) as Task;

const ids = (list: Task[]) => list.map(t => t.id).sort();

describe("bucketTasks — scoping", () => {
  it("drops tasks belonging to another application", () => {
    // The "56 pending tasks" defect: tasks from old or denied applications
    // were presented as outstanding work on the current loan.
    const buckets = bucketTasks(
      [task({ id: "current" }), task({ id: "old", applicationId: "app-denied" })],
      "app-active",
    );
    expect(ids(buckets.myTasks)).toEqual(["current"]);
  });

  it("shows everything when there is no active application yet", () => {
    const buckets = bucketTasks(
      [task({ id: "a" }), task({ id: "b", applicationId: "other" })],
      undefined,
    );
    expect(ids(buckets.myTasks)).toEqual(["a", "b"]);
  });

  it("excludes EXPIRED tasks from the list and from progress", () => {
    // Dead work must not sit in the denominator — it would permanently cap
    // the borrower's progress bar below 100%.
    const buckets = bucketTasks(
      [task({ id: "done", status: "COMPLETED" }), task({ id: "dead", status: "EXPIRED" })],
      "app-active",
    );
    expect(ids(buckets.myTasks)).toEqual(["done"]);
    expect(buckets.totalTasks).toBe(1);
    expect(buckets.progressPercent).toBe(100);
  });

  it("returns empty buckets before the tasks load", () => {
    const buckets = bucketTasks(undefined, "app-active");
    expect(buckets.myTasks).toEqual([]);
    expect(buckets.totalTasks).toBe(0);
    expect(buckets.progressPercent).toBe(0);
  });
});

describe("bucketTasks — the canonical vocabulary", () => {
  it("buckets the uppercase statuses the task engine actually writes", () => {
    // The regression this guards: buckets once matched lowercase values the
    // engine never writes, so every OPEN task was invisible on this page.
    const buckets = bucketTasks(
      [
        task({ id: "open", status: "OPEN" }),
        task({ id: "blocked", status: "BLOCKED" }),
        task({ id: "in-progress", status: "IN_PROGRESS" }),
        task({ id: "completed", status: "COMPLETED" }),
      ],
      "app-active",
    );
    expect(ids(buckets.pendingTasks)).toEqual(["blocked", "open"]);
    expect(ids(buckets.submittedTasks)).toEqual(["in-progress"]);
    expect(ids(buckets.completedTasks)).toEqual(["completed"]);
  });
});

describe("bucketTasks — a rejection outranks the lifecycle bucket", () => {
  it("pulls a rejected task out of pending and submitted", () => {
    const buckets = bucketTasks(
      [
        task({ id: "rejected-open", status: "OPEN", verificationStatus: "rejected" }),
        task({ id: "rejected-submitted", status: "IN_PROGRESS", verificationStatus: "rejected" }),
      ],
      "app-active",
    );
    expect(ids(buckets.rejectedTasks)).toEqual(["rejected-open", "rejected-submitted"]);
    expect(buckets.pendingTasks).toEqual([]);
    expect(buckets.submittedTasks).toEqual([]);
  });

  it("leaves a COMPLETED task alone even if it once had a rejection", () => {
    // Already resolved — re-surfacing it as "Needs Your Attention" would ask
    // the borrower to redo finished work.
    const buckets = bucketTasks(
      [task({ id: "fixed", status: "COMPLETED", verificationStatus: "rejected" })],
      "app-active",
    );
    expect(buckets.rejectedTasks).toEqual([]);
    expect(ids(buckets.completedTasks)).toEqual(["fixed"]);
  });
});

describe("bucketTasks — document milestone grouping", () => {
  it("splits pending work into document requests and everything else", () => {
    const buckets = bucketTasks(
      [
        task({ id: "doc-1", taskType: "document_request" }),
        task({ id: "doc-2", taskType: "document_request" }),
        task({ id: "review", taskType: "review" }),
      ],
      "app-active",
    );
    expect(ids(buckets.pendingDocTasks)).toEqual(["doc-1", "doc-2"]);
    expect(ids(buckets.pendingOtherTasks)).toEqual(["review"]);
  });

  it("keeps a rejected document request out of the checklist", () => {
    // It belongs in "Needs Your Attention", which offers Re-upload — the
    // checklist would show it as never-started.
    const buckets = bucketTasks(
      [task({ id: "bad-doc", taskType: "document_request", verificationStatus: "rejected" })],
      "app-active",
    );
    expect(buckets.pendingDocTasks).toEqual([]);
    expect(ids(buckets.rejectedTasks)).toEqual(["bad-doc"]);
  });
});

describe("bucketTasks — progress", () => {
  it("reports the completed share of live tasks", () => {
    const buckets = bucketTasks(
      [
        task({ id: "a", status: "COMPLETED" }),
        task({ id: "b", status: "COMPLETED" }),
        task({ id: "c", status: "OPEN" }),
        task({ id: "d", status: "IN_PROGRESS" }),
      ],
      "app-active",
    );
    expect(buckets.completedCount).toBe(2);
    expect(buckets.totalTasks).toBe(4);
    expect(buckets.progressPercent).toBe(50);
  });

  it("is 0%, not NaN, with no tasks at all", () => {
    expect(bucketTasks([], "app-active").progressPercent).toBe(0);
  });
});
