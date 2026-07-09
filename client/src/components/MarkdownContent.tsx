import { Link } from "wouter";
import type { ReactNode } from "react";

/**
 * Dependency-free markdown renderer for article bodies (roadmap Phase 4).
 *
 * Handles headings, grouped lists, GFM tables, blockquotes, horizontal rules,
 * and inline links / bold / italic / code / images. Internal links (paths that
 * start with "/") render as wouter <Link> for SPA navigation — this is what
 * unlocks internal linking, the biggest on-page SEO lever for a content hub.
 *
 * Safe by construction: output is React elements (never dangerouslySetInnerHTML),
 * and URLs are allow-listed to http(s)/mailto/relative so an admin-authored body
 * can't inject a javascript:/data: link. A future swap to react-markdown +
 * remark-gfm is a clean follow-on once dependency/lockfile management is sorted.
 */

/** Allow only safe URL schemes; returns null to render the raw text instead. */
function safeUrl(url: string): string | null {
  const u = url.trim();
  if (u.startsWith("/") || u.startsWith("#")) return u;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^mailto:/i.test(u)) return u;
  return null;
}

function renderLink(url: string, text: string, key: string): ReactNode {
  const safe = safeUrl(url);
  if (!safe) return <span key={key}>{text}</span>;
  if (safe.startsWith("/") || safe.startsWith("#")) {
    return (
      <Link key={key} href={safe}>
        {text}
      </Link>
    );
  }
  return (
    <a key={key} href={safe} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  );
}

// Ordered alternation: image, link, **bold**, __bold__, *italic*, _italic_, `code`.
const INLINE_RE =
  /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g;

/** Parse inline markdown within a line into React nodes (non-nested). */
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyPrefix}-i${i++}`;
    if (m[1] !== undefined) {
      const src = safeUrl(m[2]);
      nodes.push(src ? <img key={key} src={src} alt={m[1]} loading="lazy" /> : m[0]);
    } else if (m[3] !== undefined) {
      nodes.push(renderLink(m[4], m[3], key));
    } else if (m[5] !== undefined || m[6] !== undefined) {
      nodes.push(<strong key={key}>{m[5] ?? m[6]}</strong>);
    } else if (m[7] !== undefined || m[8] !== undefined) {
      nodes.push(<em key={key}>{m[7] ?? m[8]}</em>);
    } else if (m[9] !== undefined) {
      nodes.push(<code key={key}>{m[9]}</code>);
    }
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, ii) => (
      <li key={ii}>{parseInline(item, `list${blocks.length}-${ii}`)}</li>
    ));
    blocks.push(
      list.type === "ul" ? (
        <ul key={`list${blocks.length}`}>{items}</ul>
      ) : (
        <ol key={`list${blocks.length}`}>{items}</ol>
      ),
    );
    list = null;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const key = `b${idx}`;

    if (!line.trim()) {
      flushList();
      continue;
    }

    // GFM table: header row followed by a separator row.
    if (line.includes("|") && idx + 1 < lines.length && isTableSeparator(lines[idx + 1])) {
      flushList();
      const header = splitRow(line);
      const rows: string[][] = [];
      let j = idx + 2;
      while (j < lines.length && lines[j].includes("|") && lines[j].trim()) {
        rows.push(splitRow(lines[j]));
        j++;
      }
      blocks.push(
        <div key={key} className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                {header.map((h, hi) => (
                  <th key={hi}>{parseInline(h, `${key}-h${hi}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{parseInline(cell, `${key}-r${ri}c${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      idx = j - 1;
      continue;
    }

    if (line.startsWith("> ")) {
      flushList();
      blocks.push(
        <blockquote key={key}>
          <p>{parseInline(line.slice(2), key)}</p>
        </blockquote>,
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushList();
      blocks.push(<hr key={key} />);
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (list && list.type === "ul") list.items.push(line.slice(2));
      else {
        flushList();
        list = { type: "ul", items: [line.slice(2)] };
      }
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s/, "");
      if (list && list.type === "ol") list.items.push(text);
      else {
        flushList();
        list = { type: "ol", items: [text] };
      }
      continue;
    }

    flushList();
    if (line.startsWith("### ")) blocks.push(<h3 key={key}>{parseInline(line.slice(4), key)}</h3>);
    else if (line.startsWith("## ")) blocks.push(<h2 key={key}>{parseInline(line.slice(3), key)}</h2>);
    else if (line.startsWith("# ")) blocks.push(<h1 key={key}>{parseInline(line.slice(2), key)}</h1>);
    else blocks.push(<p key={key}>{parseInline(line, key)}</p>);
  }

  flushList();
  return <>{blocks}</>;
}
