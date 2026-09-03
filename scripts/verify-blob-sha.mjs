#!/usr/bin/env node
// 直列化（計画書 §7.13）と git blob SHA-1（§7.2）の回帰テスト。
//
// `content/*.json` の各ファイルについて、次の2点を確認する。
//   1. `serializeDocument(JSON.parse(raw))` が現ファイルとバイト一致すること
//      （＝ task_001 で揃えた正規形が保たれていること）
//   2. その直列化に対する `gitBlobSha()` が `git hash-object <file>` と一致すること
//      （＝ sha の計算方式が git／GitHub Contents API と同じであること）
//
// `lib/content/store.ts` は `@/…` エイリアスで manifest を import しており Node から
// 直接 import できないため、下の2つの関数は store.ts と**同一の式**を書き写している。
// 片方だけ変えるとこのテストが無意味になるので、直すときは必ず両方を直すこと。
//
// 使い方:
//   node scripts/verify-blob-sha.mjs

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = path.join(ROOT, "content");

/** lib/content/store.ts の `serializeDocument()` と同一。 */
function serializeDocument(data) {
  return JSON.stringify(data, null, 2) + "\n";
}

/** lib/content/store.ts の `gitBlobSha()` と同一（Web Crypto の SHA-1）。 */
async function gitBlobSha(text) {
  const body = new TextEncoder().encode(text);
  const header = new TextEncoder().encode(`blob ${body.length}\0`);
  const bytes = new Uint8Array(header.length + body.length);
  bytes.set(header, 0);
  bytes.set(body, header.length);

  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const files = readdirSync(CONTENT_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort();

if (files.length === 0) {
  console.error(`content/ に .json が1件も無い（${CONTENT_DIR}）`);
  process.exit(1);
}

let failed = 0;
for (const name of files) {
  const file = path.join(CONTENT_DIR, name);
  const raw = readFileSync(file);

  let serialized;
  try {
    serialized = Buffer.from(serializeDocument(JSON.parse(raw.toString("utf8"))), "utf8");
  } catch (error) {
    console.error(`  [NG] ${name} … JSON として読めない（${error.message}）`);
    failed += 1;
    continue;
  }

  if (!raw.equals(serialized)) {
    console.error(
      `  [NG] ${name} … 直列化がファイルと一致しない（現物 ${raw.length} バイト / 直列化 ${serialized.length} バイト）`
    );
    failed += 1;
    continue;
  }

  const actual = await gitBlobSha(serialized.toString("utf8"));
  const expected = execFileSync("git", ["hash-object", file], { encoding: "utf8" }).trim();

  if (actual !== expected) {
    console.error(`  [NG] ${name}\n       git hash-object: ${expected}\n       gitBlobSha():    ${actual}`);
    failed += 1;
    continue;
  }
  console.log(`  [ok] ${name} → ${actual}`);
}

if (failed > 0) {
  console.error(`\n直列化と blob SHA-1: ${failed} 件失敗（全 ${files.length} 件）`);
  process.exit(1);
}
console.log(`\n直列化と blob SHA-1: 全 ${files.length} 件合格`);
