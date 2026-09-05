import { describe, expect, it } from "vitest";
import {
  postgresErrorCode,
  withPostgresTransactionRetry,
} from "../server/services/transactionRetry";

describe("bounded PostgreSQL transaction retry", () => {
  it("replays transient serialization failures and returns the committed result", async () => {
    let attempts = 0;
    const result = await withPostgresTransactionRetry(async () => {
      attempts += 1;
      if (attempts < 3) throw { cause: { code: attempts === 1 ? "40001" : "40P01" } };
      return "committed";
    });

    expect(result).toBe("committed");
    expect(attempts).toBe(3);
  });

  it("does not replay permanent database errors", async () => {
    const failure = { cause: { code: "23503" } };
    let attempts = 0;

    await expect(withPostgresTransactionRetry(async () => {
      attempts += 1;
      throw failure;
    })).rejects.toBe(failure);
    expect(attempts).toBe(1);
  });

  it("stops after the configured attempt limit and reads nested driver codes", async () => {
    const failure = { cause: { cause: { code: "40001" } } };
    let attempts = 0;

    expect(postgresErrorCode(failure)).toBe("40001");
    await expect(withPostgresTransactionRetry(async () => {
      attempts += 1;
      throw failure;
    }, 2)).rejects.toBe(failure);
    expect(attempts).toBe(2);
  });
});
