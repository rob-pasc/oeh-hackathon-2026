"""Renders the scanner icon ("l." monogram, feature 001 FR-014) to icon-*.png.

Optional tool: the PNGs and the generated .syso are committed, so builds need neither Python nor
Pillow. Run it only to change the icon, then regenerate the .syso (see scanner/README.md).
Usage: python3 make_icon.py   (needs Pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
FONT = HERE / "../../../internal/ui/fonts/Inter-ExtraBold.ttf"
INK, LEAF, TILE = "#1f2933", "#2f7d4f", "#e6f2ea"  # web/src/index.css: ink, leaf, leaf-tint
SIZES = [16, 24, 32, 48, 64, 128, 256]
M = 1024  # master size; each icon size is downscaled from it


def master() -> Image.Image:
    img = Image.new("RGBA", (M, M), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, M - 1, M - 1], radius=int(M * 0.22), fill=TILE)
    font = ImageFont.truetype(str(FONT), int(M * 0.98))
    # The "l" sits left of centre so that the "l" and the dot together are centred.
    l_box = d.textbbox((0, 0), "l", font=font)
    l_w, l_h = l_box[2] - l_box[0], l_box[3] - l_box[1]
    dot = int(M * 0.20)
    gap = int(M * 0.05)
    x = (M - (l_w + gap + dot)) // 2 - l_box[0]
    y = (M - l_h) // 2 - l_box[1]
    d.text((x, y), "l", font=font, fill=INK)
    baseline = y + l_box[3]
    dx = x + l_box[2] + gap
    d.ellipse([dx, baseline - dot, dx + dot, baseline], fill=LEAF)
    return img


if __name__ == "__main__":
    big = master()
    for s in SIZES:
        big.resize((s, s), Image.LANCZOS).save(HERE / f"icon-{s}.png")
