import { describe, it, expect } from "vitest";
import {
  automatedTasks,
  awaitingReview,
  countBreached,
  matchesPipelineSearch,
  sortQueueTasks,
  totalPipelineVolume,
} from "./derive";
import type { PipelineSummary, QueueTask } from "./model";
import type { Task } from "@shared/schema";

const task = (over: Partial<QueueTask> & { id: string }): QueueTask =>
  ({
    applicationId: "app-1",
    title: "t",
    taskType: "DOC",
    status: "PENDING",
    slaStatus: "green",
    timeRemaining: 100,
    percentageElapsed: 0,
    ...over,
  }) as QueueTask;

describe("sortQueueTasks", () => {
  it("drops completed and expired work", () => {
    const sorted = sortQueueTasks([
      task({ id: "done", status: "COMPLETED" }),
      task({ id: "dead", status: "EXPIRED" }),
      task({ id: "live", status: "IN_PROGRESS" }),
    ]);
    expect(sorted.map(t => t.id)).toEqual(["live"]);
  });

  it("puts a breached task above a healthy one due sooner", () => {
    // SLA state dominates. A red task due in an hour still outranks a green
    // one due in a minute — that ordering is the whole point of the queue.
    const sorted = sortQueueTasks([
      task({ id: "green-soon", slaStatus: "green", timeRemaining: 1 }),
      task({ id: "red-later", slaStatus: "red", timeRemaining: 60 }),
    ]);
    expect(sorted.map(t => t.id)).toEqual(["red-later", "green-soon"]);
  });

  it("orders by time remaining within the same SLA state", () => {
    const sorted = sortQueueTasks([
      task({ id: "b", slaStatus: "amber", timeRemaining: 50 }),
      task({ id: "a", slaStatus: "amber", timeRemaining: 10 }),
      task({ id: "c", slaStatus: "amber", timeRemaining: 90 }),
    ]);
    expect(sorted.map(t => t.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts an undated task last, not first", () => {
    // null becomes Infinity. Treating it as 0 would park unbounded work at the
    // top of the queue ahead of everything actually running out of time.
    const sorted = sortQueueTasks([
      task({ id: "undated", slaStatus: "green", timeRemaining: null }),
      task({ id: "dated", slaStatus: "green", timeRemaining: 500 }),
    ]);
    expect(sorted.map(t => t.id)).toEqual(["dated", "undated"]);
  });

  it("returns an empty list before the queue loads", () => {
    expect(sortQueueTasks(undefined)).toEqual([]);
  });
});

describe("countBreached", () => {
  it("counts only red tasks", () => {
    const sorted = sortQueueTasks([
      task({ id: "1", slaStatus: "red" }),
      task({ id: "2", slaStatus: "red" }),
      task({ id: "3", slaStatus: "amber" }),
      task({ id: "4", slaStatus: "green" }),
    ]);
    expect(countBreached(sorted)).toBe(2);
  });
});

describe("automatedTasks", () => {
  it("excludes manually raised and untagged work", () => {
    const sorted = sortQueueTasks([
      task({ id: "rule", triggerSource: "AUTO_RULE" }),
      task({ id: "stage", triggerSource: "STAGE_TRANSITION" }),
      task({ id: "manual", triggerSource: "MANUAL" }),
      task({ id: "untagged" }),
    ]);
    expect(automatedTasks(sorted).map(t => t.id)).toEqual(["rule", "stage"]);
  });
});

describe("awaitingReview", () => {
  const t = (over: Partial<Task>): Task => ({ id: "x", ...over }) as Task;

  it("requires both IN_PROGRESS and a pending verdict", () => {
    // The regression this guards: the predicate once compared
    // status === "submitted", which the task vocabulary never contained, so
    // the Awaiting Review tile read 0 regardless of the real backlog.
    const tasks = [
      t({ id: "waiting", status: "IN_PROGRESS", verificationStatus: "pending" }),
      t({ id: "verified", status: "IN_PROGRESS", verificationStatus: "verified" }),
      t({ id: "not-started", status: "PENDING", verificationStatus: "pending" }),
      t({ id: "submitted-legacy", status: "submitted", verificationStatus: "pending" }),
    ];
    expect(awaitingReview(tasks).map(x => x.id)).toEqual(["waiting"]);
  });
});

describe("totalPipelineVolume", () => {
  const loan = (loanAmount: string | undefined): PipelineSummary =>
    ({ applicationId: "a", currentStage: "processing", loanAmount }) as PipelineSummary;

  it("sums numeric strings", () => {
    expect(totalPipelineVolume([loan("100000"), loan("250000.50")])).toBe(350000.5);
  });

  it("treats a missing or unparseable amount as zero rather than NaN", () => {
    // One NaN would poison the sum and render the whole volume tile as "$NaN".
    expect(totalPipelineVolume([loan("100000"), loan(undefined), loan("")])).toBe(100000);
    expect(totalPipelineVolume([loan("100000"), loan("n/a")])).toBe(100000);
  });

  it("is zero for an empty pipeline", () => {
    expect(totalPipelineVolume([])).toBe(0);
  });
});

describe("matchesPipelineSearch", () => {
  const item = {
    applicationId: "APP-9F3C21",
    currentStage: "underwriting",
    borrowerName: "Ada Lovelace",
  } as PipelineSummary;

  it("matches everything when the box is empty", () => {
    expect(matchesPipelineSearch(item, "")).toBe(true);
  });

  it("matches borrower name, stage and application id, case-insensitively", () => {
    expect(matchesPipelineSearch(item, "ada")).toBe(true);
    expect(matchesPipelineSearch(item, "LOVELACE")).toBe(true);
    expect(matchesPipelineSearch(item, "underwrit")).toBe(true);
    expect(matchesPipelineSearch(item, "9f3c")).toBe(true);
  });

  it("does not match an unrelated term", () => {
    expect(matchesPipelineSearch(item, "closing")).toBe(false);
  });

  it("handles a loan with no borrower name yet", () => {
    const anon = { ...item, borrowerName: undefined } as PipelineSummary;
    expect(matchesPipelineSearch(anon, "ada")).toBe(false);
    expect(matchesPipelineSearch(anon, "underwriting")).toBe(true);
  });
});
