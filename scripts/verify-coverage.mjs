#!/usr/bin/env node
// 編集網羅性の検証。
//
// 「管理画面から全ての情報を編集できる」を機械的に確かめる。実データ（content/*.json）の
// リーフ（文字列・真偽値・数値）を1件残らず数え上げ、manifest（lib/content/manifest-core.ts が
// 導出するフォーム定義）がそのパスを受け持っているかを突き合わせる。
//
// manifest は実データから導出しているので原理的には一致するが、導出ロジックの取りこぼし
// （inline 判定の誤り・配列要素のばらつきなど）はここで初めて露見する。
//
// 使い方:
//   node scripts/verify-coverage.mjs          # 不足があれば終了コード1
//   node scripts/verify-coverage.mjs --json   # 機械可読な出力

import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { createManifestBuilder, manifestPaths } from "../lib/content/manifest-core.ts";

const CONTENT_DIR = "content";
const AS_JSON = process.argv.includes("--json");

const documents = {};
for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json")).sort()) {
  documents[basename(file, ".json")] = JSON.parse(readFileSync(join(CONTENT_DIR, file), "utf8"));
}

const { buildManifest } = createManifestBuilder(documents);

/** 実データの全リーフを正規化パスで数え上げる（配列の添字は [] に畳む）。 */
function collectLeaves(value, path, out) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectLeaves(item, `${path}[]`, out));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      collectLeaves(v, path ? `${path}.${k}` : k, out);
    }
    return;
  }
  out.push({ path, value });
}

let totalLeaves = 0;
let totalUncovered = 0;
const report = [];

for (const [key, doc] of Object.entries(documents)) {
  const manifest = buildManifest(key, key, doc);
  const { leaves: covered, inlines } = manifestPaths(manifest.fields);
  const coveredSet = new Set(covered);

  const found = [];
  collectLeaves(doc, "", found);

  const uncovered = found.filter(({ path }) => {
    if (coveredSet.has(path)) return false;
    // inline フィールドは配下（c[] や href、装飾ノード）をまとめて1つのフィールドが受け持つ
    return !inlines.some((inlinePath) => path === inlinePath || path.startsWith(`${inlinePath}[]`));
  });

  totalLeaves += found.length;
  totalUncovered += uncovered.length;
  report.push({
    key,
    leaves: found.length,
    fields: covered.length,
    inlines: inlines.length,
    uncovered: uncovered.map((u) => u.path),
  });
}

if (AS_JSON) {
  console.log(JSON.stringify({ totalLeaves, totalUncovered, documents: report }, null, 2));
} else {
  for (const r of report) {
    const mark = r.uncovered.length === 0 ? "ok  " : "NG  ";
    console.log(
      `  [${mark}] ${r.key.padEnd(10)} リーフ ${String(r.leaves).padStart(4)}件 / ` +
        `フィールド ${String(r.fields).padStart(4)}件 / inline ${String(r.inlines).padStart(3)}件` +
        (r.uncovered.length ? ` / 未カバー ${r.uncovered.length}件` : "")
    );
    for (const path of r.uncovered.slice(0, 10)) console.log(`         未カバー: ${path}`);
  }
  console.log("");
  if (totalUncovered === 0) {
    console.log(`編集網羅性OK: ${Object.keys(documents).length}ドキュメント / リーフ${totalLeaves}件すべてが manifest に対応`);
  } else {
    console.log(`編集網羅性NG: リーフ${totalLeaves}件のうち ${totalUncovered}件が manifest に対応していない`);
  }
}

process.exit(totalUncovered === 0 ? 0 : 1);
