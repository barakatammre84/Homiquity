import type { Response } from "express";

/**
 * Server-Sent Events framing helpers.
 *
 * `sseFrame` is pure (unit-tested in tests/coachSse.test.ts). JSON.stringify
 * escapes newlines inside the payload, so a single `data:` line per frame is
 * always safe — no multi-line data splitting needed.
 */
export function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function writeSse(res: Response, event: string, data: unknown): void {
  res.write(sseFrame(event, data));
}

/**
 * Standard SSE response headers. `no-transform` + `X-Accel-Buffering: no`
 * tell intermediaries not to buffer; flushHeaders() commits the stream —
 * after this point errors must be emitted as in-stream `error` events (the
 * global Express error handler cannot fire once headers are sent).
 */
export function beginSse(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}
