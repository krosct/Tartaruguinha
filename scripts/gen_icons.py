"""Generate PWA icons (192, 512, maskable 512) with Pillow.

Run with the project venv: `~/.venv/bin/python scripts/gen_icons.py`.
"""

from __future__ import annotations

import os

from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "icons")

BACKGROUND = (15, 118, 110)
SHELL = (45, 212, 191)
SHELL_DARK = (6, 78, 59)
HEAD = (167, 243, 208)
EYE = (6, 78, 59)


def _draw_turtle(canvas: Image.Image, size: int, pad_ratio: float) -> None:
    draw = ImageDraw.Draw(canvas)
    inner = size * (1 - 2 * pad_ratio)
    origin = size * pad_ratio

    def point(fx: float, fy: float) -> tuple[float, float]:
        return (origin + fx * inner, origin + fy * inner)

    def radius(fr: float) -> float:
        return fr * inner

    shell_cx, shell_cy = point(0.5, 0.6)
    shell_rx = radius(0.34)
    shell_ry = radius(0.26)
    draw.ellipse(
        [shell_cx - shell_rx, shell_cy - shell_ry, shell_cx + shell_rx, shell_cy + shell_ry],
        fill=SHELL,
        outline=SHELL_DARK,
        width=max(2, int(size * 0.012)),
    )

    leg_r = radius(0.09)
    for fx, fy in ((0.12, 0.5), (0.88, 0.5), (0.2, 0.92), (0.8, 0.92)):
        lx, ly = point(fx, fy)
        draw.ellipse([lx - leg_r, ly - leg_r, lx + leg_r, ly + leg_r], fill=SHELL_DARK)

    head_cx, head_cy = point(0.5, 0.17)
    head_r = radius(0.15)
    draw.ellipse(
        [head_cx - head_r, head_cy - head_r, head_cx + head_r, head_cy + head_r],
        fill=HEAD,
        outline=SHELL_DARK,
        width=max(2, int(size * 0.012)),
    )

    eye_r = radius(0.025)
    for fx in (0.44, 0.56):
        ex, ey = point(fx, 0.15)
        draw.ellipse([ex - eye_r, ey - eye_r, ex + eye_r, ey + eye_r], fill=EYE)


def generate(size: int, filename: str, maskable: bool) -> None:
    canvas = Image.new("RGB", (size, size), BACKGROUND)
    _draw_turtle(canvas, size, pad_ratio=0.28 if maskable else 0.16)
    os.makedirs(OUT_DIR, exist_ok=True)
    canvas.save(os.path.join(OUT_DIR, filename))


def main() -> None:
    generate(192, "icon-192.png", maskable=False)
    generate(512, "icon-512.png", maskable=False)
    generate(512, "icon-maskable-512.png", maskable=True)
    print(f"Icons written to {os.path.normpath(OUT_DIR)}")


if __name__ == "__main__":
    main()
