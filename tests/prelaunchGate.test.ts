import { describe, it, expect, afterEach, vi } from "vitest";
import type { Request, Response } from "express";
import { isCompanyNmlsPending } from "@shared/companyIdentity";
import {
  isPrelaunchGated,
  prelaunchGate,
  PRELAUNCH_GATED_MESSAGE,
} from "../server/services/prelaunchGate";

// Default behavior delegates to the real constant (now an issued NMLS id → not
// pending); individual tests override to exercise the pending fail-safe branch.
vi.mock("@shared/companyIdentity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/companyIdentity")>();
  return { ...actual, isCompanyNmlsPending: vi.fn(actual.isCompanyNmlsPending) };
});

// The pre-license launch gate (PRELAUNCH_GATED) must block the soliciting
// server surfaces (public rate displays, new-application creation) until the
// company is licensed (roadmap F1). It reads the env per-request, and when the
// var is UNSET it fails safe: gated in production while the company NMLS id is
// still PENDING — so we can never serve the soliciting surface unlicensed by
// simply forgetting the flag. The nmlsId is now issued (F1), so the fail-safe's
// pending branch is exercised via a mock below.

const ORIGINAL_FLAG = process.env.PRELAUNCH_GATED;
const ORIGINAL_ENV = process.env.NODE_ENV;

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.PRELAUNCH_GATED;
  else process.env.PRELAUNCH_GATED = ORIGINAL_FLAG;
  process.env.NODE_ENV = ORIGINAL_ENV;
});

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
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

describe("isPrelaunchGated", () => {
  it("is on for the usual truthy spellings, regardless of environment", () => {
    process.env.NODE_ENV = "development";
    for (const v of ["1", "true", "TRUE", " yes ", "On"]) {
      process.env.PRELAUNCH_GATED = v;
      expect(isPrelaunchGated()).toBe(true);
    }
  });

  it("is off when explicitly set falsy, even in production while unlicensed", () => {
    process.env.NODE_ENV = "production";
    for (const v of ["0", "false", "no", "off"]) {
      process.env.PRELAUNCH_GATED = v;
      expect(isPrelaunchGated()).toBe(false);
    }
  });

  it("opens once licensed: unset + production + NMLS issued → not gated", () => {
    delete process.env.PRELAUNCH_GATED;
    process.env.NODE_ENV = "production";
    // shared/companyIdentity.ts nmlsId is issued (F1) → the interlock is satisfied.
    expect(isPrelaunchGated()).toBe(false);
  });

  it("fails safe: unset + production + NMLS pending → gated", () => {
    delete process.env.PRELAUNCH_GATED;
    process.env.NODE_ENV = "production";
    // Interlock must re-engage if the NMLS id ever regresses to pending.
    vi.mocked(isCompanyNmlsPending).mockReturnValueOnce(true);
    expect(isPrelaunchGated()).toBe(true);
  });

  it("does not gate dev/test by default — unset + non-production → open", () => {
    delete process.env.PRELAUNCH_GATED;
    process.env.NODE_ENV = "development";
    expect(isPrelaunchGated()).toBe(false);
    process.env.NODE_ENV = "test";
    expect(isPrelaunchGated()).toBe(false);
  });
});

describe("prelaunchGate", () => {
  it("passes through when not gated", () => {
    process.env.NODE_ENV = "development";
    delete process.env.PRELAUNCH_GATED;
    const res = mockRes();
    const next = vi.fn();
    prelaunchGate({} as Request, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it("returns 404 with the PRELAUNCH_GATED envelope when gated", () => {
    process.env.PRELAUNCH_GATED = "true";
    const res = mockRes();
    const next = vi.fn();
    prelaunchGate({} as Request, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: PRELAUNCH_GATED_MESSAGE, code: "PRELAUNCH_GATED" });
  });
});
