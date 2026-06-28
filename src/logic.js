// nonbiri-bird — DOM 非依存の純粋ロジック
//
// 設計メモ:
// - ここには「計算」だけを置き、DOM 生成・タイマー登録は content.js 側に残す。
//   こうすると Node 上の `node:test` で副作用なくユニットテストできる。
// - 乱数は引数 `rng`（[0,1) を返す関数）で注入する（依存性注入 / DI）。
//   テストでは固定値を返す rng を渡して結果を決定的に検証できる。本番は Math.random。
// - ファイル末尾で globalThis と module.exports の両方へ公開し、
//   ブラウザ（content script）と Node（テスト）の双方から使えるようにする。
(() => {
  "use strict";

  // --- 乱数ユーティリティ（rng 注入可能） ---
  const rand = (min, max, rng = Math.random) => min + rng() * (max - min);
  const randInt = (min, max, rng = Math.random) =>
    Math.floor(rand(min, max + 1, rng));
  const pick = (arr, rng = Math.random) =>
    arr[Math.floor(rng() * arr.length)];

  // --- 奥行き感の計算 ---
  // size を 0(遠)〜1(近) に正規化。min==max の 0 除算は 0 を返して保護する。
  const computeDepth = (size, minSize, maxSize) => {
    const span = maxSize - minSize;
    if (span <= 0) return 0;
    const d = (size - minSize) / span;
    return d < 0 ? 0 : d > 1 ? 1 : d; // 0〜1 にクランプ
  };
  // 近い鳥ほど不透明（0.6〜1.0）。
  const computeOpacity = (depth) => 0.6 + depth * 0.4;

  // 横断所要時間: 遠い(小さい)鳥ほど長め=遅い。base にランダム＋奥行きバイアス。
  const computeDuration = (depth, minFlightMs, maxFlightMs, rng = Math.random) => {
    const speedBias = 0.6 + (1 - depth) * 0.8; // 遠いほど大きい=遅い
    return rand(minFlightMs, maxFlightMs, rng) * speedBias;
  };

  // --- 入退場のジオメトリ（画面外→画面外）---
  // 左右どちらから入るかを決め、開始/終了 X・進行方向・基準Y・上下ゆらぎ幅を返す。
  const entryGeometry = ({ vw, vh, w, config, rng = Math.random }) => {
    const leftToRight = rng() < 0.5;
    return {
      startX: leftToRight ? -w : vw + w,
      endX: leftToRight ? vw + w : -w,
      dir: leftToRight ? 1 : -1, // 右行き=1 / 左行き=-1（左行きは scaleX(-1) で反転）
      baseY: rand(vh * config.skyTop, vh * config.skyBottom, rng),
      wander: rand(8, 26, rng),
    };
  };

  // --- 飛行 keyframe 生成（transform 文字列の配列）---
  // x は startX→endX を等間隔に、y は sin で 1 周期ぶん上下させる。
  const buildKeyframes = ({ startX, endX, baseY, wander, dir, steps = 6 }) => {
    const frames = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = startX + (endX - startX) * t;
      const y = baseY + Math.sin(t * Math.PI * 2) * wander;
      frames.push({ transform: `translate(${x}px, ${y}px) scaleX(${dir})` });
    }
    return frames;
  };

  // --- スケジューラの待機時間計算 ---
  // 飛ばせる時は短い間隔、飛ばせない時（動き抑制/非表示タブ）は長くして wakeup を減らす。
  const nextTickDelay = (canFly, rng = Math.random) =>
    canFly ? rand(800, 3500, rng) : 8000;
  // 目標数の振り直し間隔。
  const rerollDelay = (config, rng = Math.random) =>
    rand(config.rerollMinMs, config.rerollMaxMs, rng);

  // 今このフレームで 1 羽湧かせるか（目標未達 かつ 確率 0.75 のゲート）。
  const shouldSpawn = (activeCount, target, canFly, rng = Math.random) =>
    canFly && activeCount < target && rng() < 0.75;

  const api = {
    rand,
    randInt,
    pick,
    computeDepth,
    computeOpacity,
    computeDuration,
    entryGeometry,
    buildKeyframes,
    nextTickDelay,
    rerollDelay,
    shouldSpawn,
  };

  // ブラウザ（content script の隔離ワールド）へ公開。
  if (typeof globalThis !== "undefined") globalThis.NonbiriLogic = api;
  // Node（テスト）へ公開。
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
