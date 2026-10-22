# -*- coding: utf-8 -*-
"""生成健康集 PNG 图标（192/512/180/maskable-512）"""
from PIL import Image, ImageDraw

TOP = (20, 184, 166)      # #14b8a6
BOTTOM = (13, 148, 136)   # #0d9488
TEAL = (13, 148, 136)


def make_icon(size):
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 渐变背景（每行一条线，快且平滑）
    for y in range(s):
        t = y / max(s - 1, 1)
        c = tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
        d.line([(0, y), (s, y)], fill=c)

    # 圆角遮罩
    mask = Image.new("L", (s, s), 0)
    md = ImageDraw.Draw(mask)
    radius = int(s * 0.22)
    md.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=255)
    img.putalpha(mask)

    # 白色爱心：两个圆 + 菱形
    cx = cy = s / 2
    r = s * 0.16
    d.ellipse((cx - r * 1.95, cy - r * 0.6, cx - r * 0.05, cy + r * 1.4), fill="white")
    d.ellipse((cx + r * 0.05, cy - r * 0.6, cx + r * 1.95, cy + r * 1.4), fill="white")
    d.polygon(
        [(cx - r * 1.95, cy + r * 0.02), (cx + r * 1.95, cy + r * 0.02), (cx, cy + r * 2.15)],
        fill="white",
    )

    # 脉搏线（青色）
    w = int(s * 0.035)
    x0, x1 = cx - r * 0.75, cx + r * 0.75
    ybase = cy + r * 0.18
    pts = [
        (x0, ybase),
        (cx - r * 0.22, ybase),
        (cx - r * 0.08, ybase - r * 0.28),
        (cx + r * 0.06, ybase + r * 0.30),
        (cx + r * 0.20, ybase - r * 0.24),
        (cx + r * 0.34, ybase),
        (x1, ybase),
    ]
    d.line(pts, fill=TEAL, width=w, joint="curve")

    return img


if __name__ == "__main__":
    for size, name in [(180, "icon-180.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
        make_icon(size).save(name)
        print("saved", name)
    make_icon(512).save("icon-maskable-512.png")
    print("saved icon-maskable-512.png")
