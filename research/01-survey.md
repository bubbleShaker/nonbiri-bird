# nonbiri-bird 技術調査レポート

調査日: 2026-06-28  
調査者: Claude Sonnet 4.6（調査サブエージェント）

---

## 1. 既存類似拡張・サービスの調査

### 1-1. 類似拡張一覧

| 拡張名 | ストア | 特徴 | ユーザー数 | 評価 |
|---|---|---|---|---|
| **Pocket Bird** | Chrome Web Store | ピクセルアートの鳥がページ上を跳ね回る。25種以上の鳥をアンロック可能 | 2,000人 | ★4.7 |
| **Annoying Bird** | Chrome Web Store | ランダムな要素に止まり、近づくと飛び去る。on/off 切替のみ | 1,000人以上 | ★4.3 |
| **Oneko Cursor Cat** | Chrome Web Store | カーソルを追いかける猫（鳥ではないが最重要参考実装） | 多数 | ★高評価 |
| **Oneko Neko** | Chrome Web Store | 上記の別バリエーション | - | - |
| **Nova Browser Pet** | GitHub のみ | ピクセルアートのペットがページ下部に常駐。全タブ同期機能つき | - | - |
| **browser-pet (cat)** | GitHub のみ | browsing 内容に反応する猫。iframe 注入方式 | - | - |

#### 出典
- Pocket Bird: https://chromewebstore.google.com/detail/pocket-bird/lbbdngkbbgaecefacpnhnhleggabghak
- Annoying Bird: https://chromewebstore.google.com/detail/annoying-bird/jolffkggineilgaelplggdcdkfhooemc
- Oneko Cursor Cat: https://chromewebstore.google.com/detail/oneko-cursor-cat/oeafoeglbngjpkilblpdiohfbhdkdeno
- Nova Browser Pet: https://github.com/ihummingbird/nova-browser-pet
- Pocket Bird GitHub: https://github.com/IdreesInc/Pocket-Bird

---

### 1-2. 差別化ポイント

**Pocket Bird との差異:**

- Pocket Bird は「跳ね回る（hops around）」動き。**空中を飛ぶ経路アニメーションではない**。
- ゲーミフィケーション要素（羽の収集・帽子）が目的の中心。nonbiri-bird はあくまで「癒し演出」が目的で、インタラクション要素は不要。
- Pocket Bird は種類・数・頻度を**設定 UI で細かく調整する機能を持たない**（種類選択はあるが数・頻度はない）。

**Annoying Bird との差異:**

- Annoying Bird は「うるさい（annoying）」コンセプト。のんびり系は現状ほぼ空白。
- 設定項目がほぼない（on/off のみ）。

**Oneko（猫）との差異:**

- oneko はカーソル追従型で「インタラクティブ」。鳥が**自律的にのんびり飛ぶ**という受動的演出系は未開拓に近い。

**結論:** 「空中を自律的にのんびり飛ぶ」「種類・数・頻度を細かく設定できる」拡張は**現状ほぼ存在しない**。差別化余地は大きい。

---

## 2. 技術選定（Manifest V3 前提）

### 2-1. oneko.js が示す最小実装パターン

oneko.js（作者: adryd325）は「カーソルを追う猫」の有名な参考実装で、Chrome 拡張のペット系実装の事実上の標準テンプレートとなっている。

**技術手法:**

- `<div>` を `position: fixed` で生成し、`pointer-events: none` でクリックを透過。`z-index` を最大値に設定。
- スプライトシート（gif/png）を背景画像に設定し、`backgroundPosition` を JavaScript で操作することでフレームを切り替える。CSS アニメーションは**使わず**、JS で直接制御。
- `requestAnimationFrame()` で 60fps ループを回す。100ms 経過チェックでフレームスキップを防止。
- 各アニメーション状態（8方向移動・待機・スクラッチ等）の座標を `spriteSets` オブジェクトで管理。
- `localStorage` で位置状態を永続化。

出典: https://github.com/adryd325/oneko.js  
解説: https://www.cssscript.com/cat-follow-cursor-oneko/

---

### 2-2. Content Script によるオーバーレイ方式

MV3 での全ページ注入の標準パターン:

```json
// manifest.json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["content.js"],
  "css": ["content.css"],
  "run_at": "document_idle"
}]
```

**ページとの干渉を防ぐベストプラクティス（3 段構え）:**

1. **`position: fixed`** — ページスクロールに追従しない
2. **`pointer-events: none`** — ページの操作を阻害しない
3. **Shadow DOM（`attachShadow({mode:'open'})`）** — ホストページの CSS が拡張の要素に干渉しない。`all: initial` と組み合わせてリセット。

Shadow DOM は Pocket Bird・Nova Browser Pet ともに採用している方式で、ページの CSS リセットや高 z-index 上書きを受けない点で信頼性が高い。

出典:
- https://dev.to/learcise_health/what-is-shadow-dom-and-how-its-used-in-chrome-extensions-5e7e
- https://dev.to/developertom01/solving-css-and-javascript-interference-in-chrome-extensions-a-guide-to-react-shadow-dom-and-best-practices-9l
- https://apitman.com/3/

---

### 2-3. アニメーション描画手法の比較

| 手法 | 長所 | 短所 | 「のんびり数羽」への適合 |
|---|---|---|---|
| **DOM + CSS `transform` / `backgroundPosition`（JS制御）** | Shadow DOM と自然に統合。個別要素（鳥1羽 = div 1個）で管理が容易。GPU アクセラレーション対象（transform は合成レイヤー）。oneko.js が実証済み | 鳥が数十羽以上になると DOM 数が増える | **◎ 最適** |
| **Canvas** | 多数オブジェクトの一括描画に強い。ゲーム向き | Shadow DOM との統合やイベント処理が複雑。数羽程度では過剰 | △ |
| **SVG（インライン/`<img>`）** | ベクター形式でスケール自由。SMIL アニメーション可 | 複雑な羽ばたきアニメは CPU 負荷が増す（Brave Community 報告あり）。ピクセルアート調の質感が出にくい | △ |
| **CSS `animation` + sprite sheet（`steps()`）** | コードが簡潔。`steps()` で離散フレーム切り替えが可能 | JS からの動的制御（飛行経路、速度変更）が CSS のみでは困難 | ○（部分活用） |

**推奨:** DOM `<div>` + `backgroundPosition` JS 制御（oneko.js パターン）をベースに、飛行経路の座標移動は `transform: translate()` で GPU 合成レイヤーに載せる。羽ばたきのフレーム切り替えは CSS `animation: steps()` と `backgroundPosition` の組み合わせ。

参考:
- requestAnimationFrame 解説: https://dev.to/martyhimmel/animating-sprite-sheets-with-javascript-ag3
- CSS steps() による sprite: https://dev.to/polluterofminds/how-to-create-a-sprite-animation-without-canvas-57cg
- GPU アクセラレーション: https://developer.chrome.com/blog/hardware-accelerated-animations
- pixel art 拡大: `image-rendering: pixelated`（Chrome）/ `crisp-edges`（Firefox）で補間なし拡大

---

### 2-4. 鳥アセット形式

**ピクセルアートスプライトシート（PNG）を推奨する。**

- Pocket Bird は Aseprite でスプライトシートを作成し、種類別に PNG を持つ構成。
- スプライトシート 1 枚に「翼上げ・中間・翼下げ」3〜4 フレームを並べれば羽ばたきを表現できる。
- 鳥種ごとに `.png` を 1 枚用意し、manifest の `web_accessible_resources` に登録することで content script から URL 参照可能。
- SVG は「鳥らしい温もり」が出にくく、ピクセルアートのほうが「のんびり・癒し」の世界観に合う。
- `image-rendering: pixelated` でドット絵を高解像度でくっきり表示。

Nova Browser Pet の技術的特徴（参考）:
- `animation_data.js` でスプライト座標・フレームサイズ・速度を定義。
- 時間ベースのシード付き PRNG で全タブ同期（nonbiri-bird では不要だが参考になる）。

---

### 2-5. 設定 UI（鳥の種類・数・頻度）

**Popup（action popup）方式を推奨:**

```
manifest.json に action.default_popup を定義
→ ツールバーアイコンクリックで設定画面を表示
→ chrome.storage.sync で設定を保存・content script と共有
```

- 種類: チェックボックス or カード選択 UI
- 数: スライダー（1〜5羽）
- 頻度（次の鳥が飛ぶまでのインターバル）: スライダー（低・中・高）
- 拡張機能の on/off: popup 内のトグル

`chrome.storage.sync` を使うことで設定がデバイス間で同期される。`chrome.runtime.onMessage` / `sendMessage` で popup からの設定変更をリアルタイムで content script に反映可能。

---

### 2-6. ビルドツール選定

#### 案 A: 素の JS（バニラ）+ content script（最小構成）

- **長所:** 依存なし・即スタート可能・oneko.js パターンそのまま流用できる。拡張固有のビルドツールの複雑さがない。
- **短所:** TypeScript の型補完なし。ファイルが増えるとモジュール管理がやや煩雑。HMR なし（手動リロード）。

#### 案 B: Vite + CRXJS + TypeScript

- **長所:** HMR で即時プレビュー。TypeScript で `chrome.*` API に型補完。`manifest.json` の自動処理。Vite 8 / Rolldown 対応済み（2026-06 確認）。
- **短所:** セットアップコストが高い。ライブラリへの依存が増える。シンプルなアニメーション拡張には over-engineering の懸念。

出典:
- CRXJS: https://github.com/crxjs/chrome-extension-tools
- CRXJS 2026 解説: https://optymized.net/blog/building-chrome-extensions

---

### 2-7. ストア配布フロー

**Chrome Web Store:**

1. Google アカウントで開発者登録（**$5 一回払い**、以後最大 20 拡張まで無料）。
2. ソースを zip 圧縮してアップロード。
3. ストア掲載情報・プライバシー宣言・配布設定を記入して審査申請（Submit for Review）。
4. 審査通過後 30 日以内に公開。審査期間はアイテムの性質による（数日〜数週間）。
5. ファイルサイズ上限 2GB。

**Microsoft Edge Add-ons:**

- Microsoft アカウントで登録（登録費無料）。
- zip ファイルを提出。Chrome 版とほぼ同じ manifest が利用できる。

出典:
- Chrome 公式: https://developer.chrome.com/docs/webstore/publish
- Chrome 配布ガイド: https://bestchromeextensions.com/2025/01/17/publish-chrome-extension-web-store-2025-guide/
- Edge: https://learn.microsoft.com/en-us/microsoft-edge/extensions/

---

## 3. 推奨スタック

### 結論: **案 A（素の JS + content script）を推奨する**

#### 推奨構成の根拠

nonbiri-bird の要件は「鳥が数羽のんびり飛ぶ」という非常にシンプルな演出である。oneko.js がカーソル追従猫を 300 行程度の素 JS で実現しているように、この用途では**最小構成が最大の強み**になる。

- DOM `<div>` × N羽（Nは設定値）をコンテナとして用意し、Shadow DOM で隔離
- スプライトシート PNG（鳥種ごと）で羽ばたきを `backgroundPosition` 切り替え
- 飛行経路は JS で制御した `transform: translate()` でスムーズに移動
- `requestAnimationFrame` ループで全体を管理
- 設定（種類・数・頻度）は `chrome.storage.sync` + popup HTML で実現

#### ファイル構成イメージ

```
nonbiri-bird/
├── manifest.json         # MV3。content_scripts, action, web_accessible_resources
├── content.js            # 鳥の生成・飛行ロジック・Shadow DOM 構築
├── content.css           # 鳥要素のベーススタイル（pointer-events: none 等）
├── popup.html            # 設定 UI
├── popup.js              # chrome.storage.sync への書き込み
├── assets/
│   └── sprites/
│       ├── sparrow.png   # スズメ（デフォルト）
│       ├── swallow.png   # ツバメ
│       └── ...
└── icons/
    └── icon128.png
```

#### Vite + CRXJS を選ぶべきケース

設定 UI を React/Vue コンポーネントで作りたい場合、または TypeScript による型安全が必要になった場合に後から移行する。初期段階では不要。

---

## 4. 注意点・未確認事項

- **Pocket Bird のアニメーション内部実装（content script のコード）は未確認。** GitHub ソース（src/ 以下）を直接読めば sprite 座標管理の実例が得られるはず。
- CRXJS は活発にメンテされているが、Vite 8 対応は 2026-06 時点の情報のため、実際に使う時点でのバージョン確認が必要。
- Chrome Web Store 審査期間は「アイテムの性質による」と公式が述べており、具体的日数は不明。初回は数週間を見込む。
- Edge Add-ons の登録費が本当に無料かは公式ドキュメントで確認推奨（検索結果では無料と記載）。
- MV2 は 2025-06 に Google が非推奨化済み。**MV3 前提で設計すること**（Chrome Web Store への新規提出は MV3 のみ受理）。

---

## 5. 参照まとめ

| 項目 | URL |
|---|---|
| oneko.js（参考実装） | https://github.com/adryd325/oneko.js |
| Pocket Bird（最類似拡張） | https://chromewebstore.google.com/detail/pocket-bird/lbbdngkbbgaecefacpnhnhleggabghak |
| Pocket Bird GitHub | https://github.com/IdreesInc/Pocket-Bird |
| Annoying Bird | https://chromewebstore.google.com/detail/annoying-bird/jolffkggineilgaelplggdcdkfhooemc |
| Nova Browser Pet | https://github.com/ihummingbird/nova-browser-pet |
| Shadow DOM 解説 | https://dev.to/learcise_health/what-is-shadow-dom-and-how-its-used-in-chrome-extensions-5e7e |
| Sprite sheet JS アニメ | https://dev.to/martyhimmel/animating-sprite-sheets-with-javascript-ag3 |
| CRXJS | https://github.com/crxjs/chrome-extension-tools |
| Chrome Web Store 公開 | https://developer.chrome.com/docs/webstore/publish |
| GPU アクセラレーション | https://developer.chrome.com/blog/hardware-accelerated-animations |
