// nonbiri-bird — logic.js のユニットテスト（Node 標準の node:test、依存ゼロ）。
// 乱数は固定 rng を注入して結果を決定的に検証する。
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../src/logic.js");

// 常に同じ値を返す rng（DI 用）。
const constRng = (v) => () => v;
// 与えた配列を順番に返す rng（呼ばれるたび次の値）。
const seqRng = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test("rand: rng=0 は下限、rng→1 は上限に近づく", () => {
  assert.equal(L.rand(10, 20, constRng(0)), 10);
  assert.equal(L.rand(10, 20, constRng(0.5)), 15);
});

test("randInt: 上限を含む整数を返す", () => {
  assert.equal(L.randInt(1, 5, constRng(0)), 1); // 下限
  assert.equal(L.randInt(1, 5, constRng(0.999)), 5); // 上限(=max を含む)
});

test("pick: rng に応じて要素を選ぶ", () => {
  const arr = ["a", "b", "c"];
  assert.equal(L.pick(arr, constRng(0)), "a");
  assert.equal(L.pick(arr, constRng(0.5)), "b");
  assert.equal(L.pick(arr, constRng(0.99)), "c");
});

test("computeDepth: 正規化と 0〜1 クランプ", () => {
  assert.equal(L.computeDepth(14, 14, 30), 0); // 最小=遠い
  assert.equal(L.computeDepth(30, 14, 30), 1); // 最大=近い
  assert.equal(L.computeDepth(22, 14, 30), 0.5);
  assert.equal(L.computeDepth(100, 14, 30), 1); // 上クランプ
  assert.equal(L.computeDepth(0, 14, 30), 0); // 下クランプ
});

test("computeDepth: min==max の 0 除算を 0 で保護", () => {
  assert.equal(L.computeDepth(20, 20, 20), 0);
});

test("computeOpacity: depth 0→0.6, 1→1.0", () => {
  assert.equal(L.computeOpacity(0), 0.6);
  assert.equal(L.computeOpacity(1), 1.0);
});

test("computeDuration: 遠い(depth=0)ほど長く、近い(depth=1)ほど短い", () => {
  const far = L.computeDuration(0, 1000, 1000, constRng(0)); // base=1000, bias=1.4
  const near = L.computeDuration(1, 1000, 1000, constRng(0)); // base=1000, bias=0.6
  assert.equal(far, 1400);
  assert.equal(near, 600);
  assert.ok(far > near);
});

test("entryGeometry: rng<0.5 は左→右、>=0.5 は右→左", () => {
  const cfg = { skyTop: 0, skyBottom: 0.3 };
  // rng 呼び出し順: leftToRight 判定 → baseY → wander
  const ltr = L.entryGeometry({ vw: 1000, vh: 800, w: 20, config: cfg, rng: seqRng([0.0, 0, 0]) });
  assert.equal(ltr.dir, 1);
  assert.equal(ltr.startX, -20);
  assert.equal(ltr.endX, 1020);

  const rtl = L.entryGeometry({ vw: 1000, vh: 800, w: 20, config: cfg, rng: seqRng([0.9, 0, 0]) });
  assert.equal(rtl.dir, -1);
  assert.equal(rtl.startX, 1020);
  assert.equal(rtl.endX, -20);
});

test("buildKeyframes: steps+1 個、両端は startX/endX、dir が反映される", () => {
  const kf = L.buildKeyframes({ startX: 0, endX: 100, baseY: 50, wander: 0, dir: -1, steps: 4 });
  assert.equal(kf.length, 5);
  // wander=0 なので y は baseY 固定。両端の x を確認。
  assert.equal(kf[0].transform, "translate(0px, 50px) scaleX(-1)");
  assert.equal(kf[4].transform, "translate(100px, 50px) scaleX(-1)");
});

test("buildKeyframes: wander>0 で y が baseY + sin(t*2π)*wander で上下する", () => {
  const kf = L.buildKeyframes({ startX: 0, endX: 0, baseY: 50, wander: 10, dir: 1, steps: 4 });
  // transform 文字列から y(px) を取り出す（sin の浮動小数誤差があるため許容差で比較）。
  const yOf = (t) => Number(t.match(/translate\(0px, (-?[\d.eE+-]+)px\)/)[1]);
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b} ではないのだ`);
  near(yOf(kf[0].transform), 50); // t=0    sin0=0
  near(yOf(kf[1].transform), 60); // t=0.25 sin(π/2)=1 → 最大
  near(yOf(kf[2].transform), 50); // t=0.5  sin(π)=0
  near(yOf(kf[3].transform), 40); // t=0.75 sin(3π/2)=-1 → 最小
  near(yOf(kf[4].transform), 50); // t=1    sin(2π)=0
});

test("nextTickDelay: 飛べる時は短い間隔、飛べない時は 8000ms 固定", () => {
  assert.equal(L.nextTickDelay(true, constRng(0)), 800);
  assert.equal(L.nextTickDelay(false, constRng(0)), 8000);
  assert.equal(L.nextTickDelay(false, constRng(0.9)), 8000); // rng に依らず固定
});

test("rerollDelay: 設定の範囲から引く", () => {
  const cfg = { rerollMinMs: 25000, rerollMaxMs: 60000 };
  assert.equal(L.rerollDelay(cfg, constRng(0)), 25000);
});

test("shouldSpawn: 目標未達＋確率ゲート＋canFly の AND", () => {
  // 目標未達・canFly・rng<0.75 → 湧く
  assert.equal(L.shouldSpawn(0, 5, true, constRng(0)), true);
  // 飛べない → false
  assert.equal(L.shouldSpawn(0, 5, false, constRng(0)), false);
  // 目標到達済み → false
  assert.equal(L.shouldSpawn(5, 5, true, constRng(0)), false);
  // 確率ゲートで外れ(rng>=0.75) → false
  assert.equal(L.shouldSpawn(0, 5, true, constRng(0.8)), false);
});
