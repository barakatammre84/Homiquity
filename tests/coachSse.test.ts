import { describe, expect, it, vi } from "vitest";
import { sseFrame, writeSse } from "../server/sse";

function parseFrames(raw: string): Array<{ event: string; data: unknown }> {
  return raw
    .split("\n\n")
    .filter((f) => f.trim().length > 0)
    .map((frame) => {
      const lines = frame.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event: "));
      const dataLines = lines.filter((l) => l.startsWith("data: "));
      expect(eventLine, frame).toBeDefined();
      expect(dataLines.length, "exactly one data line per frame").toBe(1);
      return {
        event: eventLine!.slice("event: ".length),
        data: JSON.parse(dataLines[0].slice("data: ".length)),
      };
    });
}

describe("sseFrame", () => {
  it("emits the event/data/blank-line wire format", () => {
    expect(sseFrame("text", { delta: "hi" })).toBe('event: text\ndata: {"delta":"hi"}\n\n');
  });

  it("keeps payload newlines escaped inside a single data line", () => {
    const frame = sseFrame("text", { delta: "line one\nline two" });
    const [parsed] = parseFrames(frame);
    expect(parsed.data).toEqual({ delta: "line one\nline two" });
  });

  it("survives markdown, unicode, and quote-heavy content", () => {
    const delta = '**What\'s needed:** a "recent" pay stub — ⚠ within 30 days';
    const [parsed] = parseFrames(sseFrame("text", { delta }));
    expect((parsed.data as { delta: string }).delta).toBe(delta);
  });
});

describe("writeSse", () => {
  it("writes one frame per call to the response", () => {
    const write = vi.fn();
    writeSse({ write } as never, "meta", { conversationId: "c1" });
    expect(write).toHaveBeenCalledWith('event: meta\ndata: {"conversationId":"c1"}\n\n');
  });
});

describe("coach turn event-order contract", () => {
  it("a simulated turn round-trips through the wire format in order", () => {
    // meta → text* → captured → panel → done — the shape the client hook
    // (useCoachStream) is built against.
    const raw = [
      sseFrame("meta", { conversationId: "c1", userMessageId: "m1", remaining: 29 }),
      sseFrame("text", { delta: "Got it — " }),
      sseFrame("text", { delta: "saving that now." }),
      sseFrame("captured", {
        applicationId: "app-1",
        created: true,
        applied: [{ field: "annualIncome", value: "85000" }],
        skipped: [],
      }),
      sseFrame("panel", { suggestions: ["What documents do I need?"] }),
      sseFrame("done", { messageId: "m2", usage: { inputTokens: 10, outputTokens: 20, modelCalls: 2 }, remaining: 29 }),
    ].join("");

    const frames = parseFrames(raw);
    expect(frames.map((f) => f.event)).toEqual(["meta", "text", "text", "captured", "panel", "done"]);
    const captured = frames[3].data as { applied: Array<{ field: string }> };
    expect(captured.applied[0].field).toBe("annualIncome");
  });
});
