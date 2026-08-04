import { describe, it, expect } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { decideDeploymentVerdict } = require("../scripts/vercel-deployment-guard.cjs");

// -----------------------------------------------------------------------------
// The gate's deployability check.
//
// Fixtures are the real shapes from the #268 → #279 incident: the TypeScript 7
// bump whose PREVIEW deployments were already ERROR before it was merged, while
// the GitHub "Vercel" status said `pending` and the gate was green. The whole
// point of this guard is that the first case below blocks the merge.
// -----------------------------------------------------------------------------

const deployment = (over: Record<string, unknown>) => ({
  id: "dpl_x",
  created: 1_785_693_000_000,
  state: "READY",
  url: "homiquity-x.vercel.app",
  meta: { githubCommitSha: "abc123" },
  ...over,
});

describe("decideDeploymentVerdict", () => {
  it("fails an ERROR deployment — the #268 case that reached main", () => {
    const got = decideDeploymentVerdict(
      [deployment({ id: "dpl_CjRem", state: "ERROR", meta: { githubCommitSha: "ts7head" } })],
      "ts7head",
    );
    expect(got.verdict).toBe("fail");
    expect(got.deployment.state).toBe("ERROR");
  });

  it("fails a CANCELED deployment — also unverified, not fine", () => {
    expect(
      decideDeploymentVerdict([deployment({ state: "CANCELED" })], "abc123").verdict,
    ).toBe("fail");
  });

  it("passes a READY deployment — the #279 fix", () => {
    const got = decideDeploymentVerdict(
      [deployment({ id: "dpl_7vrJq", state: "READY", meta: { githubCommitSha: "fixhead" } })],
      "fixhead",
    );
    expect(got.verdict).toBe("pass");
    expect(got.deployment.id).toBe("dpl_7vrJq");
  });

  it.each(["QUEUED", "INITIALIZING", "BUILDING"])("waits while %s", (state) => {
    expect(decideDeploymentVerdict([deployment({ state })], "abc123").verdict).toBe("wait");
  });

  it("reports absent when nothing matches the sha", () => {
    // Must NOT read another commit's green deployment as this one's.
    expect(
      decideDeploymentVerdict([deployment({ meta: { githubCommitSha: "other" } })], "abc123")
        .verdict,
    ).toBe("absent");
    expect(decideDeploymentVerdict([], "abc123").verdict).toBe("absent");
  });

  it("judges the newest attempt, so a retry supersedes an earlier failure", () => {
    const got = decideDeploymentVerdict(
      [
        deployment({ id: "old", state: "ERROR", created: 1000 }),
        deployment({ id: "new", state: "READY", created: 2000 }),
      ],
      "abc123",
    );
    expect(got.verdict).toBe("pass");
    expect(got.deployment.id).toBe("new");
  });

  it("does not let a newer GREEN deployment of another commit mask this one's failure", () => {
    const got = decideDeploymentVerdict(
      [
        deployment({ id: "mine", state: "ERROR", created: 1000 }),
        deployment({ id: "someone-else", state: "READY", created: 9999, meta: { githubCommitSha: "zzz" } }),
      ],
      "abc123",
    );
    expect(got.verdict).toBe("fail");
    expect(got.deployment.id).toBe("mine");
  });

  it("tolerates malformed entries rather than crashing the gate", () => {
    const got = decideDeploymentVerdict(
      [null, {}, { meta: null }, deployment({ state: "ready" })] as never,
      "abc123",
    );
    expect(got.verdict).toBe("pass"); // state compared case-insensitively
  });
});
