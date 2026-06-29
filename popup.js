// nonbiri-bird — 設定 popup
//
// 役割: chrome.storage.sync に設定を読み書きするだけ。content.js は onChanged で拾う。
// 設計メモ:
// - 設定スキーマの単一情報源は src/logic.js（popup.html で先に読み込み globalThis.NonbiriLogic
//   として参照）。DEFAULTS / MAX_BIRDS / clampMaxBirds を content.js と共有しズレを防ぐ。
// - 値の表示は textContent / value 経由のみ。ユーザー入力を innerHTML へ流さない（XSS 回避）。
"use strict";

const L = globalThis.NonbiriLogic;
const DEFAULTS = L.DEFAULTS;
const FREQUENCIES = ["low", "mid", "high"]; // 不正な frequency を弾くホワイトリスト

const $ = (id) => document.getElementById(id);
const enabledEl = $("enabled");
const maxBirdsEl = $("maxBirds");
const maxBirdsLabel = $("maxBirdsLabel");
const excludedEl = $("excludedSites");

maxBirdsEl.max = String(L.MAX_BIRDS); // range 上限もスキーマ由来にする

// テキストエリア（1行1ホスト）⇄ 配列の相互変換。
const linesToList = (text) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
const listToLines = (list) => (Array.isArray(list) ? list.join("\n") : "");

// 現在 UI の値を 1 つの設定オブジェクトにまとめる。
function readForm() {
  const freq = document.querySelector('input[name="freq"]:checked');
  return {
    enabled: enabledEl.checked,
    maxBirds: L.clampMaxBirds(maxBirdsEl.value),
    frequency: freq ? freq.value : DEFAULTS.frequency,
    excludedSites: linesToList(excludedEl.value),
  };
}

// 設定を UI へ反映する。
function fillForm(s) {
  enabledEl.checked = !!s.enabled;
  maxBirdsEl.value = String(L.clampMaxBirds(s.maxBirds));
  maxBirdsLabel.textContent = maxBirdsEl.value;
  // frequency はホワイトリスト経由で選ぶ（storage 由来の壊れた値でセレクタを壊さない）。
  const freq = FREQUENCIES.includes(s.frequency) ? s.frequency : DEFAULTS.frequency;
  const freqEl = document.querySelector(`input[name="freq"][value="${freq}"]`);
  if (freqEl) freqEl.checked = true;
  excludedEl.value = listToLines(s.excludedSites);
}

// storage へ保存（連続入力で書き込みクォータを超えないようデバウンス）。
let saveTimer = null;
function save() {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.sync.set(readForm(), () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        console.warn("[nonbiri-bird] 設定の保存に失敗したのだ:", chrome.runtime.lastError);
      }
    });
  }, 400);
}

// 現在開いているタブのホスト名を除外リストへ追加する。
function excludeCurrentSite() {
  if (typeof chrome === "undefined" || !chrome.tabs) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.url) return;
    let host;
    try {
      host = new URL(tab.url).hostname.toLowerCase(); // chrome:// 等は失敗するので握りつぶす
    } catch (_e) {
      return;
    }
    if (!host) return;
    // 大文字小文字を無視して重複排除する。
    const list = linesToList(excludedEl.value);
    if (!list.some((h) => h.toLowerCase() === host)) list.push(host);
    excludedEl.value = list.join("\n");
    save();
  });
}

// 入力変更で保存（range のラベルだけは即時に更新）。
maxBirdsEl.addEventListener("input", () => {
  maxBirdsLabel.textContent = maxBirdsEl.value;
});
["change", "input"].forEach((ev) => {
  document.addEventListener(ev, save);
});
$("excludeCurrent").addEventListener("click", excludeCurrentSite);

// 起動時: 保存済み設定を読み込んで UI に反映。
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get(DEFAULTS, fillForm);
} else {
  fillForm(DEFAULTS);
}
