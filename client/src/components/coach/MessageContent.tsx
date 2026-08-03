// Mini-markdown renderer for coach replies (moved verbatim from the old
// AICoach.tsx). Supports **bold**, ##/### headings, and bullet/numbered lists —
// exactly what the coach prompt is allowed to emit.

import type { JSX } from "react";

function renderInlineMarkdown(text: string): (string | JSX.Element)[] {
  const result: (string | JSX.Element)[] = [];
  const parts = text.split(/(\*\*.*?\*\*)/g);
  parts.forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      result.push(<strong key={`b-${i}`}>{part.slice(2, -2)}</strong>);
    } else {
      result.push(part);
    }
  });
  return result;
}

export function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      elements.push(<div key={`sp-${i}`} className="h-2" />);
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <p key={`h3-${i}`} className="font-semibold text-sm mt-2 mb-1">
          {renderInlineMarkdown(trimmed.slice(4))}
        </p>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <p key={`h2-${i}`} className="font-semibold mt-2 mb-1">
          {renderInlineMarkdown(trimmed.slice(3))}
        </p>
      );
      i++;
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      const items: { text: string; idx: number }[] = [];
      while (i < lines.length) {
        const bm = lines[i].trim().match(/^[-*]\s+(.+)/);
        if (!bm) break;
        items.push({ text: bm[1], idx: i });
        i++;
      }
      elements.push(
        <ul key={`ul-${items[0].idx}`} className="space-y-1 my-1">
          {items.map((item) => (
            <li key={`li-${item.idx}`} className="flex gap-2 items-start">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-current shrink-0 opacity-40" />
              <span>{renderInlineMarkdown(item.text)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (numberedMatch) {
      const items: { num: string; text: string; idx: number }[] = [];
      while (i < lines.length) {
        const nm = lines[i].trim().match(/^(\d+)[.)]\s+(.+)/);
        if (!nm) break;
        items.push({ num: nm[1], text: nm[2], idx: i });
        i++;
      }
      elements.push(
        <ol key={`ol-${items[0].idx}`} className="space-y-1 my-1">
          {items.map((item) => (
            <li key={`oli-${item.idx}`} className="flex gap-2 items-start">
              <span className="font-medium text-muted-foreground shrink-0 min-w-[1.25rem]">{item.num}.</span>
              <span>{renderInlineMarkdown(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    elements.push(
      <p key={`p-${i}`}>{renderInlineMarkdown(trimmed)}</p>
    );
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}
