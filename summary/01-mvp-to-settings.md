# nonbiri-bird 実装サマリ（MVP〜設定UI〜堅牢化）

最終更新: 2026-06-29

`research/01-survey.md` の推奨スタック（素の JS + content script / MV3）に沿って、
癒し系の鳥常駐拡張を実装した記録なのだ。全 Issue 完了時点の概要を残す。

## 完了した Issue / PR

| Issue | 内容 | PR |
|---|---|---|
| #2 | MVP: 1羽がのんびり横切る最小拡張 | #3 |
| #7 | 見た目刷新: ドット絵・白基調・上空のみ・1〜10羽群れ・速度緩急 | #8 |
| #9 | スプライト基盤刷新（多色パレット） | **won't-do**（見た目据え置き確定でクローズ） |
| #5 | リファクタ＋テスト（ロジック分離 / TDD） | #10 |
| #4 | 設定UI(popup): 数・頻度・サイト除外 | #11 |
| #6 | 省電力・堅牢化（背景タブ抑制 / 保険タイマー / cloneNode） | #12 |

## アーキテクチャ

```
manifest.json … MV3。content_scripts[ src/logic.js, src/content.js ]、action.default_popup、
                permissions[ storage, activeTab ]
src/logic.js  … DOM 非依存の純粋ロジック。乱数は rng 引数で DI 可能。
                globalThis と module.exports に両対応公開（ブラウザ/Node 共用）。
                設定スキーマの単一情報源（DEFAULTS / MAX_BIRDS / clampMaxBirds）。
src/content.js… Shadow DOM オーバーレイ生成、鳥の spawn/飛行/羽ばたき、群れ維持、
                設定反映(onChanged)、背景タブ pause/resume。計算は logic.js に委譲。
popup.html/js … 設定UI。logic.js を先読みしてスキーマ共有。storage.sync に保存。
test/logic.test.js … node:test（依存ゼロ）。固定 rng で決定的に検証（19 ケース）。
package.json  … test=node --test, check=node --check。
```

## レイヤー境界（信頼してよい範囲）

- **logic.js は純粋関数のみ**。副作用なし＝テストが効いている。挙動を確かめたい計算はここを見る。
- **content.js は DOM・タイマー・WAAPI の副作用担当**。テスト外なので変更時は手動確認 + reviewer。
- **設定スキーマは logic.js の DEFAULTS が唯一の真実**。popup/content は参照するだけ。増減は logic.js を直す。

## 設計上のキモ

- **乱数 DI**: `rand/randInt/pick` 等は `rng` 引数を取り、本番は `Math.random`、テストは固定値。
- **バンドラ不要の共有**: logic.js を content_scripts と popup.html の両方で先読みし `globalThis.NonbiriLogic` を共有。
- **設定リアルタイム反映**: `chrome.storage.onChanged` で全体を読み直して `applySettings`。OFF/除外で飛行中の鳥も撤去。
- **省電力/堅牢化**: 鳥は `{cleanup, pause, resume}` コントローラ化。hidden で一括 pause、保険タイマーは残りアニメ時間ベースで貼り直し、`cleanup` は冪等。

## 既知の保留・今後

- **鳥の種類追加**: 現状 1 種。複数種を増やす時は #9 の文字グリッド方式を再検討（popup に種類UIを追加）。
- **配布**: Chrome Web Store / Edge Add-ons への申請は未実施（survey 2-7 参照）。アイコン素材も未用意。
- **飛行中リサイズの厳密追従**: 任意項目。現状は新規 spawn が live 値を読むことで実用上は追従。
