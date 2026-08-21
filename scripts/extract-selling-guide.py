#!/usr/bin/env python3
"""Extract the Fannie Mae Selling Guide PDF into greppable text + a section index.

Why this exists: the Selling Guide is the top of the compliance document hierarchy
(CLAUDE.md), but a 1,185-page PDF cannot be grepped, and `Read` cannot render it
without poppler installed. This produces two committed artifacts that any session can
search with plain `grep`, with no tooling prerequisites:

  docs/fannie-mae/selling-guide/selling-guide-text.txt   full text, page-marked
  docs/fannie-mae/selling-guide/section-index.tsv        section -> PDF page

Regenerate after replacing the PDF with a newer edition:
    python3 scripts/extract-selling-guide.py

Requires pymupdf (`pip3 install pymupdf`). Only needed to regenerate, never to read.
"""
import json
import os
import sys

try:
    import fitz  # pymupdf
except ImportError:
    sys.exit("pymupdf required to regenerate: pip3 install pymupdf")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "docs", "fannie-mae", "selling-guide")
PDF = os.path.join(DIR, "Selling-Guide_08-05-2026.pdf")

doc = fitz.open(PDF)
toc = doc.get_toc()

# section-index.tsv — level, PDF page, section title
with open(os.path.join(DIR, "section-index.tsv"), "w") as fh:
    fh.write("level\tpdf_page\tsection\n")
    for lvl, title, page in toc:
        fh.write(f"{lvl}\t{page}\t{title}\n")

# nearest preceding TOC title for any page
starts = {}
for lvl, title, page in toc:
    if lvl >= 4:  # section level (e.g. "B3-6-05, Monthly Debt Obligations")
        starts.setdefault(page, title)

current = "(front matter)"
chunks = []
for i, page in enumerate(doc):
    pno = i + 1
    if pno in starts:
        current = starts[pno]
    chunks.append(f"\n[[PAGE {pno} | {current}]]\n")
    chunks.append(page.get_text("text"))

with open(os.path.join(DIR, "selling-guide-text.txt"), "w") as fh:
    fh.write("".join(chunks))

# highlights.json — the annotations carried in the source PDF. In the 08-05-2026
# edition these mark the sections revised in that release, so they are the change list.
rows = []
for i, page in enumerate(doc):
    for a in page.annots() or []:
        q = a.vertices
        txt = ""
        if q and len(q) >= 4:
            for k in range(0, len(q), 4):
                txt += page.get_text("text", clip=fitz.Quad(q[k:k + 4]).rect).replace("\n", " ") + " "
        else:
            txt = page.get_text("text", clip=a.rect).replace("\n", " ")
        rows.append({"page": i + 1, "text": " ".join(txt.split())})
with open(os.path.join(DIR, "highlights.json"), "w") as fh:
    json.dump(rows, fh, indent=1)

print(f"pages={doc.page_count} toc={len(toc)} highlights={len(rows)}")
