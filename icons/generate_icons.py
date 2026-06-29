#!/usr/bin/env python3
"""nonbiri-bird の拡張アイコンを生成する。

設計メモ:
- 拡張一覧 / ツールバー用に 16/32/48/128px の PNG を出力する。
- ページを実際に飛ぶ鳥（src/content.js の FRAMES）と同じドット絵を使う。
  黒背景の中央に、白いカモメ型のドット絵を置く。
- 飛んでいる鳥は `shape-rendering="crispEdges"` でカクッとしたドット質感なので、
  アイコンも LANCZOS 等で滑らかにせず、1 セル=整数ピクセルの矩形で敷いて
  ドットのエッジを保つ（ニアレストネイバー相当）。
- 図形で描くので再生成可能。SVG ラスタライザは不要。

準備: pip install -r icons/requirements.txt   （Pillow==12.2.0 をピン）
実行: python icons/generate_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parent
SIZES = [16, 32, 48, 128]

# --- ドット絵の鳥（7×4・カモメ型）---
# 出所: src/content.js の GRID_W/GRID_H/FRAMES と同一。乖離させないこと。
# 形を変える時は content.js と本ファイルの両方を揃える。
GRID_W = 7
GRID_H = 4
FRAMES = [
    # 0: 翼を上げた姿（V 字）
    [[0, 0], [6, 0], [1, 1], [5, 1], [2, 2], [4, 2], [3, 3]],
    # 1: 翼を水平に広げた中間姿（M 字）
    [[0, 1], [1, 1], [5, 1], [6, 1], [2, 2], [3, 2], [4, 2]],
    # 2: 翼を下げた姿
    [[3, 0], [2, 1], [4, 1], [1, 2], [5, 2], [0, 3], [6, 3]],
]
FRAME_INDEX = 0   # アイコンに固定するポーズ（0=翼を上げた姿）
FILL = 0.8        # 鳥がアイコン一辺に占める目安比率（余白を残す）

BG = (0, 0, 0, 255)        # 黒背景
DOT = (255, 255, 255, 255)  # 白いドット（飛行中の鳥と同じ #ffffff）


def draw_icon(px: int) -> Image.Image:
    """1 枚分の正方形アイコンを px×px で返す（黒地・中央に白い鳥）。"""
    img = Image.new("RGBA", (px, px), BG)
    d = ImageDraw.Draw(img)

    # 1 セルの大きさを整数ピクセルにしてドットのカクカクを保つ。
    # 横 7 セルが一辺の FILL に収まるように決め、最低 1px は確保する。
    cell = max(1, round(px * FILL / GRID_W))
    bird_w = cell * GRID_W
    bird_h = cell * GRID_H
    # 中央寄せのオフセット。
    ox = (px - bird_w) // 2
    oy = (px - bird_h) // 2

    for gx, gy in FRAMES[FRAME_INDEX]:
        x0 = ox + gx * cell
        y0 = oy + gy * cell
        # rectangle は終点を含むので -1 する（セルがにじまず隣と接しない）。
        d.rectangle([x0, y0, x0 + cell - 1, y0 + cell - 1], fill=DOT)

    return img


def main():
    for px in SIZES:
        img = draw_icon(px)
        out = OUT_DIR / f"icon{px}.png"
        img.save(out)
        print(f"wrote {out.name} ({px}x{px})")


if __name__ == "__main__":
    main()
