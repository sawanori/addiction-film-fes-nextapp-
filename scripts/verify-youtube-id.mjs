#!/usr/bin/env node
// 予告編の動画ID欄（manifest で format: "youtube-id" を付けた欄）の変換規則を検証する。
//
// 仕様は `docs/plans/trailer-admin/implementation-plan.md` §9.4 の表。
// `scripts/verify-coverage.mjs` と同じく `.ts` を Node の型剥がしで直接 import するので、
// tsx などの追加依存は要らない。
//
// 使い方:
//   node scripts/verify-youtube-id.mjs

import { extractYouTubeId, isYouTubeId } from "../lib/content/youtube.ts";

const ID = "Ml8xEePJGoo";
const ID2 = "IkSjwENUNAU";

/** [入力, 期待する変換結果, 変換後に保存が許されるか] */
const CASES = [
  // --- 通常の視聴URL ---
  [`https://www.youtube.com/watch?v=${ID}`, ID, true],
  [`https://youtube.com/watch?v=${ID}`, ID, true],
  [`http://www.youtube.com/watch?v=${ID}`, ID, true],
  [`https://m.youtube.com/watch?v=${ID}`, ID, true],
  [`https://music.youtube.com/watch?v=${ID}`, ID, true],
  // 付随パラメータがあってもよい（開始秒は別の欄で扱うので取り込まない）
  [`https://www.youtube.com/watch?v=${ID2}&t=3s`, ID2, true],
  [`https://www.youtube.com/watch?v=${ID}&list=PLxxxx&index=2`, ID, true],

  // --- 共有URL ---
  [`https://youtu.be/${ID}`, ID, true],
  [`https://youtu.be/${ID2}?t=3`, ID2, true],

  // --- 埋め込み・その他のパス形式 ---
  [`https://www.youtube.com/embed/${ID}`, ID, true],
  [`https://www.youtube-nocookie.com/embed/${ID}`, ID, true],
  [`https://youtube-nocookie.com/embed/${ID}?autoplay=1`, ID, true],
  [`https://www.youtube.com/shorts/${ID}`, ID, true],
  [`https://www.youtube.com/live/${ID}`, ID, true],
  [`https://www.youtube.com/v/${ID}`, ID, true],

  // --- スキーム省略（既知ホスト名で始まる場合だけ補う） ---
  [`youtu.be/${ID}`, ID, true],
  [`www.youtube.com/watch?v=${ID}`, ID, true],
  [`youtube.com/watch?v=${ID}`, ID, true],

  // --- 動画IDそのもの ---
  [ID, ID, true],
  [`  ${ID}  `, ID, true],
  [`${ID}\n`, ID, true],

  // --- 空欄（＝予告編なし。保存してよい） ---
  ["", "", true],

  // --- 変換できない入力: そのまま返し、保存は拒否させる ---
  ["https://vimeo.com/123456789", "https://vimeo.com/123456789", false],
  ["https://example.com/watch?v=" + ID, "https://example.com/watch?v=" + ID, false],
  ["https://www.youtube.com/watch?v=short", "https://www.youtube.com/watch?v=short", false],
  ["https://www.youtube.com/", "https://www.youtube.com/", false],
  ["https://www.youtube.com/@somechannel", "https://www.youtube.com/@somechannel", false],
  ["予告編のURL", "予告編のURL", false],
  ["Ml8xEePJGo", "Ml8xEePJGo", false], // 10文字
  ["Ml8xEePJGooX", "Ml8xEePJGooX", false], // 12文字
  ["Ml8xEePJG o", "Ml8xEePJG o", false], // 途中に空白
  ["not a url at all", "not a url at all", false],
];

let failed = 0;
for (const [input, expected, allowed] of CASES) {
  const actual = extractYouTubeId(input);
  const savable = actual === "" || isYouTubeId(actual);
  const show = JSON.stringify(input);

  if (actual !== expected) {
    console.error(`  [NG] ${show}\n       期待: ${JSON.stringify(expected)}\n       実際: ${JSON.stringify(actual)}`);
    failed += 1;
    continue;
  }
  if (savable !== allowed) {
    console.error(
      `  [NG] ${show} … 保存可否が違う（期待: ${allowed ? "保存できる" : "422で拒否"} / 実際: ${savable ? "保存できる" : "422で拒否"}）`
    );
    failed += 1;
    continue;
  }
  console.log(`  [ok] ${show} → ${JSON.stringify(actual)}${allowed ? "" : "（保存は拒否）"}`);
}

if (failed > 0) {
  console.error(`\n動画IDの変換規則: ${failed} 件失敗（全 ${CASES.length} 件）`);
  process.exit(1);
}
console.log(`\n動画IDの変換規則: 全 ${CASES.length} 件合格`);
