import { createClient, type Client } from "@libsql/client/http";

/**
 * Turso クライアントを生成する。
 * TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定なら例外を投げず null を返す。
 * モジュール読み込み時には接続しない（呼び出しごとに生成する。Next のビルド時評価を避けるため）。
 *
 * `@libsql/client/web` ではなく **`/http`** を使う。`/web` は `@libsql/isomorphic-ws`
 * 経由で WebSocket を参照するが、Next の standalone 出力は同パッケージの node 条件
 * （`node.mjs`）しかコピーしないため、workerd 向けにバンドルする段階で
 * `Could not resolve "@libsql/isomorphic-ws"`（workerd 条件の `web.mjs` が無い）で
 * `opennextjs-cloudflare build` が失敗する。`/http` は WebSocket を一切参照しない。
 * `libsql://` URL のまま使え、`execute` と `batch` の両方が動くことを実測済み。
 */
export function getDbClient(): Client | null {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    return null;
  }
  return createClient({ url, authToken });
}
