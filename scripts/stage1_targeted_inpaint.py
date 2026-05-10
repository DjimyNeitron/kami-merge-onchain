"""
Targeted per-file kanji inpaint via explicit bbox coords.
Designed to be extended file-by-file as bboxes are visually identified.
"""
import cv2
import numpy as np
from pathlib import Path

SRC_ROOT = Path("kami-merge-nft-source")
DST_ROOT = Path("nft_source_clean")
REVIEW = DST_ROOT / "_review"

# Per-file bbox specs.
# Each entry: relative_path → list of (x1, y1, x2, y2) in source pixel coords.
# Empty list → file copied as-is (no inpaint needed).
TARGETS = {
    "raijin/raijin_common.png": [
        (1050, 1270, 1480, 1490),  # 2 kanji on stone plaque
    ],
    # Add more entries here as bboxes are identified per file:
    # "kodama/kodama_common.png": [],
    # "tengu/tengu_epic.png": [(x1, y1, x2, y2), ...],
}

INPAINT_RADIUS = 15      # px — Telea smoothing radius; lower = sharper
PADDING = 10             # px — extra around bbox to soften edges

def clean_file(src: Path, dst: Path, ovr: Path, bboxes):
    img = cv2.imread(str(src))
    if img is None:
        print(f"  ✗ load failed: {src}")
        return
    h, w = img.shape[:2]

    if not bboxes:
        # Copy as-is, no inpaint
        cv2.imwrite(str(dst), img)
        cv2.imwrite(str(ovr), img)
        print(f"  → {src.name}: copy as-is (no bbox)")
        return

    mask = np.zeros((h, w), dtype=np.uint8)
    for (x1, y1, x2, y2) in bboxes:
        x1p = max(0, x1 - PADDING)
        y1p = max(0, y1 - PADDING)
        x2p = min(w, x2 + PADDING)
        y2p = min(h, y2 + PADDING)
        mask[y1p:y2p, x1p:x2p] = 255

    cleaned = cv2.inpaint(img, mask, INPAINT_RADIUS, cv2.INPAINT_TELEA)
    cv2.imwrite(str(dst), cleaned)

    # Build red overlay for review
    red = np.zeros_like(img); red[:] = (0, 0, 255)
    blended = cv2.addWeighted(img, 0.5, red, 0.5, 0)
    overlay = img.copy(); overlay[mask > 0] = blended[mask > 0]
    cv2.imwrite(str(ovr), overlay)

    pct = (mask > 0).sum() / mask.size * 100
    print(f"  ✓ {src.name}: {len(bboxes)} bbox, mask = {pct:.2f}%")

def main():
    DST_ROOT.mkdir(exist_ok=True)
    REVIEW.mkdir(exist_ok=True)

    print(f"Targeted inpaint over {len(TARGETS)} file(s)\n")

    for rel_path, bboxes in TARGETS.items():
        src = SRC_ROOT / rel_path
        dst = DST_ROOT / rel_path
        dst.parent.mkdir(parents=True, exist_ok=True)
        ovr = REVIEW / f"{src.stem}_overlay.png"
        clean_file(src, dst, ovr, bboxes)

    # Build review HTML
    cards = []
    for rel_path, bboxes in TARGETS.items():
        src = SRC_ROOT / rel_path
        stem = src.stem
        bbox_str = ", ".join(f"({x1},{y1},{x2},{y2})" for (x1,y1,x2,y2) in bboxes) or "(none — copy as-is)"
        cards.append(f"""<div class="card">
  <h3>{rel_path}</h3>
  <div class="bbox">bbox: {bbox_str}</div>
  <div class="row">
    <figure><figcaption>Original</figcaption>
      <img src="../../{src}"></figure>
    <figure><figcaption>Masked region (red)</figcaption>
      <img src="./{stem}_overlay.png"></figure>
    <figure><figcaption>Cleaned</figcaption>
      <img src="../{rel_path}"></figure>
  </div></div>""")

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Targeted Inpaint Review</title><style>
body{{background:#0f0f1e;color:#f5e6c8;font-family:ui-monospace,monospace;
     padding:24px;margin:0;}}
h1{{color:#c8a04c;}}
.card{{margin-bottom:48px;padding-bottom:24px;
       border-bottom:1px solid rgba(200,160,76,0.2);}}
.card h3{{color:#c8a04c;font-size:18px;margin:0 0 4px;}}
.bbox{{color:rgba(245,230,200,0.5);font-size:12px;margin-bottom:12px;}}
.row{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}}
figure{{margin:0;}}
figcaption{{font-size:11px;color:rgba(200,160,76,0.6);margin-bottom:4px;}}
img{{width:100%;height:auto;display:block;
     border:1px solid rgba(200,160,76,0.2);background:#000;}}
</style></head><body>
<h1>Targeted Inpaint Review</h1>
{"".join(cards)}</body></html>"""

    out = REVIEW / "_summary.html"
    out.write_text(html)
    print(f"\nReview: open {out.resolve()} в браузере")

if __name__ == "__main__":
    main()
