import { describe, it, expect, afterEach, vi } from "vitest";
import type { Request, Response } from "express";
import {
  isIntakePaused,
  intakePausedGate,
  INTAKE_PAUSED_MESSAGE,
} from "../server/services/maintenanceMode";

// The intake kill switch (INTAKE_PAUSED) must stop all NEW business — funnel
// submits, lead intake, live pricing-vendor calls — while leaving existing
// borrowers' access untouched, and must read the env per-request so flipping
// it never needs a code change or restart.

const ORIGINAL = process.env.INTAKE_PAUSED;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.INTAKE_PAUSED;
  else process.env.INTAKE_PAUSED = ORIGINAL;
});

function mockRes() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & typeof res;
}

describe("isIntakePaused", () => {
  it("is off when the env var is unset or falsy", () => {
    delete process.env.INTAKE_PAUSED;
    expect(isIntakePaused()).toBe(false);
    for (const v of ["", "0", "false", "no", "off", "banana"]) {
      process.env.INTAKE_PAUSED = v;
      expect(isIntakePaused()).toBe(false);
    }
  });

  it("is on for the usual truthy spellings, case/whitespace-insensitive", () => {
    for (const v of ["1", "true", "TRUE", " yes ", "On"]) {
      process.env.INTAKE_PAUSED = v;
      expect(isIntakePaused()).toBe(true);
    }
  });

  it("reads the env per-call — flipping it takes effect immediately", () => {
    process.env.INTAKE_PAUSED = "true";
    expect(isIntakePaused()).toBe(true);
    process.env.INTAKE_PAUSED = "false";
    expect(isIntakePaused()).toBe(false);
  });
});

describe("intakePausedGate", () => {
  it("passes through when intake is not paused", () => {
    delete process.env.INTAKE_PAUSED;
    const res = mockRes();
    const next = vi.fn();
    intakePausedGate({} as Request, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it("returns 503 with the borrower-safe envelope when paused", () => {
    process.env.INTAKE_PAUSED = "true";
    const res = mockRes();
    const next = vi.fn();
    intakePausedGate({} as Request, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.headers["Retry-After"]).toBe("600");
    expect(res.body).toEqual({ error: INTAKE_PAUSED_MESSAGE, code: "INTAKE_PAUSED" });
  });
});
