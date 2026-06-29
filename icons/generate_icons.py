#!/usr/bin/env python3
"""nonbiri-bird の拡張アイコンを生成する。

設計メモ:
- 拡張一覧 / ツールバー用に 16/32/48/128px の PNG を出力する。
- 世界観（クリーム背景・白い鳥）に合わせ、丸角クリーム地に白い鳥を描く。
- 小さいサイズでも輪郭が潰れないよう、各サイズを 4 倍解像度で描いてから
  LANCZOS で縮小する（スーパーサンプリングでアンチエイリアス）。
- ベクタ的に図形で描くので再生成可能。SVG ラスタライザは不要。

準備: pip install -r icons/requirements.txt   （Pillow==12.2.0 をピン）
実行: python icons/generate_icons.py

注意: 描画 API（rounded_rectangle / polygon の width / LANCZOS 縮小）は Pillow の
      バージョン差で結果が微妙に変わりうるため、再生成時は上記バージョンを使うのだ。
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parent
SIZES = [16, 32, 48, 128]
SS = 4  # スーパーサンプリング倍率

# パレット（popup の :root と揃える）
CREAM = (247, 243, 234, 255)   # #f7f3ea 背景
LINE = (216, 208, 191, 255)    # #d8d0bf 背景の縁
BIRD = (255, 255, 255, 255)    # 白い鳥本体
BIRD_EDGE = (140, 130, 112, 255)  # クリーム上で鳥を視認させるグレー輪郭（小サイズ用に濃いめ）
BEAK = (230, 160, 90, 255)     # くちばし（差し色）
EYE = (70, 60, 50, 255)        # 目


def draw_icon(px: int) -> Image.Image:
    """1 枚分の正方形アイコンを px×px で返す。"""
    s = px * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # --- 丸角クリーム背景 ---
    pad = s * 0.02
    radius = s * 0.20
    d.rounded_rectangle(
        [pad, pad, s - pad, s - pad],
        radius=radius,
        fill=CREAM,
        outline=LINE,
        width=max(1, int(s * 0.015)),
    )

    # 以降は 0..1 の相対座標 -> ピクセルに変換して描く。
    def P(x, y):
        return (x * s, y * s)

    ew = max(1, int(s * 0.03))  # 鳥の輪郭の太さ（小サイズで効くよう太め）

    # --- 胴体（ふっくら楕円・大きめに配置）---
    body = [P(0.28, 0.40), P(0.74, 0.80)]
    d.ellipse([*body[0], *body[1]], fill=BIRD, outline=BIRD_EDGE, width=ew)

    # --- 頭（胴体の右上に円）---
    head_c = P(0.66, 0.36)
    hr = s * 0.155
    d.ellipse(
        [head_c[0] - hr, head_c[1] - hr, head_c[0] + hr, head_c[1] + hr],
        fill=BIRD, outline=BIRD_EDGE, width=ew,
    )

    # --- 翼（胴体上にひと刷きの三角）---
    wing = [P(0.36, 0.50), P(0.60, 0.46), P(0.44, 0.70)]
    d.polygon(wing, fill=(238, 233, 222, 255), outline=BIRD_EDGE)

    # --- 尾（左へ跳ねる三角）---
    tail = [P(0.30, 0.52), P(0.14, 0.44), P(0.30, 0.66)]
    d.polygon(tail, fill=BIRD, outline=BIRD_EDGE)

    # --- くちばし（頭の右） ---
    beak = [P(0.80, 0.34), P(0.94, 0.38), P(0.80, 0.42)]
    d.polygon(beak, fill=BEAK)

    # --- 目 ---
    er = max(1.0, s * 0.022)
    eye_c = P(0.70, 0.33)
    d.ellipse([eye_c[0] - er, eye_c[1] - er, eye_c[0] + er, eye_c[1] + er], fill=EYE)

    # 縮小してアンチエイリアス。
    return img.resize((px, px), Image.LANCZOS)


def main():
    for px in SIZES:
        img = draw_icon(px)
        out = OUT_DIR / f"icon{px}.png"
        img.save(out)
        print(f"wrote {out.name} ({px}x{px})")


if __name__ == "__main__":
    main()
