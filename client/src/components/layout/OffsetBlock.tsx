/**
 * OffsetBlock — anchors a content block to one side of its section, so the page
 * has a horizontal rhythm instead of one fixed centre line.
 *
 * WHY THIS EXISTS
 *
 * Every block on our public pages is `mx-auto`, so the eye tracks a single
 * unchanging centre from the top of the page to the bottom. Measured against a
 * reference at 1440px, four of its six content blocks are deliberately
 * off-centre and they ALTERNATE — 64px left / 400px right, then 400px left /
 * 64px right. The content zig-zags down the page. That asymmetry is doing real
 * work in why a page reads as designed rather than generated, and it is
 * structural, so unlike colour it survives the tenant white-label constraint.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not set the content width. Callers keep their own `max-w-*`, because
 * the pages already use four different measures deliberately (2xl for a form,
 * 3xl for prose, 5xl/6xl for grids) and line length is a readability decision,
 * not a rhythm one. This component only decides which side the block hugs.
 *
 * 🚨 IT COLLAPSES BELOW `lg` ON PURPOSE. Under ~1024px an offset block is not a
 * rhythm, it is a cramped column with a useless margin. Below `lg` every side
 * renders centred — identical to today. That is the whole reason this is a
 * primitive rather than utility classes pasted onto a few sections: the
 * collapse is easy to forget and invisible until someone opens a laptop.
 *
 * USE IT AS A RHYTHM, NOT A METRONOME. The reference centres two of its six
 * blocks. Alternating every single section is simply a different monotony — let
 * the void land where a section benefits from breathing.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type OffsetSide = "left" | "right" | "center";

export interface OffsetBlockProps {
  /** Which edge the block hugs at `lg` and above. Defaults to centred. */
  side?: OffsetSide;
  /** Content width and anything else. Callers own their own `max-w-*`. */
  className?: string;
  children: ReactNode;
  "data-testid"?: string;
}

/**
 * `mx-auto` is the base for every side, so the collapsed (mobile) rendering is
 * centred no matter what. The `lg:` rules then override ONE margin, leaving the
 * other `auto` — which is what pushes the block against an edge and throws the
 * slack to the far side.
 */
const SIDE: Record<OffsetSide, string> = {
  left: "lg:ml-16 lg:mr-auto",
  right: "lg:mr-16 lg:ml-auto",
  center: "",
};

export function OffsetBlock({
  side = "center",
  className,
  children,
  "data-testid": testId,
}: OffsetBlockProps) {
  return (
    <div className={cn("mx-auto", SIDE[side], className)} data-testid={testId}>
      {children}
    </div>
  );
}
