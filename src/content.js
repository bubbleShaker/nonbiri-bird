// nonbiri-bird — content script
// 全ページの「上空」に、白いドット絵の鳥が 1〜10 羽、のんびり緩急つけて飛ぶ。
//
// 設計メモ:
// - Shadow DOM: ホストページの CSS が拡張の要素に干渉しない隔離コンテナ。
// - ドット絵は外部PNGを使わず、SVGの 1px 矩形(<rect>)で敷き、shape-rendering="crispEdges"
//   で拡大してもカクッとしたドット質感を出す（素材ファイル不要で色・形を編集できる）。
// - 飛行は Web Animations API (element.animate): transform の translate を使うので
//   GPU 合成レイヤーに乗り軽い。easing をランダムにして1羽ごとに速度の緩急を出す。
(() => {
  "use strict";

  if (window.top !== window.self) return; // iframe では動かさない
  if (window.__nonbiriBirdLoaded) return; // 二重注入ガード
  window.__nonbiriBirdLoaded = true;

  // --- 調整パラメータ（後の Issue #4 で設定UIから変更できるようにする予定） ---
  const CONFIG = {
    minFlock: 1, // 空にいる鳥の最小目標数
    maxFlock: 10, // 同・最大目標数
    minSize: 14, // 鳥の見た目の横幅(px)。小さい=遠い
    maxSize: 30, // 同・最大。大きい=近い
    minFlightMs: 7000, // 横断の最短時間（速い）
    maxFlightMs: 26000, // 横断の最長時間（のんびり）
    skyTop: 0.02, // 飛行域の上端（画面高さ比）
    skyBottom: 0.3, // 飛行域の下端（上部30%まで＝作業の邪魔をしない）
    rerollMinMs: 25000, // 目標数を振り直す間隔（空模様が変わる）
    rerollMaxMs: 60000,
  };

  // DOM 非依存の計算は logic.js（manifest で content.js より先に読み込む）に集約。
  const L = globalThis.NonbiriLogic;
  // 読み込み順崩れ/ロード失敗の保険: 未定義なら無言の TypeError で死なず静かに撤退する。
  if (!L) {
    console.warn("[nonbiri-bird] logic.js が読み込まれていないため起動を中止したのだ");
    return;
  }
  const { rand } = L; // 羽ばたき周期などローカルで使う乱数だけ取り出す

  // 動きに敏感なユーザーへの配慮: 「視差効果を減らす」設定のときは飛ばさない。
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // --- ドット絵の鳥（7×4・遠景カモメ型）。座標は [x, y]（0始まり）。 ---
  // 注意: 以下は静的ハードコード前提で SVG 文字列を生成し innerHTML に渡す。
  //       設定UI導入時もユーザー入力をここへ連結しないこと（XSS 化を防ぐ）。
  const GRID_W = 7;
  const GRID_H = 4;
  const FRAMES = [
    // 0: 翼を上げた姿（翼先が上の角、胴が下中央）
    [[0, 0], [6, 0], [1, 1], [5, 1], [2, 2], [4, 2], [3, 3]],
    // 1: 翼を水平に広げた中間姿
    [[0, 1], [1, 1], [5, 1], [6, 1], [2, 2], [3, 2], [4, 2]],
    // 2: 翼を下げた姿（翼先が下の角）
    [[3, 0], [2, 1], [4, 1], [1, 2], [5, 2], [0, 3], [6, 3]],
  ];
  // 羽ばたきの再生順（up → mid → down → mid の往復で滑らかに）
  const FLAP_CYCLE = [0, 1, 2, 1];

  // 1フレーム分のドットを SVG 文字列にする（白い 1px 矩形の集合）。
  const frameToSvg = (dots) => {
    const rects = dots
      .map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`)
      .join("");
    return (
      `<svg viewBox="0 0 ${GRID_W} ${GRID_H}" shape-rendering="crispEdges" ` +
      `xmlns="http://www.w3.org/2000/svg" fill="#ffffff">${rects}</svg>`
    );
  };
  const FRAME_SVGS = FRAMES.map(frameToSvg);

  // --- オーバーレイ（Shadow DOM）を構築 ---
  const host = document.createElement("div");
  host.id = "nonbiri-bird-host";
  host.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;" +
    "pointer-events:none;z-index:2147483647;border:0;margin:0;padding:0;overflow:hidden;";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .bird {
      position: absolute; top: 0; left: 0;
      will-change: transform;
      /* 白いドットがライト背景でも消えないよう、薄い影で輪郭を付ける */
      filter: drop-shadow(0 1px 1px rgba(0,0,0,0.45));
    }
    .frame { position: absolute; inset: 0; display: none; }
    .frame.on { display: block; }
    .frame svg { width: 100%; height: 100%; display: block; }
  `;
  shadow.appendChild(style);
  document.documentElement.appendChild(host);

  // 速度の緩急用の easing 候補（滑空・加速・減速など）
  const EASINGS = [
    "linear",
    "ease-in-out",
    "ease-in",
    "ease-out",
    "cubic-bezier(.2,.65,.8,.4)",
    "cubic-bezier(.6,0,.4,1)",
  ];

  let activeCount = 0; // 現在飛んでいる鳥の数
  let target = L.randInt(CONFIG.minFlock, CONFIG.maxFlock); // 空にいてほしい目標数

  // --- 1 羽を生成して飛ばす ---
  function spawnBird() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 奥行き感: サイズを決め、小さい鳥ほど薄く・遅くする（=遠い）。
    const size = rand(CONFIG.minSize, CONFIG.maxSize);
    const depth = L.computeDepth(size, CONFIG.minSize, CONFIG.maxSize); // 0(遠)〜1(近)
    const opacity = L.computeOpacity(depth); // 0.6〜1.0
    const w = size;
    const h = size * (GRID_H / GRID_W);

    const bird = document.createElement("div");
    bird.className = "bird";
    bird.style.width = w + "px";
    bird.style.height = h + "px";
    bird.style.opacity = opacity.toFixed(2);
    // 3フレームを重ねて置き、表示を切り替えて羽ばたかせる。
    bird.innerHTML = FRAME_SVGS.map(
      (svg, i) => `<div class="frame${i === 0 ? " on" : ""}">${svg}</div>`
    ).join("");
    const frameEls = bird.querySelectorAll(".frame");
    shadow.appendChild(bird);
    activeCount++;

    // 羽ばたき: 一定間隔でフレームを切り替える（鳥ごとに周期をずらして自然に）。
    let fi = 0;
    const flapMs = rand(110, 190);
    const flapTimer = setInterval(() => {
      frameEls.forEach((el) => el.classList.remove("on"));
      frameEls[FLAP_CYCLE[fi % FLAP_CYCLE.length]].classList.add("on");
      fi++;
    }, flapMs);

    // 左右どちらから入るか・基準Y・ゆらぎ幅を計算（画面外→画面外。上空のみ）。
    const { startX, endX, dir, baseY, wander } = L.entryGeometry({
      vw,
      vh,
      w,
      config: CONFIG,
    });

    // dir: 進行方向に鳥を向ける（左行きは scaleX(-1) で水平反転）。
    const keyframes = L.buildKeyframes({ startX, endX, baseY, wander, dir });

    // 速度の緩急: 所要時間は遠い鳥ほど長め(遅い)＋ランダム、easing もランダム。
    const duration = L.computeDuration(
      depth,
      CONFIG.minFlightMs,
      CONFIG.maxFlightMs
    );
    const anim = bird.animate(keyframes, {
      duration,
      easing: L.pick(EASINGS),
      fill: "forwards",
    });

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return; // 冪等化: 二重発火で activeCount を二重に減らさない
      cleaned = true;
      clearInterval(flapTimer);
      bird.remove();
      activeCount--;
    };
    // finished は「完了で resolve / cancel で reject」。両方を拾って必ず後始末する。
    anim.finished.then(cleanup, cleanup);
  }

  // --- 群れの維持: 目標数に届くまで、ばらけたタイミングで湧かせる ---
  function tick() {
    const canFly = !reduceMotion.matches && !document.hidden;
    if (L.shouldSpawn(activeCount, target, canFly)) {
      spawnBird();
    }
    // 飛ばせない状況（動き抑制/非表示タブ）では再チェック間隔を広げて wakeup を減らす。
    setTimeout(tick, L.nextTickDelay(canFly));
  }

  // 空模様を時々変える: 目標数を振り直す。
  function rerollTarget() {
    target = L.randInt(CONFIG.minFlock, CONFIG.maxFlock);
    setTimeout(rerollTarget, L.rerollDelay(CONFIG));
  }

  setTimeout(tick, rand(1500, 4000));
  setTimeout(rerollTarget, L.rerollDelay(CONFIG));
})();
