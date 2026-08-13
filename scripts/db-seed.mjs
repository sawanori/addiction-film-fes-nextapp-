#!/usr/bin/env node
// content/*.json を Turso へ投入する（初期化専用）。
//
// 既存キーがある場合はデフォルトでスキップして警告する（運用中の編集を
// seed で上書きしないため）。強制上書きは --force を明示したときだけ。
//
// 投入後に全キーを読み戻し、(a) ソースJSONとの deep-equal、
// (b) 全文字列フィールドのコードポイント配列一致、を確認する。
// Turso はSQLiteベースでUTF-8を素通しするはずだが、往復でUnicode正規化が
// 起きていないことをここで実測する（〇○ のような表記ゆれを持つ値があるため）。
//
// 使い方:
//   node scripts/db-seed.mjs             # 既存キーはスキップ
//   node scripts/db-seed.mjs --force     # 既存キーも上書き（初期化のやり直し用）

import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { createClient } from "@libsql/client";
import { loadDevVars } from "./load-dev-vars.mjs";

loadDevVars();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定です（.dev.vars または環境変数）");
  process.exit(2);
}

const FORCE = process.argv.includes("--force");
const CONTENT_DIR = "content";

const client = createClient({ url, authToken });

/** 文字列を含む値をすべて再帰的に見つけて、比較用に平坦化する。 */
function collectStrings(value, path, out) {
  if (typeof value === "string") {
    out.push({ path, value });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collectStrings(v, `${path}.${k}`, out);
  }
}

function codePoints(s) {
  return Array.from(s).map((ch) => ch.codePointAt(0));
}

async function seedOne(key, data) {
  const json = JSON.stringify(data);

  const existing = await client.execute({
    sql: "SELECT key FROM content_documents WHERE key = ?",
    args: [key],
  });

  if (existing.rows.length > 0 && !FORCE) {
    console.log(`  [skip] ${key}（既存。--force で上書き）`);
    return;
  }

  if (existing.rows.length > 0 && FORCE) {
    await client.execute({
      sql: "UPDATE content_documents SET data = ?, revision = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key = ?",
      args: [json, key],
    });
    await client.execute({
      sql: "DELETE FROM content_revisions WHERE doc_key = ?",
      args: [key],
    });
  } else {
    await client.execute({
      sql: "INSERT INTO content_documents (key, data, revision) VALUES (?, ?, 1)",
      args: [key, json],
    });
  }

  await client.execute({
    sql: "INSERT INTO content_revisions (doc_key, revision, data, note) VALUES (?, 1, ?, ?)",
    args: [key, json, "seed"],
  });

  console.log(`  [ok]   ${key}`);
}

async function verifyOne(key, sourceData) {
  const { rows } = await client.execute({
    sql: "SELECT data FROM content_documents WHERE key = ?",
    args: [key],
  });
  if (rows.length === 0) return { key, ok: false, reason: "投入先に存在しない" };

  const stored = JSON.parse(rows[0].data);

  if (JSON.stringify(stored) !== JSON.stringify(sourceData)) {
    return { key, ok: false, reason: "deep-equal 不一致" };
  }

  const srcStrings = [];
  const storedStrings = [];
  collectStrings(sourceData, key, srcStrings);
  collectStrings(stored, key, storedStrings);

  for (let i = 0; i < srcStrings.length; i++) {
    const a = codePoints(srcStrings[i].value);
    const b = codePoints(storedStrings[i]?.value ?? "");
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      return { key, ok: false, reason: `コードポイント不一致: ${srcStrings[i].path}` };
    }
  }

  return { key, ok: true };
}

async function main() {
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.error(`${CONTENT_DIR}/ に *.json が見つかりません`);
    process.exit(2);
  }

  console.log(`投入 ${FORCE ? "(--force)" : "(skip-if-exists)"}:`);
  const sources = {};
  for (const file of files) {
    const key = basename(file, ".json");
    const data = JSON.parse(readFileSync(join(CONTENT_DIR, file), "utf8"));
    sources[key] = data;
    await seedOne(key, data);
  }

  console.log("\n読み戻し検証:");
  let allOk = true;
  for (const [key, data] of Object.entries(sources)) {
    const result = await verifyOne(key, data);
    if (result.ok) {
      console.log(`  [ok]   ${key}`);
    } else {
      allOk = false;
      console.log(`  [NG]   ${key}: ${result.reason}`);
    }
  }

  if (!allOk) {
    console.error("\n読み戻し検証に失敗しました");
    process.exit(1);
  }
  console.log("\n完了: 全ドキュメントの読み戻し検証OK");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.close());
