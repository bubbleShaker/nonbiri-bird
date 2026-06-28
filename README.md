# nonbiri-bird

鳥がブラウザ内をランダムに、のんびりと、たまーに飛ぶ癒し系の常駐拡張（Chrome / Edge, Manifest V3）。

## 現状（v0.1.0 / MVP）

全ページに 1 羽の鳥がオーバーレイされ、ランダムな間隔で画面をのんびり横切る。
クリックは透過するのでページ操作の邪魔にはならない。

## ローカルでの読み込み方法

### Chrome
1. `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」を押し、このフォルダ（`nonbiri-bird/`）を選ぶ
4. 任意のページを開くと、数秒後に鳥が飛び始める

### Edge
1. `edge://extensions` を開く
2. 左下の「開発者モード」をオンにする
3. 「展開して読み込み」を押し、このフォルダを選ぶ

## 構成

| ファイル | 役割 |
|---|---|
| `manifest.json` | MV3 マニフェスト（content script を全ページに注入） |
| `src/content.js` | Shadow DOM オーバーレイ生成・鳥の飛行ロジック |

## ロードマップ

- 設定 UI（popup）で 鳥の種類・数・頻度 を調整
- 複数羽の同時飛行
- ドット絵スプライトによる鳥の種類追加
- Chrome Web Store / Edge Add-ons への配布

技術調査の詳細は [`research/01-survey.md`](research/01-survey.md) を参照。
