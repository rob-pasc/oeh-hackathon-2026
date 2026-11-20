"""Renders the scanner icon (the web app's leaf favicon, feature 001 FR-016) to icon-*.png.

Optional tool: the PNGs and the generated .syso are committed, so builds need neither Python nor
Pillow. Run it only to change the icon, then regenerate the .syso (see scanner/README.md).
Usage: python3 make_icon.py   (needs Pillow)

The paths are those of web/public/favicon.svg (24 x 24 viewBox, stroke #2F7D4F, width 2, round
caps and joins). They are drawn here directly because no SVG renderer is assumed; keep them in
sync if the favicon changes.
"""
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).parent
LEAF = "#2f7d4f"  # favicon stroke, web/src/index.css --color-leaf
STROKE = 2.0  # in viewBox units
SIZES = [16, 24, 32, 48, 64, 128, 256]
M = 1024  # master size; each icon size is downscaled from it

# favicon.svg, with relative commands made absolute:
#   M5 19 C5 10 11 4 20 4 c0 9 -6 15 -15 15 z     (leaf outline)
#   M5 19 c3 -5 6 -8 10 -10                       (midrib)
CURVES = [
    [(5, 19), (5, 10), (11, 4), (20, 4)],
    [(20, 4), (20, 13), (14, 19), (5, 19)],
    [(5, 19), (8, 14), (11, 11), (15, 9)],
]


def bezier(p0, p1, p2, p3, steps=200):
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        yield (
            u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
        )


def master() -> Image.Image:
    img = Image.new("RGBA", (M, M), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    scale = M / 24
    r = STROKE * scale / 2
    for curve in CURVES:
        # A round-capped, round-joined stroke: a disc at every sample point along the curve.
        for x, y in bezier(*curve):
            cx, cy = x * scale, y * scale
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=LEAF)
    return img


if __name__ == "__main__":
    big = master()
    for s in SIZES:
        big.resize((s, s), Image.LANCZOS).save(HERE / f"icon-{s}.png")
