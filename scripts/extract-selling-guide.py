#!/usr/bin/env python3
"""Materialize the Fannie Mae Selling Guide as the local source of truth.

The Selling Guide is the top of the compliance document hierarchy (CLAUDE.md), but a
1,185-page PDF cannot be grepped and cannot be read section-by-section. This script
turns it into an organized local corpus:

  docs/fannie-mae/selling-guide/
    selling-guide-text.txt        page stream, every page prefixed [[PAGE n | <section>]]
    extracted/sections/<ID>.txt   one file per section (423), heading-anchored, with a
                                  provenance header and inline [[PAGE n]] markers
    extracted/groups/<node>.txt   Part/Subpart/Chapter banner + intro text (nothing lost)
    extracted/front-matter.txt    cover pages before the first TOC node
    extracted/extraction-report.json  anchor methods + verification results for this run

and (re)generates the tracked fact layer — titles, page numbers, structure; no Guide
prose — that works even before anyone runs this script:

    section-index.tsv   revised-sections.tsv   toc.json   manifest.json   INDEX.md

WHY THE TEXT IS NOT COMMITTED: this repository is PUBLIC. The Guide is Fannie Mae's
copyrighted work, and a complete text extraction is the same content in another format,
not a lesser form of it. Publishing either would be redistribution. The generated
content artifacts are gitignored; only the fact layer above is tracked. Relaxing that
is a founder decision, not an agent's.

WHERE THE PDF COMES FROM, in order:
  1. $SELLING_GUIDE_PDF
  2. docs/fannie-mae/selling-guide/Selling-Guide_08-05-2026.pdf  (gitignored)
  3. recovered from this repository's own git history: the PDF was committed on
     2026-08-20 (repo then private) and removed from the tip on 2026-08-22 when the
     repo went public — but the blob remains in the merged history, so `git cat-file`
     can materialize it in any clone with no network at all. The recovered bytes are
     verified against a pinned SHA-256 before use. If the founder ever purges history,
     this path fails cleanly and the first two remain.

If all three fail it says so and STOPS. That is deliberate and matches CLAUDE.md: when
a document you need is missing, SAY SO — never answer a Fannie policy question from
memory. A missing source is an honest gap, not a licence to guess.

EXTRACTION FIDELITY — two defects of the first-generation extraction are fixed here,
both verified against the 08-05-2026 PDF:
  * Ligature glyphs are expanded (ﬁ→fi, ﬂ→fl, …). The PDF's body text uses ligature
    codepoints, so `grep Indemnification` used to miss 30 of 36 occurrences.
  * Page labels come from the actual section active on the page, whatever its TOC
    level. The old level>=4 rule missed Part E's level-3 leaves, so all ~66 glossary
    pages were labeled D2-1-04.

USAGE:
    python3 scripts/extract-selling-guide.py               extract + verify everything
    python3 scripts/extract-selling-guide.py --section B3-6-05    print one section
    python3 scripts/extract-selling-guide.py --check       verify the tracked fact layer
                                                           is current; exit 1 on drift

Requires pymupdf (`pip3 install pymupdf`) only to regenerate; reading the output needs
nothing. Output is deterministic for a given PDF + pymupdf version (no timestamps), so
re-running and `git diff` is the drift check for the tracked layer.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from bisect import bisect_right

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "docs", "fannie-mae", "selling-guide")
EXTRACTED = os.path.join(DIR, "extracted")

EDITION = "08-05-2026"
PDF_NAME = f"Selling-Guide_{EDITION}.pdf"

# Pinned identity of the source PDF. The sha256 is the edition check: a different
# Guide edition (or a corrupted recovery) fails loudly instead of silently producing
# an extraction that disagrees with the tracked fact layer.
PDF_SHA256 = "9b3fd0e850736142868d6801e2ef7b7674f1e0a26e2cf633db537773ac28e239"
PDF_BYTES = 3606598
# Where the bytes live inside this repository's own history (see docstring).
PDF_GIT_BLOB = "c984148cc8300ce6821687b6af6b0e637cafc461"
PDF_GIT_COMMIT = "978ec3839a69d15058c819d17cf19697cd7cd2dd"

RUNNING_HEADER = "Published August 5, 2026"

# Section IDs: A1-1-01, A2-3.1-01, B3-6-05, E-3-26, … A TOC entry whose title starts
# with one of these is a leaf section regardless of its TOC level (Part E's leaves sit
# at level 3; A2-3.x leaves at level 5).
SECTION_ID_RE = re.compile(
    r"^([A-E][0-9]?(?:-[0-9]+(?:\.[0-9]+)?)*-[0-9]{2}), (.+?)(?: \((\d{2}/\d{2}/\d{4})\))?$"
)
FRONT_TITLES = ("Table of Contents", "Preface")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def acquire_pdf():
    """Find or recover the PDF; return its path, or stop honestly."""
    env = os.environ.get("SELLING_GUIDE_PDF")
    local = os.path.join(DIR, PDF_NAME)
    for p in (env, local):
        if p and os.path.exists(p):
            return p

    # Recover from git history. cat-file needs no network and works in any clone that
    # still carries the blob; verify the bytes before trusting them.
    recovery_note = ""
    try:
        r = subprocess.run(
            ["git", "-C", ROOT, "cat-file", "blob", PDF_GIT_BLOB],
            capture_output=True, timeout=120,
        )
        if r.returncode == 0:
            digest = hashlib.sha256(r.stdout).hexdigest()
            if digest == PDF_SHA256:
                os.makedirs(DIR, exist_ok=True)
                with open(local, "wb") as fh:
                    fh.write(r.stdout)
                print(f"recovered {PDF_NAME} from git history "
                      f"(blob {PDF_GIT_BLOB[:12]}, sha256 verified) -> {local}")
                return local
            recovery_note = f"git blob {PDF_GIT_BLOB[:12]} exists but sha256 mismatch ({digest[:12]}…)"
        else:
            recovery_note = f"git blob {PDF_GIT_BLOB[:12]} not in this clone's history"
    except Exception as exc:  # git absent, timeout — recovery is best-effort
        recovery_note = f"git recovery failed: {exc}"

    sys.exit(
        "Selling Guide PDF not found — the repo is public, so it is deliberately not\n"
        "committed at the tip. Tried, in order:\n"
        f"  1. $SELLING_GUIDE_PDF          ({'unset' if not env else env + ' (missing)'})\n"
        f"  2. {local}  (missing)\n"
        f"  3. recovery from git history   ({recovery_note};\n"
        f"     the blob lives in commit {PDF_GIT_COMMIT[:12]} — a shallow clone may need\n"
        "     `git fetch --unshallow` first)\n"
        "Point SELLING_GUIDE_PDF at your copy, or drop it at path 2, and re-run.\n"
        "Do NOT answer a Fannie policy question from memory instead."
    )


# ---------------------------------------------------------------------------- TOC model

class Node:
    __slots__ = ("level", "title", "page", "kind", "sec_id", "name", "effective",
                 "breadcrumb", "anchor", "anchor_method", "end", "page_start", "page_end")

    def __init__(self, level, title, page):
        self.level, self.title, self.page = level, title, page
        m = SECTION_ID_RE.match(title)
        if m:
            self.kind = "section"
            self.sec_id, self.name, self.effective = m.group(1), m.group(2), m.group(3)
        elif title in FRONT_TITLES:
            self.kind, self.sec_id, self.name, self.effective = "front", None, title, None
        else:
            self.kind, self.sec_id, self.name, self.effective = "group", None, title, None
        self.breadcrumb = []

    def slug(self):
        base = self.sec_id if self.kind == "section" else self.title.split(",")[0]
        return re.sub(r"[^A-Za-z0-9.\-]+", "-", base).strip("-")

    def relfile(self):
        sub = "sections" if self.kind == "section" else "groups"
        return f"extracted/{sub}/{self.slug()}.txt"


def build_nodes(toc):
    nodes = [Node(lvl, title, page) for lvl, title, page in toc]
    stack = []  # breadcrumbs from TOC nesting levels
    for n in nodes:
        while stack and stack[-1].level >= n.level:
            stack.pop()
        n.breadcrumb = [s.title for s in stack]
        stack.append(n)
    return nodes


# ------------------------------------------------------------------- text + anchoring

def page_texts(doc, pymupdf):
    # Expand ligatures so the corpus matches how humans (and grep) spell words.
    flags = pymupdf.TEXTFLAGS_TEXT & ~pymupdf.TEXT_PRESERVE_LIGATURES
    return [doc[i].get_text("text", flags=flags) for i in range(doc.page_count)]


def strip_running_header(text):
    """Drop the per-page running header (the publication line and the printed page
    number adjacent to it). Only lines glued to the header line are dropped, so a
    legitimate bare number at the top of a page body survives."""
    lines = text.split("\n")
    head = lines[:3]
    try:
        h = next(i for i, ln in enumerate(head) if ln.strip() == RUNNING_HEADER)
    except StopIteration:
        return text, 0
    drop = {h}
    for adj in (h - 1, h + 1):
        if 0 <= adj < len(head) and re.fullmatch(r"\d{1,4}", lines[adj].strip()):
            drop.add(adj)
            break
    return "\n".join(ln for i, ln in enumerate(lines) if i not in drop), 1


def build_stream(pages_stripped):
    """One string for the whole document plus page-boundary offsets."""
    offsets, parts, pos = [], [], 0
    for t in pages_stripped:
        offsets.append(pos)
        parts.append(t)
        pos += len(t)
    return "".join(parts), offsets


def build_norm(stream):
    """Whitespace-collapsed view with a map back to original offsets, so a heading
    that wraps lines — or breaks across a page boundary — still matches."""
    chars, back, prev_space = [], [], True
    for i, ch in enumerate(stream):
        if ch.isspace():
            if not prev_space:
                chars.append(" ")
                back.append(i)
            prev_space = True
        else:
            chars.append(ch)
            back.append(i)
            prev_space = False
    return "".join(chars), back


def norm_title(title):
    return re.sub(r"\s+", " ", title).strip()


def anchor_nodes(nodes, stream, norm, norm_back, page_offsets, npages):
    """Give every TOC node a character offset. Preference order: the full heading
    found near its TOC page; a section ID at line start; the top of its TOC page.
    Anchors are monotonic, so segments tile the document exactly."""
    orig2norm_keys = norm_back  # sorted original offsets of surviving chars

    def to_norm(orig):
        return bisect_right(orig2norm_keys, orig - 1)

    def page_start(pno):  # 1-based
        return page_offsets[pno - 1] if pno - 1 < len(page_offsets) else len(stream)

    def page_end(pno):
        return page_offsets[pno] if pno < len(page_offsets) else len(stream)

    prev = 0
    for n in nodes:
        lo = max(prev, page_start(n.page))
        hi = page_end(min(n.page + 2, npages))
        if lo > hi:
            lo = prev
        method, pos = "page-fallback", None
        m = None
        nlo, nhi = to_norm(lo), to_norm(hi)
        idx = norm.find(norm_title(n.title), nlo, nhi)
        if idx >= 0:
            pos, method = norm_back[idx], "heading"
        elif n.kind == "section":
            m = re.compile(rf"(?m)^{re.escape(n.sec_id)}, ").search(stream, lo, hi)
            if m:
                pos, method = m.start(), "id-line"
        if pos is None:
            pos = max(prev, page_start(n.page))
        n.anchor, n.anchor_method = max(pos, prev), method
        prev = n.anchor
    for i, n in enumerate(nodes):
        n.end = nodes[i + 1].anchor if i + 1 < len(nodes) else len(stream)
        n.page_start = n.page
        last = max(n.anchor, n.end - 1)
        n.page_end = bisect_right(page_offsets, last)  # 1-based page containing last char
        if n.page_end < n.page_start:  # empty segment
            n.page_end = n.page_start


# ------------------------------------------------------------------------ file writers

NEVER_COMMIT = ("Generated locally by scripts/extract-selling-guide.py — gitignored; "
                "NEVER commit (Fannie Mae copyrighted work).")
RULE = "─" * 78


def page_marker_body(stream, page_offsets, start, end):
    """Slice of the stream with [[PAGE n]] markers inserted at page boundaries."""
    out = []
    pno = bisect_right(page_offsets, start)  # 1-based page containing `start`
    out.append(f"[[PAGE {pno}]]\n")
    pos = start
    while pos < end:
        nxt = page_offsets[pno] if pno < len(page_offsets) else end
        out.append(stream[pos:min(nxt, end)])
        pos = min(nxt, end)
        if pos < end:
            pno += 1
            out.append(f"\n[[PAGE {pno}]]\n")
    return "".join(out)


def write_section_file(n, stream, page_offsets, revised_pages):
    revised = "yes" if any(n.page_start <= p <= n.page_end for p in revised_pages.get(n.sec_id, [])) else "no"
    crumb = " > ".join(n.breadcrumb) if n.breadcrumb else "(top level)"
    pages = f"{n.page_start}" if n.page_start == n.page_end else f"{n.page_start}-{n.page_end}"
    header = (
        f"{n.title}\n"
        f"Fannie Mae Selling Guide · edition {EDITION} · PDF page(s) {pages}\n"
        f"{crumb}\n"
        f"Revised in this edition: {revised}\n"
        f"{NEVER_COMMIT}\n"
        f"{RULE}\n"
    )
    body = page_marker_body(stream, page_offsets, n.anchor, n.end)
    path = os.path.join(DIR, n.relfile())
    with open(path, "w") as fh:
        fh.write(header + body + "\n")


def write_group_file(n, stream, page_offsets):
    crumb = " > ".join(n.breadcrumb) if n.breadcrumb else "(top level)"
    header = (
        f"{n.title}\n"
        f"Fannie Mae Selling Guide · edition {EDITION} · banner/intro text only — "
        f"the sections under this node live in extracted/sections/\n"
        f"{crumb}\n"
        f"{NEVER_COMMIT}\n"
        f"{RULE}\n"
    )
    body = page_marker_body(stream, page_offsets, n.anchor, n.end) if n.end > n.anchor else "(no intro text)\n"
    with open(os.path.join(DIR, n.relfile()), "w") as fh:
        fh.write(header + body + "\n")


def write_page_stream(raw_pages, nodes, path):
    """The legacy grep target: every page verbatim (ligatures expanded), prefixed
    [[PAGE n | <label>]] where the label is the section active on that page."""
    label_at = {}
    for n in nodes:
        if n.kind == "section":
            label_at.setdefault(n.page, n.title)
    current = "(front matter)"
    with open(path, "w") as fh:
        for i, text in enumerate(raw_pages):
            pno = i + 1
            current = label_at.get(pno, current)
            fh.write(f"\n[[PAGE {pno} | {current}]]\n")
            fh.write(text)


# ------------------------------------------------------------------ tracked fact layer

def render_section_index(toc):
    lines = ["level\tpdf_page\tsection\n"]
    for lvl, title, page in toc:
        lines.append(f"{lvl}\t{page}\t{title}\n")
    return "".join(lines)


def compute_revised(doc, toc):
    """Sections revised in this edition, from the PDF's highlight annotations.
    Same attribution rule as the first-generation script (nearest preceding TOC
    node of any level), so revised-sections.tsv stays byte-identical."""

    def section_for(pno):
        best = "(front matter)"
        for lvl, title, page in toc:
            if page <= pno:
                best = title
            else:
                break
        return best

    revised = {}
    for i, page in enumerate(doc):
        for _ in page.annots() or []:
            revised.setdefault(section_for(i + 1), i + 1)
    return revised


def render_revised(revised):
    lines = ["pdf_page\tsection\n"]
    for title, pno in sorted(revised.items(), key=lambda kv: kv[1]):
        lines.append(f"{pno}\t{title}\n")
    return "".join(lines)


def render_toc_json(nodes, npages, annotations):
    entries = []
    for n in nodes:
        e = {
            "level": n.level,
            "kind": n.kind,
            "title": n.title,
            "pdf_page": n.page,
            "page_end": n.page_end,
        }
        if n.kind == "section":
            e["id"] = n.sec_id
            e["name"] = n.name
            e["effective"] = n.effective
            e["file"] = n.relfile()
        if n.breadcrumb:
            e["breadcrumb"] = n.breadcrumb
        entries.append(e)
    payload = {
        "_": ("Fannie Mae Selling Guide structure — titles, pages, dates only (facts). "
              "The text itself is generated locally by scripts/extract-selling-guide.py "
              "and never committed: this repo is public and the Guide is copyrighted."),
        "edition": EDITION,
        "pdf_pages": npages,
        "highlight_annotations": annotations,
        "entries": entries,
    }
    return json.dumps(payload, indent=1, ensure_ascii=False) + "\n"


def render_manifest(nodes, npages, toc_len, annotations):
    kinds = {}
    for n in nodes:
        kinds[n.kind] = kinds.get(n.kind, 0) + 1
    payload = {
        "_": ("Identity of the Selling Guide corpus. The sha256 pins the exact edition; "
              "git_blob/git_commit is where the PDF is recoverable from this repo's own "
              "history with no network (scripts/extract-selling-guide.py does this "
              "automatically). Facts only — no Guide content."),
        "edition": EDITION,
        "source_pdf": {
            "filename": PDF_NAME,
            "sha256": PDF_SHA256,
            "bytes": PDF_BYTES,
            "git_blob": PDF_GIT_BLOB,
            "git_commit": PDF_GIT_COMMIT,
        },
        "pdf": {"pages": npages, "toc_entries": toc_len, "highlight_annotations": annotations},
        "structure": {
            "leaf_sections": kinds.get("section", 0),
            "group_nodes": kinds.get("group", 0),
            "front_matter_nodes": kinds.get("front", 0),
        },
        "tracked": ["README.md", "INDEX.md", "section-index.tsv", "revised-sections.tsv",
                    "toc.json", "manifest.json"],
        "generated_gitignored": [PDF_NAME, "selling-guide-text.txt", "extracted/"],
        "regenerate": "python3 scripts/extract-selling-guide.py",
        "format_version": 2,
    }
    return json.dumps(payload, indent=1, ensure_ascii=False) + "\n"


def render_index_md(nodes, npages):
    out = [
        "# Fannie Mae Selling Guide — section index\n\n",
        f"Edition **{EDITION}** · {npages} PDF pages. This index is tracked (titles and\n",
        "page numbers are facts); the linked text files are **generated locally** by\n",
        "`python3 scripts/extract-selling-guide.py` and are gitignored — run it once and\n",
        "every link below resolves. See [README.md](README.md) for why.\n\n",
    ]
    for n in nodes:
        indent = "  " * (n.level - 1)
        pages = f"p. {n.page_start}" if n.page_start == n.page_end else f"pp. {n.page_start}–{n.page_end}"
        if n.kind == "section":
            date = f" ({n.effective})" if n.effective else ""
            out.append(f"{indent}- [`{n.sec_id}`]({n.relfile()}) {n.name}{date} — {pages}\n")
        else:
            out.append(f"{indent}- **{n.title}** — {pages}\n")
    return "".join(out)


# ----------------------------------------------------------------------- verification

def verify(nodes, stream, page_offsets, doc, report):
    problems = []
    sections = [n for n in nodes if n.kind == "section"]

    # Every section file exists, is non-empty, and contains its own heading.
    for n in sections:
        path = os.path.join(DIR, n.relfile())
        if not os.path.exists(path):
            problems.append(f"missing file: {n.relfile()}")
            continue
        with open(path) as fh:
            content = fh.read()
        body = content.split(RULE, 1)[-1]
        if len(body.strip()) < 40:
            problems.append(f"near-empty section body: {n.sec_id}")
        if norm_title(n.title) not in re.sub(r"\s+", " ", body) and n.anchor_method == "page-fallback":
            # fallback anchors are page-accurate but the heading itself was not
            # located — recorded, not fatal, so the gap stays visible
            report["unanchored_sections"].append(n.sec_id)

    # Segments tile the whole stream: no character of the Guide is dropped.
    covered = (nodes[0].anchor if nodes else len(stream))
    for i, n in enumerate(nodes):
        if n.anchor != covered:
            problems.append(f"coverage gap before {n.title!r}")
        covered = n.end
    if covered != len(stream):
        problems.append("coverage gap at end of document")

    # Anchors found where the TOC said they would be.
    for n in sections:
        apage = bisect_right(page_offsets, n.anchor)
        if not (n.page <= apage <= n.page + 2):
            problems.append(f"{n.sec_id}: anchor on page {apage}, TOC says {n.page}")

    report["problems"] = problems
    return problems


def compare_tracked(rendered):
    """rendered: {relpath: text}. Returns list of paths whose on-disk content differs."""
    drift = []
    for rel, text in rendered.items():
        path = os.path.join(DIR, rel)
        on_disk = open(path).read() if os.path.exists(path) else None
        if on_disk != text:
            drift.append(rel)
    return drift


# ------------------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--section", metavar="ID", help="print one section (extracting first if needed)")
    ap.add_argument("--check", action="store_true",
                    help="verify the tracked fact layer matches the PDF; exit 1 on drift")
    args = ap.parse_args()

    if args.section and not args.check:
        # fast path: already extracted -> print with no PDF and no re-run
        fast = os.path.join(EXTRACTED, "sections", args.section.strip() + ".txt")
        if os.path.exists(fast):
            with open(fast) as fh:
                sys.stdout.write(fh.read())
            return

    pdf_path = acquire_pdf()
    digest = sha256_file(pdf_path)
    if digest != PDF_SHA256:
        sys.exit(
            f"{os.path.basename(pdf_path)} sha256 {digest[:16]}… does not match the pinned\n"
            f"{EDITION} edition ({PDF_SHA256[:16]}…). A different edition needs the pinned\n"
            "constants in this script updated deliberately — and the conformance scrub\n"
            "re-run — not silently extracted."
        )

    try:
        import pymupdf
    except ImportError:
        sys.exit("pymupdf required to regenerate: pip3 install pymupdf")

    doc = pymupdf.open(pdf_path)
    toc = doc.get_toc()
    npages = doc.page_count
    nodes = build_nodes(toc)

    raw_pages = page_texts(doc, pymupdf)
    stripped, header_hits = [], 0
    for t in raw_pages:
        s, hit = strip_running_header(t)
        stripped.append(s)
        header_hits += hit
    stream, page_offsets = build_stream(stripped)
    norm, norm_back = build_norm(stream)
    anchor_nodes(nodes, stream, norm, norm_back, page_offsets, npages)

    revised = compute_revised(doc, toc)
    annotations = sum(1 for p in doc for _ in (p.annots() or []))

    # revised pages per section id, for the per-file "Revised in this edition" flag
    revised_pages = {}
    for title, pno in revised.items():
        m = SECTION_ID_RE.match(title)
        if m:
            revised_pages.setdefault(m.group(1), []).append(pno)

    rendered = {
        "section-index.tsv": render_section_index(toc),
        "revised-sections.tsv": render_revised(revised),
        "toc.json": render_toc_json(nodes, npages, annotations),
        "manifest.json": render_manifest(nodes, npages, len(toc), annotations),
        "INDEX.md": render_index_md(nodes, npages),
    }

    if args.check:
        drift = compare_tracked(rendered)
        if drift:
            print("tracked fact layer is STALE relative to the PDF: " + ", ".join(drift))
            print("re-run `python3 scripts/extract-selling-guide.py` and commit the tracked files")
            sys.exit(1)
        print(f"tracked fact layer is current (edition {EDITION}, {npages} pages, "
              f"{len(toc)} TOC entries, {annotations} annotations)")
        return

    os.makedirs(os.path.join(EXTRACTED, "sections"), exist_ok=True)
    os.makedirs(os.path.join(EXTRACTED, "groups"), exist_ok=True)

    report = {
        "edition": EDITION,
        "pymupdf": pymupdf.__version__,
        "pages": npages,
        "toc_entries": len(toc),
        "running_headers_stripped": header_hits,
        "anchor_methods": {},
        "unanchored_sections": [],
    }
    for n in nodes:
        report["anchor_methods"][n.anchor_method] = report["anchor_methods"].get(n.anchor_method, 0) + 1

    # front matter: everything before the first TOC node
    first_anchor = nodes[0].anchor if nodes else len(stream)
    with open(os.path.join(EXTRACTED, "front-matter.txt"), "w") as fh:
        fh.write(f"Selling Guide cover pages (before the first TOC entry)\n{NEVER_COMMIT}\n{RULE}\n")
        fh.write(page_marker_body(stream, page_offsets, 0, first_anchor) + "\n")

    for n in nodes:
        if n.kind == "section":
            write_section_file(n, stream, page_offsets, revised_pages)
        else:
            write_group_file(n, stream, page_offsets)

    write_page_stream(raw_pages, nodes, os.path.join(DIR, "selling-guide-text.txt"))

    for rel, text in rendered.items():
        with open(os.path.join(DIR, rel), "w") as fh:
            fh.write(text)

    problems = verify(nodes, stream, page_offsets, doc, report)
    with open(os.path.join(EXTRACTED, "extraction-report.json"), "w") as fh:
        json.dump(report, fh, indent=1)
        fh.write("\n")

    sections = [n for n in nodes if n.kind == "section"]
    print(
        f"source={os.path.basename(pdf_path)} sha256=✓ pages={npages} toc={len(toc)} "
        f"sections={len(sections)} groups={sum(1 for n in nodes if n.kind != 'section')} "
        f"revised={len(revised)} headers_stripped={header_hits}\n"
        f"  anchors: {report['anchor_methods']}"
        + (f" unanchored={report['unanchored_sections']}" if report["unanchored_sections"] else "")
        + "\n"
        f"  tracked:    section-index.tsv revised-sections.tsv toc.json manifest.json INDEX.md\n"
        f"  gitignored: selling-guide-text.txt extracted/ ({len(sections)} section files) — never commit"
    )
    if problems:
        print("\nVERIFICATION PROBLEMS:")
        for p in problems:
            print(f"  ✗ {p}")
        sys.exit(1)

    if args.section:
        want = args.section.strip()
        match = next((n for n in sections if n.sec_id == want), None)
        if not match:
            sys.exit(f"no section {want!r} in the {EDITION} TOC — check INDEX.md")
        with open(os.path.join(DIR, match.relfile())) as fh:
            print("\n" + fh.read())


if __name__ == "__main__":
    main()
