"""
Auto-detect MJ-baked kanji watermarks via adaptive threshold in
corner/strip regions, then Telea inpaint to remove them.
Output: nft_source_clean/ (cleaned PNGs) + _review/ (overlays + summary HTML).
"""
import cv2
import numpy as np
from pathlib import Path

SRC_ROOT = Path("kami-merge-nft-source")
DST_ROOT = Path("nft_source_clean")
REVIEW = DST_ROOT / "_review"

# Tunable
INPAINT_RADIUS = 25
ADAPTIVE_BLOCK = 251     # odd; > expected kanji char size in 2048px image
ADAPTIVE_C = 10
MIN_BLOB_AREA = 1500
MAX_BLOB_AREA = 80000
DILATE_KERNEL = 9
PADDING_PASS = 12

# Regions where MJ typically bakes watermarks (y0,y1,x0,x1 as fractions)
DETECT_REGIONS = [
    (0.00, 0.20, 0.00, 1.00),  # top strip
    (0.80, 1.00, 0.00, 1.00),  # bottom strip
    (0.00, 0.30, 0.80, 1.00),  # top-right corner
    (0.70, 1.00, 0.00, 0.30),  # bottom-left corner
    (0.70, 1.00, 0.70, 1.00),  # bottom-right corner
]

def detect_mask(img_bgr):
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    mask = np.zeros((h, w), dtype=np.uint8)
    for (y0f, y1f, x0f, x1f) in DETECT_REGIONS:
        y0, y1, x0, x1 = int(h*y0f), int(h*y1f), int(w*x0f), int(w*x1f)
        roi = gray[y0:y1, x0:x1]
        thresh = cv2.adaptiveThreshold(
            roi, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, ADAPTIVE_BLOCK, ADAPTIVE_C)
        n, labels, stats, _ = cv2.connectedComponentsWithStats(thresh)
        sub = np.zeros_like(roi)
        for i in range(1, n):
            area = stats[i, cv2.CC_STAT_AREA]
            if MIN_BLOB_AREA <= area <= MAX_BLOB_AREA:
                sub[labels == i] = 255
        mask[y0:y1, x0:x1] = cv2.bitwise_or(mask[y0:y1, x0:x1], sub)
    k1 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,
                                   (DILATE_KERNEL, DILATE_KERNEL))
    mask = cv2.dilate(mask, k1, iterations=2)
    k2 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,
                                   (PADDING_PASS*2+1, PADDING_PASS*2+1))
    mask = cv2.dilate(mask, k2)
    return mask

def overlay_red(img, mask):
    red = np.zeros_like(img); red[:] = (0, 0, 255)
    blended = cv2.addWeighted(img, 0.5, red, 0.5, 0)
    out = img.copy(); out[mask > 0] = blended[mask > 0]
    return out

def process(src, dst, ovr):
    img = cv2.imread(str(src))
    if img is None:
        print(f"  ✗ load failed: {src}"); return False, 0
    mask = detect_mask(img)
    pct = (mask > 0).sum() / mask.size * 100
    if mask.sum() == 0:
        cv2.imwrite(str(dst), img); cv2.imwrite(str(ovr), img)
    else:
        cleaned = cv2.inpaint(img, mask, INPAINT_RADIUS, cv2.INPAINT_TELEA)
        cv2.imwrite(str(dst), cleaned)
        cv2.imwrite(str(ovr), overlay_red(img, mask))
    print(f"  ✓ {src.name} (mask: {pct:.2f}%)")
    return True, pct

def main():
    DST_ROOT.mkdir(exist_ok=True); REVIEW.mkdir(exist_ok=True)
    yokai_dirs = sorted(d for d in SRC_ROOT.iterdir() if d.is_dir())
    print(f"Processing {len(yokai_dirs)} yokai dirs from {SRC_ROOT}/")
    total = ok = 0
    pcts = []
    for yd in yokai_dirs:
        out = DST_ROOT / yd.name; out.mkdir(exist_ok=True)
        print(f"\n{yd.name}/")
        for png in sorted(yd.glob("*.png")):
            total += 1
            success, pct = process(png, out / png.name,
                                   REVIEW / f"{png.stem}_overlay.png")
            if success:
                ok += 1; pcts.append((png.stem, pct))

    # Summary HTML
    cards = []
    for yd in yokai_dirs:
        for png in sorted(yd.glob("*.png")):
            stem = png.stem
            cards.append(f"""<div class="card">
  <h3>{stem}</h3>
  <div class="row">
    <figure><figcaption>Original</figcaption>
      <img src="../../{SRC_ROOT}/{yd.name}/{png.name}"></figure>
    <figure><figcaption>Detected mask (red)</figcaption>
      <img src="./{stem}_overlay.png"></figure>
    <figure><figcaption>Cleaned</figcaption>
      <img src="../{yd.name}/{png.name}"></figure>
  </div></div>""")
    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Stage 1 Kanji Cleanup Review</title><style>
body{{background:#0f0f1e;color:#f5e6c8;font-family:ui-monospace,monospace;
     padding:24px;margin:0;}}
h1{{color:#c8a04c;}}
.card{{margin-bottom:48px;padding-bottom:24px;
       border-bottom:1px solid rgba(200,160,76,0.2);}}
.card h3{{color:#c8a04c;font-size:18px;margin:0 0 12px;}}
.row{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}}
figure{{margin:0;}}
figcaption{{font-size:11px;color:rgba(200,160,76,0.6);margin-bottom:4px;}}
img{{width:100%;height:auto;display:block;
     border:1px solid rgba(200,160,76,0.2);background:#000;}}
.legend{{margin:0 0 24px;color:rgba(245,230,200,0.7);font-size:13px;}}
</style></head><body>
<h1>Stage 1 Kanji Cleanup — Review</h1>
<p class="legend">Original (left) → Detected mask in red (middle) →
Cleaned via Telea inpaint (right). Если справа всё ещё видны kanji →
этот файл нужен manual mask. Если справа артворк смазан/повреждён →
mask слишком агрессивный, надо тюнить параметры.</p>
{"".join(cards)}</body></html>"""
    (REVIEW / "_summary.html").write_text(html)

    print(f"\n=== {ok}/{total} processed ===")
    print(f"Review: open {(REVIEW / '_summary.html').resolve()} в браузере")
    print(f"\n=== Mask coverage stats ===")
    for stem, pct in sorted(pcts, key=lambda x: -x[1])[:10]:
        print(f"  {stem}: {pct:.2f}%")
    print(f"  ...")
    no_mask = sum(1 for _, p in pcts if p == 0)
    print(f"  {no_mask} files with NO mask detected (sus — kanji могли промахнуться)")

if __name__ == "__main__":
    main()
