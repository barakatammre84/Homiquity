#!/usr/bin/env python3
"""Make the Fannie Mae Selling Guide greppable LOCALLY, without redistributing it.

The Selling Guide is the top of the compliance document hierarchy (CLAUDE.md), but
a 1,185-page PDF cannot be grepped and `Read` cannot render it without poppler. The
answer is a page-marked text extraction — generated on demand, never committed.

WHY NOT COMMITTED: this repository is PUBLIC. The Guide is Fannie Mae's
copyrighted work, and a complete text extraction is the same content in another
format, not a lesser form of it. Publishing either would be redistribution. So the
generated artifacts are gitignored and only `section-index.tsv` — table-of-contents
titles and page numbers, i.e. factual metadata — is tracked.

WHAT IS TRACKED, and why that is enough to keep working:
  * docs/fannie-mae/selling-guide/section-index.tsv   section -> PDF page (tracked)
  * docs/fannie-mae/selling-guide/revised-sections.tsv sections revised in this
    edition, derived from the PDF's highlight annotations (tracked; titles only,
    no quoted body text)
  * knowledge-base/compliance/SELLING_GUIDE_CONFORMANCE.md — our own analysis of
    what the code agrees and disagrees with, including brief attributed quotes

Run this to regenerate the full local text:

    python3 scripts/extract-selling-guide.py

It looks for the PDF in this order:
  1. $SELLING_GUIDE_PDF
  2. docs/fannie-mae/selling-guide/Selling-Guide_08-05-2026.pdf  (gitignored)
  3. ~/Developer/Homiquity Industry Reference Documents/Selling-Guide_08-05-2026_highlighted.pdf

If none exists it says so and stops. That is deliberate and matches CLAUDE.md: when
a document you need is missing, SAY SO — never answer a Fannie policy question from
memory. A missing source is an honest gap, not a licence to guess.

Requires pymupdf (`pip3 install pymupdf`) only to regenerate; reading the output
needs nothing.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "docs", "fannie-mae", "selling-guide")

CANDIDATES = [
    os.environ.get("SELLING_GUIDE_PDF"),
    os.path.join(DIR, "Selling-Guide_08-05-2026.pdf"),
    os.path.expanduser(
        "~/Developer/Homiquity Industry Reference Documents/"
        "Selling-Guide_08-05-2026_highlighted.pdf"
    ),
]

PDF = next((p for p in CANDIDATES if p and os.path.exists(p)), None)
if PDF is None:
    sys.exit(
        "Selling Guide PDF not found — the repo is public, so it is deliberately not\n"
        "committed. Point SELLING_GUIDE_PDF at your copy, or drop it at\n"
        f"  {os.path.join(DIR, 'Selling-Guide_08-05-2026.pdf')}  (gitignored)\n"
        "and re-run. Do NOT answer a Fannie policy question from memory instead."
    )

try:
    import fitz  # pymupdf
except ImportError:
    sys.exit("pymupdf required to regenerate: pip3 install pymupdf")

doc = fitz.open(PDF)
toc = doc.get_toc()

# section-index.tsv — TRACKED. Titles and page numbers only.
with open(os.path.join(DIR, "section-index.tsv"), "w") as fh:
    fh.write("level\tpdf_page\tsection\n")
    for lvl, title, page in toc:
        fh.write(f"{lvl}\t{page}\t{title}\n")

# nearest preceding section title for any page
starts = {}
for lvl, title, page in toc:
    if lvl >= 4:  # e.g. "B3-6-05, Monthly Debt Obligations"
        starts.setdefault(page, title)

current = "(front matter)"
chunks = []
for i, page in enumerate(doc):
    pno = i + 1
    if pno in starts:
        current = starts[pno]
    chunks.append(f"\n[[PAGE {pno} | {current}]]\n")
    chunks.append(page.get_text("text"))

# selling-guide-text.txt — GITIGNORED. The complete work; never commit it.
with open(os.path.join(DIR, "selling-guide-text.txt"), "w") as fh:
    fh.write("".join(chunks))

# revised-sections.tsv — TRACKED. The PDF's highlight annotations mark the sections
# revised in this edition, so this is the release's change list. Only the SECTION
# TITLE and page are kept: the annotated body text is quoted Guide content and is
# deliberately not reproduced here.
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

with open(os.path.join(DIR, "revised-sections.tsv"), "w") as fh:
    fh.write("pdf_page\tsection\n")
    for title, pno in sorted(revised.items(), key=lambda kv: kv[1]):
        fh.write(f"{pno}\t{title}\n")

print(
    f"source={os.path.basename(PDF)} pages={doc.page_count} toc={len(toc)} "
    f"revised_sections={len(revised)}\n"
    f"  tracked:    section-index.tsv, revised-sections.tsv\n"
    f"  gitignored: selling-guide-text.txt (the complete work — never commit)"
)
