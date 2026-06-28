// nonbiri-bird — content script
// 全ページに 1 羽の鳥をオーバーレイし、たまーに画面をのんびり横切らせる。
//
// 設計メモ:
// - Shadow DOM: ホストページの CSS が拡張の要素に干渉しない隔離コンテナ。
//   attachShadow した中に style と鳥を入れることで、どんなサイトでも見た目が崩れない。
// - Web Animations API (element.animate): JS から keyframes を直接渡してアニメーションさせる API。
//   transform の translate を使うので GPU 合成レイヤーに乗り、軽くて滑らか。
(() => {
  "use strict";

  // iframe 内では動かさない（1 ページに鳥が何羽も出てしまうのを防ぐ）。
  if (window.top !== window.self) return;
  // 二重注入ガード（SPA の再注入などで複数回走った場合の保険）。
  if (window.__nonbiriBirdLoaded) return;
  window.__nonbiriBirdLoaded = true;

  // --- 調整パラメータ（後の Issue で設定 UI から変更できるようにする予定） ---
  const CONFIG = {
    minIdleMs: 12000, // 飛び終えてから次に飛ぶまでの最短待機
    maxIdleMs: 40000, // 同・最長待機（この範囲のランダム = 「たまーに」）
    minFlightMs: 14000, // 横断にかける最短時間（長い = のんびり）
    maxFlightMs: 22000, // 同・最長時間
    birdSize: 28, // 鳥の見た目サイズ(px)
  };

  const rand = (min, max) => min + Math.random() * (max - min);

  // 動きに敏感なユーザーへの配慮: OS/ブラウザで「視差効果を減らす」設定のときは飛ばさない。
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // --- オーバーレイ（Shadow DOM）を構築 ---
  const host = document.createElement("div");
  host.id = "nonbiri-bird-host";
  // ホスト要素自体を全画面に固定し、クリックは透過させる。
  host.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;" +
    "pointer-events:none;z-index:2147483647;border:0;margin:0;padding:0;overflow:hidden;";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .bird {
      position: absolute;
      top: 0; left: 0;
      width: ${CONFIG.birdSize}px;
      height: ${CONFIG.birdSize}px;
      will-change: transform;
    }
    /* 羽ばたき: カモメ型シルエットを縦に潰す/戻すで遠景の鳥らしい羽ばたきに見せる */
    .wings {
      width: 100%; height: 100%;
      animation: flap 0.7s ease-in-out infinite;
      transform-origin: 50% 50%;
    }
    @keyframes flap {
      0%, 100% { transform: scaleY(1); }
      50%      { transform: scaleY(0.55); }
    }
    .wings svg { display: block; width: 100%; height: 100%; }
  `;
  shadow.appendChild(style);

  document.documentElement.appendChild(host);

  // カモメ型シルエットの SVG（"M" 字の遠景バード）。
  // 注意: この文字列は静的ハードコード前提で innerHTML に渡している。
  //       将来 設定 UI で鳥の種類などを扱う際も、ユーザー入力をここへ連結しないこと（XSS 化を防ぐ）。
  const BIRD_SVG =
    '<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M5 45 Q30 5 50 32 Q70 5 95 45" ' +
    'fill="none" stroke="#3a3a3a" stroke-width="9" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // --- 1 回の飛行 ---
  function flyOnce() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const bird = document.createElement("div");
    bird.className = "bird";
    const wings = document.createElement("div");
    wings.className = "wings";
    wings.innerHTML = BIRD_SVG;
    bird.appendChild(wings);
    shadow.appendChild(bird);

    // 左右どちらから入るかランダム。画面外から入って画面外へ抜ける。
    const leftToRight = Math.random() < 0.5;
    const startX = leftToRight ? -CONFIG.birdSize : vw + CONFIG.birdSize;
    const endX = leftToRight ? vw + CONFIG.birdSize : -CONFIG.birdSize;
    // 画面上部 10%〜55% あたりの高さを基準に、空をのんびり飛ぶ。
    const baseY = rand(vh * 0.1, vh * 0.55);
    const wander = rand(20, 60); // 上下の揺れ幅(px)

    // 進行方向に合わせて鳥を向ける（右行きはそのまま、左行きは水平反転）。
    const dir = leftToRight ? 1 : -1;
    const frame = (px, py) =>
      `translate(${px}px, ${py}px) scaleX(${dir})`;

    // 横断しながら緩いサインの上下動を付ける keyframes を生成。
    const STEPS = 6;
    const frames = [];
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const x = startX + (endX - startX) * t;
      const y = baseY + Math.sin(t * Math.PI * 2) * wander;
      frames.push({ transform: frame(x, y) });
    }

    const duration = rand(CONFIG.minFlightMs, CONFIG.maxFlightMs);
    const anim = bird.animate(frames, {
      duration,
      easing: "linear",
      fill: "forwards",
    });

    anim.onfinish = () => {
      bird.remove();
      scheduleNext();
    };
  }

  // --- 次の飛行をランダムな待機後に予約（= 「たまーに」） ---
  function scheduleNext() {
    if (reduceMotion.matches) return; // 動きを控える設定なら飛ばさない
    const wait = rand(CONFIG.minIdleMs, CONFIG.maxIdleMs);
    setTimeout(flyOnce, wait);
  }

  // 「視差効果を減らす」設定が後から解除されたら、飛行を再開する。
  reduceMotion.addEventListener("change", () => {
    if (!reduceMotion.matches) scheduleNext();
  });

  // 初回は短めの待ちで 1 羽飛ばす（読み込み直後に何も起きないと動作確認しづらいため）。
  if (!reduceMotion.matches) setTimeout(flyOnce, rand(2000, 5000));
})();
