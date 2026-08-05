import { describe, it, expect } from "vitest";
import {
  areCategoriesSatisfied,
  isCategorySatisfied,
  summariseDocumentTasks,
} from "../shared/onboardingDocumentProgress";

const task = (documentCategory: string | null, status: string) => ({ documentCategory, status });

describe("summariseDocumentTasks", () => {
  it("counts requests and completions per category", () => {
    expect(summariseDocumentTasks([
      task("tax_return", "COMPLETED"),
      task("tax_return", "OPEN"),
      task("bank_statement", "COMPLETED"),
    ])).toEqual({
      tax_return: { requested: 2, completed: 1 },
      bank_statement: { requested: 1, completed: 1 },
    });
  });

  it("skips tasks that are not document requests", () => {
    // A task with no documentCategory is a review or action item; bucketing
    // them together would produce a meaningless category.
    expect(summariseDocumentTasks([
      task(null, "COMPLETED"),
      task(undefined as unknown as null, "OPEN"),
    ])).toEqual({});
  });

  it("counts only COMPLETED as done", () => {
    // The verify endpoint sets COMPLETED on approval and reopens to OPEN on
    // rejection, so COMPLETED is exactly "supplied and accepted".
    for (const status of ["OPEN", "IN_PROGRESS", "BLOCKED", "EXPIRED"]) {
      expect(summariseDocumentTasks([task("tax_return", status)]), status)
        .toEqual({ tax_return: { requested: 1, completed: 0 } });
    }
  });

  it("is empty for no tasks", () => {
    expect(summariseDocumentTasks([])).toEqual({});
  });
});

describe("isCategorySatisfied", () => {
  const progress = {
    tax_return: { requested: 2, completed: 2 },
    bank_statement: { requested: 2, completed: 1 },
    w2: { requested: 0, completed: 0 },
  };

  it("is true only when every request is completed", () => {
    expect(isCategorySatisfied(progress, "tax_return")).toBe(true);
    expect(isCategorySatisfied(progress, "bank_statement")).toBe(false);
  });

  it("is false for a category nobody has requested", () => {
    // "We never asked" is not "you're done" — treating it as satisfied would
    // mark a brand-new borrower's tax documentation complete before they had
    // uploaded anything.
    expect(isCategorySatisfied(progress, "pay_stub")).toBe(false);
    expect(isCategorySatisfied(progress, "w2")).toBe(false);
  });

  it("is false when the payload has no progress at all", () => {
    // Older payloads predate documentProgress; they must not read as complete.
    expect(isCategorySatisfied(undefined, "tax_return")).toBe(false);
    expect(isCategorySatisfied({}, "tax_return")).toBe(false);
  });
});

describe("areCategoriesSatisfied", () => {
  const progress = {
    tax_return: { requested: 1, completed: 1 },
    bank_statement: { requested: 1, completed: 0 },
  };

  it("requires every listed category", () => {
    expect(areCategoriesSatisfied(progress, ["tax_return"])).toBe(true);
    expect(areCategoriesSatisfied(progress, ["tax_return", "bank_statement"])).toBe(false);
  });

  it("treats an empty list as not satisfied", () => {
    // every() on an empty array is vacuously true; a step that asks for
    // nothing must not therefore report itself done.
    expect(areCategoriesSatisfied(progress, [])).toBe(false);
  });
});
