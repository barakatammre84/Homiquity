import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("local development launcher", () => {
  it("delimits variables followed by non-ASCII punctuation", () => {
    const source = readFileSync(resolve(__dirname, "../scripts/dev-up.sh"), "utf8");
    expect(source).toContain('port ${PORT}…');
    expect(source).not.toContain('port $PORT…');
  });

  it("resolves the repository from the script location, not the caller's directory", () => {
    const source = readFileSync(resolve(__dirname, "../scripts/dev-up.sh"), "utf8");
    expect(source).toContain('SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"');
    expect(source).toContain('git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel');
  });
});
