"""
Stage 2: render all 44 NFT cards (or selective) via Playwright.

Modes:
  --static-only      → just static PNGs (44 files, ~5 min)
  --animated-only    → just animated WebPs (44 files, ~15 min)
  (no flag)          → both static + animated
  --only <id>_<tier> → filter to single card (e.g. kodama_common)
  --gallery-only     → regenerate gallery.html from existing files

Output:
  public/nft_assets/static/<yokai>_<tier>.png    × 44
  public/nft_assets/animated/<yokai>_<tier>.webp × 44
  public/nft_assets/gallery.html
"""
import argparse
import asyncio
import math
import sys
import tempfile
from pathlib import Path
from playwright.async_api import async_playwright

# Yokai metadata — order canonical with src/config/yokai.ts
# (kodama → amaterasu, smallest → largest in merge chain).
YOKAI = [
    ("kodama",    "KODAMA",    "木霊"),
    ("hitodama",  "HITODAMA",  "人魂"),
    ("tanuki",    "TANUKI",    "狸"),
    ("kappa",     "KAPPA",     "河童"),
    ("kitsune",   "KITSUNE",   "狐"),
    ("jorogumo",  "JOROGUMO",  "絡新婦"),
    ("tengu",     "TENGU",     "天狗"),
    ("oni",       "ONI",       "鬼"),
    ("raijin",    "RAIJIN",    "雷神"),
    ("ryujin",    "RYUJIN",    "龍神"),
    ("amaterasu", "AMATERASU", "天照"),
]
TIERS = ["common", "rare", "epic", "legendary"]

REPO_ROOT = Path(__file__).parent.parent.resolve()
RENDER_HTML = REPO_ROOT / "dev-reference" / "nft_card_render.html"
SRC_DIR = REPO_ROOT / "kami-merge-nft-source"
OUT_DIR = REPO_ROOT / "public" / "nft_assets"
OUT_STATIC = OUT_DIR / "static"
OUT_ANIM = OUT_DIR / "animated"

# Card is 240×336 in CSS px.
CARD_W, CARD_H = 240, 336
# Static: 2048×2867 (DSF = 2048/240 ≈ 8.5333)
STATIC_DSF = 2048 / CARD_W
# Animated: 1024×1434 (DSF = 1024/240 ≈ 4.2666). Smaller frames = much
# smaller WebP file size, still crisp for in-app viewing.
ANIM_DSF = 1024 / CARD_W
# Animation: 36 frames @ 55ms = ~2 sec loop
ANIM_FRAMES = 36
ANIM_DURATION = 55  # ms per frame
# Cursor orbit path — ellipse centered at card center.
# 25% horizontal, 15% vertical → emphasizes side-to-side shimmer
ORBIT_RX = 25
ORBIT_RY = 15

def tasks(filter_only):
    out = []
    for yid, name, kanji in YOKAI:
        for tier in TIERS:
            key = f"{yid}_{tier}"
            if filter_only and filter_only != key:
                continue
            out.append((yid, name, kanji, tier, key))
    return out

async def open_render_page(ctx, dsf):
    page = await ctx.new_page()
    return page

async def render_static(page, yid, name, kanji, tier, src, out_path):
    art_uri = src.resolve().as_uri()
    url = (RENDER_HTML.as_uri()
           + f"?art={art_uri}&name={name}&kanji={kanji}"
           + f"&tier={tier}&hover=0")
    await page.goto(url)
    await page.wait_for_function(
        "window._cardReady === true && document.fonts.ready"
    )
    await page.wait_for_timeout(250)
    card = page.locator('#card')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    await card.screenshot(path=str(out_path), omit_background=True)

async def render_animated(page, yid, name, kanji, tier, src, out_path):
    """Render 36 frames along elliptical cursor orbit, encode as WebP."""
    from PIL import Image  # imported lazily

    art_uri = src.resolve().as_uri()
    url = (RENDER_HTML.as_uri()
           + f"?art={art_uri}&name={name}&kanji={kanji}"
           + f"&tier={tier}&hover=1")
    await page.goto(url)
    await page.wait_for_function(
        "window._cardReady === true && document.fonts.ready"
    )
    await page.wait_for_timeout(250)
    card = page.locator('#card')

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        frame_paths = []
        for i in range(ANIM_FRAMES):
            ang = (i / ANIM_FRAMES) * 2 * math.pi
            mx = 50 + ORBIT_RX * math.sin(ang)
            my = 50 + ORBIT_RY * math.cos(ang)
            # Streak parallax: same formula as demo's mousemove handler
            sx = (mx - 50) * 1.5
            sy = (my - 50) * 0.8
            await page.evaluate(f"""(() => {{
                const c = document.getElementById('card');
                c.style.setProperty('--mx', '{mx:.2f}%');
                c.style.setProperty('--my', '{my:.2f}%');
                c.style.setProperty('--ang', '{(mx*3.6):.2f}deg');
                const s = c.querySelector('.layer-aurora-streak');
                if (s) s.style.backgroundPosition =
                       '{sx:.2f}% {sy:.2f}%';
            }})()""")
            # Tiny wait so paint settles after CSS var change
            await page.wait_for_timeout(20)
            fp = tmp / f"frame_{i:03d}.png"
            await card.screenshot(path=str(fp), omit_background=True)
            frame_paths.append(fp)

        # Encode animated WebP via Pillow
        frames = [Image.open(p) for p in frame_paths]
        out_path.parent.mkdir(parents=True, exist_ok=True)
        frames[0].save(
            out_path,
            format='WEBP',
            save_all=True,
            append_images=frames[1:],
            duration=ANIM_DURATION,
            loop=0,
            quality=85,
            method=6,
        )
        # Pillow keeps file handles open; close them
        for f in frames:
            f.close()

def build_gallery(static_done, anim_done):
    rows = []
    for yid, name, kanji in YOKAI:
        cells = []
        for tier in TIERS:
            key = f"{yid}_{tier}"
            static_path = f"static/{yid}_{tier}.png"
            anim_path = f"animated/{yid}_{tier}.webp"
            has_static = key in static_done
            has_anim = key in anim_done
            img = (f'<img src="{anim_path}" alt="{key}">'
                   if has_anim else
                   f'<img src="{static_path}" alt="{key}">'
                   if has_static else
                   f'<div class="missing">missing</div>')
            cells.append(f"""
<div class="cell">
  <div class="card-wrap">{img}</div>
  <div class="caption">
    <span class="tier {tier}">{tier.upper()}</span>
    <span class="state">{'static+anim' if has_anim else 'static' if has_static else '—'}</span>
  </div>
</div>""")
        rows.append(f"""
<section class="yokai">
  <h2>{name} <span class="kanji">{kanji}</span></h2>
  <div class="row">{"".join(cells)}</div>
</section>""")

    s_count = len(static_done)
    a_count = len(anim_done)
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Kami Merge — NFT Gallery</title>
<style>
body {{ background:#0f0f1e; color:#f5e6c8;
       font-family:ui-monospace,monospace; margin:0; padding:32px 24px; }}
h1 {{ color:#c8a04c; letter-spacing:6px; font-weight:300;
      text-align:center; margin:0 0 4px; }}
.subtitle {{ text-align:center; opacity:0.6; font-size:12px;
             margin-bottom:48px; letter-spacing:1.5px; }}
.yokai {{ margin-bottom:48px; }}
.yokai h2 {{ color:#c8a04c; font-size:16px; letter-spacing:3px;
             margin:0 0 16px; padding-bottom:8px;
             border-bottom:1px solid rgba(200,160,76,0.2); }}
.yokai .kanji {{ font-size:18px; margin-left:12px; opacity:0.8;
                 font-family:'Hiragino Mincho ProN', serif; }}
.row {{ display:grid; grid-template-columns:repeat(4, 1fr);
        gap:16px; max-width:1100px; margin:0 auto; }}
.cell {{ display:flex; flex-direction:column;
         align-items:center; gap:8px; }}
.card-wrap {{ width:100%; aspect-ratio: 5/7;
              background:repeating-conic-gradient(
                #1a1a2e 0% 25%, #0f0f1e 0% 50%) 50% 50% / 16px 16px;
              border-radius:8px; overflow:hidden;
              display:flex; align-items:center; justify-content:center; }}
.card-wrap img {{ width:100%; height:100%; object-fit:contain;
                  display:block; }}
.missing {{ color:rgba(245,230,200,0.3); font-size:10px;
            letter-spacing:2px; }}
.caption {{ display:flex; gap:8px; font-size:9px;
            letter-spacing:1.5px; }}
.tier {{ padding:2px 6px; border-radius:3px; font-weight:600; }}
.tier.common    {{ color:rgb(180,150,90); border:1px solid rgba(180,150,90,0.4); }}
.tier.rare      {{ color:rgb(210,175,105); border:1px solid rgba(210,175,105,0.4); }}
.tier.epic      {{ color:rgb(235,195,110); border:1px solid rgba(235,195,110,0.4); }}
.tier.legendary {{ color:rgb(255,218,110); border:1px solid rgba(255,218,110,0.5); }}
.state {{ color:rgba(245,230,200,0.4); }}
</style></head>
<body>
<h1>KAMI MERGE — NFT GALLERY</h1>
<div class="subtitle">{s_count}/44 static · {a_count}/44 animated · checkerboard background shows transparent corners</div>
{"".join(rows)}
</body></html>"""
    out = OUT_DIR / "gallery.html"
    out.write_text(html)
    return out

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--static-only', action='store_true')
    ap.add_argument('--animated-only', action='store_true')
    ap.add_argument('--only', help='filter to <yokai>_<tier>')
    ap.add_argument('--gallery-only', action='store_true')
    args = ap.parse_args()

    if not RENDER_HTML.exists():
        print(f"✗ Missing {RENDER_HTML}", file=sys.stderr); sys.exit(1)

    do_static = not args.animated_only
    do_anim = not args.static_only

    if args.gallery_only:
        do_static = do_anim = False

    work = tasks(args.only)
    if args.only and not work:
        print(f"✗ Filter '{args.only}' matched no tasks", file=sys.stderr)
        sys.exit(1)

    static_done = set()
    anim_done = set()

    if do_static or do_anim:
        async with async_playwright() as p:
            browser = await p.chromium.launch()

            if do_static:
                print(f"\n=== STATIC ({len(work)} cards) ===")
                ctx_s = await browser.new_context(
                    viewport={"width": CARD_W, "height": CARD_H},
                    device_scale_factor=STATIC_DSF,
                )
                page_s = await ctx_s.new_page()
                for i, (yid, name, kanji, tier, key) in enumerate(work, 1):
                    src = SRC_DIR / yid / f"{yid}_{tier}.png"
                    if not src.exists():
                        print(f"  [{i}/{len(work)}] ✗ {key}: source missing")
                        continue
                    out = OUT_STATIC / f"{yid}_{tier}.png"
                    await render_static(page_s, yid, name, kanji,
                                        tier, src, out)
                    sz = out.stat().st_size // 1024
                    print(f"  [{i}/{len(work)}] ✓ {key} ({sz} KB)")
                    static_done.add(key)
                await ctx_s.close()

            if do_anim:
                print(f"\n=== ANIMATED ({len(work)} cards × {ANIM_FRAMES}f) ===")
                ctx_a = await browser.new_context(
                    viewport={"width": CARD_W, "height": CARD_H},
                    device_scale_factor=ANIM_DSF,
                )
                page_a = await ctx_a.new_page()
                for i, (yid, name, kanji, tier, key) in enumerate(work, 1):
                    src = SRC_DIR / yid / f"{yid}_{tier}.png"
                    if not src.exists():
                        print(f"  [{i}/{len(work)}] ✗ {key}: source missing")
                        continue
                    out = OUT_ANIM / f"{yid}_{tier}.webp"
                    await render_animated(page_a, yid, name, kanji,
                                          tier, src, out)
                    sz = out.stat().st_size // 1024
                    print(f"  [{i}/{len(work)}] ✓ {key} ({sz} KB)")
                    anim_done.add(key)
                await ctx_a.close()

            await browser.close()

    # Reflect existing files in static_done/anim_done for gallery
    if OUT_STATIC.exists():
        for f in OUT_STATIC.glob("*.png"):
            static_done.add(f.stem)
    if OUT_ANIM.exists():
        for f in OUT_ANIM.glob("*.webp"):
            anim_done.add(f.stem)

    g = build_gallery(static_done, anim_done)
    print(f"\nGallery: open {g.resolve()}")
    print(f"Done: {len(static_done)}/44 static · {len(anim_done)}/44 animated")

if __name__ == "__main__":
    asyncio.run(main())
