#!/usr/bin/env python3
"""
Rebuild assets/cv.pdf from cv-src/Main.dc.html.

The CV artboard is an A4 page authored at 96dpi (794x1123 css px). Chrome's
print-to-pdf defaults to US Letter, so the page box has to be pinned to A4
explicitly or the content overflows onto a second sheet.

Page 2 of the CV is Gavin Yeo's recommendation letter, which has no source in
this repo. It is carried over from the existing assets/cv.pdf rather than
regenerated, so this script needs the current PDF present to run.

    python cv-src/build-cv.py
"""

import os
import shutil
import subprocess
import sys
import tempfile

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "cv-src", "Main.dc.html")
OUT = os.path.join(ROOT, "assets", "cv.pdf")

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

# Pin the sheet to A4 with no printer margin, so the artboard maps 1:1 onto it.
PRINT_CSS = """<style id="print-fix">
@page { size: A4; margin: 0; }
html, body { margin: 0 !important; padding: 0 !important; background: #070b12; }
</style>
"""


def find_chrome():
    for path in CHROME_CANDIDATES:
        if os.path.exists(path):
            return path
    raise SystemExit("Chrome/Edge not found. Add its path to CHROME_CANDIDATES.")


def main():
    if not os.path.exists(OUT):
        raise SystemExit(
            "assets/cv.pdf is missing, so page 2 (the recommendation letter) "
            "cannot be carried over. Restore it first."
        )

    html = open(SRC, encoding="utf-8").read()
    if "</head>" not in html:
        raise SystemExit("no </head> in the source; cannot inject the print CSS")
    html = html.replace("</head>", PRINT_CSS + "</head>", 1)

    tmp = tempfile.mkdtemp(prefix="cvbuild-")
    build_html = os.path.join(tmp, "cv-print.html")
    page1_pdf = os.path.join(tmp, "page1.pdf")
    open(build_html, "w", encoding="utf-8").write(html)

    subprocess.run(
        [
            find_chrome(),
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--no-pdf-header-footer",
            "--virtual-time-budget=10000",
            "--print-to-pdf=" + page1_pdf,
            "file:///" + build_html.replace("\\", "/"),
        ],
        check=True,
        capture_output=True,
    )

    page1 = pymupdf.open(page1_pdf)
    if len(page1) != 1:
        raise SystemExit(
            f"expected 1 rendered page, got {len(page1)} - the content is "
            "overflowing the A4 box, so trim the artboard before shipping."
        )

    w, h = page1[0].rect.width, page1[0].rect.height
    if not (594 < w < 596 and 841 < h < 843):
        raise SystemExit(f"page is {w:.1f}x{h:.1f}pt, expected A4 (595x842)")

    # keep the existing page 2 (the letter), which has no source here
    letter = pymupdf.open(OUT)
    out = pymupdf.open()
    out.insert_pdf(page1, from_page=0, to_page=0)
    out.insert_pdf(letter, from_page=1, to_page=len(letter) - 1)

    # back up outside the repo: anything under assets/ gets served publicly
    backup = os.path.join(tempfile.gettempdir(), "cv-previous.pdf")
    shutil.copy(OUT, backup)

    # write to a temp file and move it in: saving over a PDF that is still open
    # for reading fails on Windows
    staged = os.path.join(tmp, "cv.pdf")
    out.save(staged, garbage=3, deflate=True)
    pages = len(out)
    out.close()
    letter.close()
    page1.close()
    shutil.move(staged, OUT)

    print(f"built {OUT}  ({pages} pages, {os.path.getsize(OUT)} bytes)")
    print(f"previous version kept at {backup}")
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
