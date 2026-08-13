#!/usr/bin/env node
// Turso にスキーマを適用する。
//
// マイグレーションフレームワークは導入せず、schema_migrations テーブルで
// 未適用のバージョン分だけ順に当てる。各文は IF NOT EXISTS 付きで冪等。
// スキーマの中身は docs/implementation-plan.md §10.2 を正典とする。
//
// 実装メモ: 計画時点では PRAGMA user_version でバージョン管理する想定だったが、
// Turso の HTTP プロトコル（Hrana）は `PRAGMA user_version = N` の書き込みを
// SQL_PARSE_ERROR で拒否する（読み取りは可）。実測して判明したため、
// バージョンは通常のテーブルで管理する方式に変更した。
//
// 使い方:
//   node scripts/db-migrate.mjs
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/db-migrate.mjs

import { createClient } from "@libsql/client";
import { loadDevVars } from "./load-dev-vars.mjs";

loadDevVars();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定です（.dev.vars または環境変数）");
  process.exit(2);
}

const client = createClient({ url, authToken });

// version: そのバージョンに到達するために実行する文の配列。
// 冪等性を壊さないため、既存バージョンの中身は変更せず、変更が要るときは新しい version を足す。
const MIGRATIONS = {
  1: [
    `CREATE TABLE IF NOT EXISTS content_documents (
      key        TEXT PRIMARY KEY,
      data       TEXT NOT NULL CHECK (json_valid(data)),
      revision   INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`,
    `CREATE TABLE IF NOT EXISTS content_revisions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_key    TEXT NOT NULL REFERENCES content_documents(key) ON DELETE CASCADE,
      revision   INTEGER NOT NULL,
      data       TEXT NOT NULL CHECK (json_valid(data)),
      note       TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE (doc_key, revision)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_revisions_doc
      ON content_revisions (doc_key, revision DESC)`,
    `CREATE TABLE IF NOT EXISTS login_attempts (
      ip           TEXT PRIMARY KEY,
      failures     INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_login_attempts_updated
      ON login_attempts (updated_at)`,
    `CREATE TABLE IF NOT EXISTS admin_settings (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      session_version INTEGER NOT NULL DEFAULT 1
    )`,
    `INSERT OR IGNORE INTO admin_settings (id, session_version) VALUES (1, 1)`,
  ],
};

const TARGET_VERSION = Math.max(...Object.keys(MIGRATIONS).map(Number));

async function main() {
  await client.execute("PRAGMA foreign_keys = ON");

  // バージョン管理テーブル自体の作成はどのバージョンにも属さないため、
  // MIGRATIONS の外、かつ IF NOT EXISTS で毎回冪等に実行する。
  await client.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);

  const { rows } = await client.execute(
    "SELECT COALESCE(MAX(version), 0) AS current FROM schema_migrations"
  );
  const current = Number(rows[0]?.current ?? 0);

  if (current >= TARGET_VERSION) {
    console.log(`schema は既に version ${current}（目標 ${TARGET_VERSION}）。適用不要。`);
    return;
  }

  for (let v = current + 1; v <= TARGET_VERSION; v++) {
    console.log(`version ${v} を適用中...`);
    for (const stmt of MIGRATIONS[v]) {
      await client.execute(stmt);
    }
    await client.execute({
      sql: "INSERT INTO schema_migrations (version) VALUES (?)",
      args: [v],
    });
  }

  console.log(`完了: schema version ${TARGET_VERSION}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.close());
