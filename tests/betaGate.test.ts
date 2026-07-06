import { describe, it, expect, beforeEach, afterEach } from "vitest";
import middleware, { betaCodes, sha256Hex } from "../middleware";

const ORIGINAL_ENV = process.env.BETA_ACCESS_CODE;

function req(url: string, cookie?: string): Request {
  return new Request(url, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe("beta gate middleware", () => {
  beforeEach(() => {
    process.env.BETA_ACCESS_CODE = "sunrise-42,agent-crew";
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.BETA_ACCESS_CODE;
    else process.env.BETA_ACCESS_CODE = ORIGINAL_ENV;
  });

  it("is a no-op when BETA_ACCESS_CODE is unset", async () => {
    delete process.env.BETA_ACCESS_CODE;
    expect(await middleware(req("https://x.test/"))).toBeUndefined();
  });

  it("is a no-op when BETA_ACCESS_CODE is blank/whitespace", async () => {
    process.env.BETA_ACCESS_CODE = " , ";
    expect(await middleware(req("https://x.test/"))).toBeUndefined();
  });

  it("never gates /api/* even while active", async () => {
    expect(await middleware(req("https://x.test/api/jobs/lifecycle"))).toBeUndefined();
  });

  it("shows the 401 lock screen to visitors without a code", async () => {
    const res = await middleware(req("https://x.test/dashboard"));
    expect(res).toBeDefined();
    expect(res!.status).toBe(401);
    expect(res!.headers.get("x-robots-tag")).toContain("noindex");
    const html = await res!.text();
    expect(html).toContain("private beta");
    expect(html).toContain('name="beta"');
    expect(html).not.toContain("didn&rsquo;t work");
  });

  it("shows an error on the lock screen for a wrong code", async () => {
    const res = await middleware(req("https://x.test/?beta=wrong-guess"));
    expect(res!.status).toBe(401);
    expect(await res!.text()).toContain("didn&rsquo;t work");
  });

  it("accepts a valid invite link: sets cookie, strips ?beta=, redirects", async () => {
    const res = await middleware(req("https://x.test/rates?beta=sunrise-42&tab=va"));
    expect(res!.status).toBe(302);
    expect(res!.headers.get("location")).toBe("/rates?tab=va");
    const cookie = res!.headers.get("set-cookie")!;
    expect(cookie).toContain(`hq_beta=${await sha256Hex("sunrise-42")}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("accepts any code from the comma-separated list", async () => {
    const res = await middleware(req("https://x.test/?beta=agent-crew"));
    expect(res!.status).toBe(302);
    expect(res!.headers.get("location")).toBe("/");
  });

  it("admits requests carrying a valid cookie", async () => {
    const hash = await sha256Hex("sunrise-42");
    const res = await middleware(req("https://x.test/dashboard", `hq_beta=${hash}`));
    expect(res).toBeUndefined();
  });

  it("rejects a forged/revoked cookie", async () => {
    const staleHash = await sha256Hex("revoked-code");
    const res = await middleware(req("https://x.test/", `hq_beta=${staleHash}`));
    expect(res!.status).toBe(401);
  });

  it("serves Disallow-all robots.txt while gated", async () => {
    const res = await middleware(req("https://x.test/robots.txt"));
    expect(res!.status).toBe(200);
    expect(await res!.text()).toContain("Disallow: /");
  });

  it("betaCodes trims and drops empty entries", () => {
    expect(betaCodes(" a , ,b,")).toEqual(["a", "b"]);
    expect(betaCodes(undefined)).toEqual([]);
  });
});
