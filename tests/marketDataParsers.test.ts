import { describe, expect, it } from "vitest";
import {
  parseCsvLine,
  indexHeader,
  numericOrNull,
  creditBucket,
  ltvBand,
  dtiBand,
  FannieLoanAggregator,
  FANNIE_COLUMNS,
} from "../server/services/marketDataParsers";

describe("parseCsvLine", () => {
  it("splits plain fields", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("keeps commas inside quoted fields and unescapes doubled quotes", () => {
    expect(parseCsvLine('"Better Mortgage, Corp",7.125,"say ""hi"""')).toEqual([
      "Better Mortgage, Corp",
      "7.125",
      'say "hi"',
    ]);
  });

  it("preserves empty fields and strips CR", () => {
    expect(parseCsvLine("a,,c\r")).toEqual(["a", "", "c"]);
  });
});

describe("indexHeader / numericOrNull", () => {
  it("indexes headers case-insensitively", () => {
    const header = indexHeader("Activity_Year,LEI,interest_rate");
    expect(header.get("activity_year")).toBe(0);
    expect(header.get("interest_rate")).toBe(2);
  });

  it("treats HMDA sentinel values as null", () => {
    expect(numericOrNull("NA")).toBeNull();
    expect(numericOrNull("Exempt")).toBeNull();
    expect(numericOrNull("")).toBeNull();
    expect(numericOrNull(undefined)).toBeNull();
    expect(numericOrNull("6.875")).toBe(6.875);
  });
});

describe("risk bucketing", () => {
  it("buckets credit scores on standard breakpoints", () => {
    expect(creditBucket(579)).toBe("<580");
    expect(creditBucket(620)).toBe("620-659");
    expect(creditBucket(779)).toBe("740-779");
    expect(creditBucket(780)).toBe("780+");
    expect(creditBucket(null)).toBe("unknown");
  });

  it("buckets LTV and DTI", () => {
    expect(ltvBand(60)).toBe("<=60");
    expect(ltvBand(80)).toBe("70-80");
    expect(ltvBand(97)).toBe("95+");
    expect(dtiBand(36)).toBe("30-36");
    expect(dtiBand(50.5)).toBe("50+");
    expect(dtiBand(null)).toBe("unknown");
  });
});

// Build a synthetic pipe-delimited row with only the columns the aggregator reads.
function row(overrides: Partial<Record<keyof typeof FANNIE_COLUMNS, string>>): string[] {
  const width = Math.max(...Object.values(FANNIE_COLUMNS)) + 1;
  const fields = new Array<string>(width).fill("");
  for (const [name, value] of Object.entries(overrides)) {
    fields[FANNIE_COLUMNS[name as keyof typeof FANNIE_COLUMNS]] = value;
  }
  return fields;
}

describe("FannieLoanAggregator", () => {
  it("folds monthly rows into one loan and flags default via zero-balance code", () => {
    const agg = new FannieLoanAggregator();
    // Loan A: 3 monthly rows, goes 90+ delinquent then liquidates (ZB 03 short sale)
    agg.addRow(row({ LOAN_ID: "A", ORIG_RATE: "6.5", CSCORE_B: "645", OLTV: "85", DTI: "38", DLQ_STATUS: "0" }));
    agg.addRow(row({ LOAN_ID: "A", DLQ_STATUS: "3" }));
    agg.addRow(row({ LOAN_ID: "A", DLQ_STATUS: "4", ZB_CODE: "03" }));
    // Loan B: same bands, prepays cleanly (ZB 01)
    agg.addRow(row({ LOAN_ID: "B", ORIG_RATE: "7.0", CSCORE_B: "650", OLTV: "83", DTI: "40", DLQ_STATUS: "0" }));
    agg.addRow(row({ LOAN_ID: "B", DLQ_STATUS: "0", ZB_CODE: "1" })); // unpadded code tolerated

    const { cells, loansSeen, rowsSeen } = agg.finish();
    expect(rowsSeen).toBe(5);
    expect(loansSeen).toBe(2);
    expect(cells).toHaveLength(1); // both loans land in 620-659 / 80-90 / 36-43

    const cell = cells[0];
    expect(cell.creditBucket).toBe("620-659");
    expect(cell.ltvBand).toBe("80-90");
    expect(cell.dtiBand).toBe("36-43");
    expect(cell.loanCount).toBe(2);
    expect(cell.defaultCount).toBe(1);
    expect(cell.seriousDelinqCount).toBe(1);
    expect(cell.prepaidCount).toBe(1);
    expect(cell.rateSum / cell.rateCount).toBeCloseTo(6.75);
  });

  it("backfills origination fields from later rows and buckets missing data as unknown", () => {
    const agg = new FannieLoanAggregator();
    agg.addRow(row({ LOAN_ID: "C", DLQ_STATUS: "0" })); // origination fields absent on first row
    agg.addRow(row({ LOAN_ID: "C", CSCORE_B: "742", OLTV: "75", DLQ_STATUS: "0" }));
    agg.addRow(row({ LOAN_ID: "D", CSCORE_B: "", OLTV: "NA", DTI: "", DLQ_STATUS: "XX" }));

    const { cells, loansSeen } = agg.finish();
    expect(loansSeen).toBe(2);
    const loanC = cells.find((c) => c.creditBucket === "740-779");
    expect(loanC?.ltvBand).toBe("70-80");
    expect(loanC?.dtiBand).toBe("unknown");
    const loanD = cells.find((c) => c.creditBucket === "unknown");
    expect(loanD?.loanCount).toBe(1);
    expect(loanD?.defaultCount).toBe(0);
  });

  it("skips rows without a loan id", () => {
    const agg = new FannieLoanAggregator();
    agg.addRow(row({}));
    const { skippedRows, loansSeen } = agg.finish();
    expect(skippedRows).toBe(1);
    expect(loansSeen).toBe(0);
  });
});
