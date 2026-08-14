import { cache } from "react";
import { getDbClient } from "@/lib/db";
import * as bundled from "@/lib/content/documents";

/**
 * 公開ページのコンテンツ読み出し。
 *
 * Turso の `content_documents` から読み、取得できない場合は `lib/content/documents.ts` の
 * 同梱JSON（正典データ）へフォールバックする。フォールバック条件は次の4つで、いずれも
 * **公開サイトを落とさない**ことを優先する（管理画面と違い fail-closed にはしない）:
 *
 * - `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` が未設定（`getDbClient()` が null）
 * - 該当キーの行が無い
 * - クエリが例外を投げた（接続断など）
 * - 取り出した JSON のパースに失敗した
 *
 * キーは `scripts/db-seed.mjs` が使っている素のファイル名（`tickets` / `legal` …）。
 * `react` の `cache()` で包んでいるので、同一リクエスト内で `generateMetadata` と
 * ページ本体の両方から呼んでも DB 往復は1回で済む。
 */
export type DocumentKey = keyof typeof bundled;

export const getDocument = cache(
  async <K extends DocumentKey>(key: K): Promise<(typeof bundled)[K]> => {
    const fallback = bundled[key];

    const client = getDbClient();
    if (!client) return fallback;

    try {
      const { rows } = await client.execute({
        sql: "SELECT data FROM content_documents WHERE key = ?",
        args: [key],
      });
      if (rows.length === 0) return fallback;

      const raw = rows[0].data;
      if (typeof raw !== "string") return fallback;

      return JSON.parse(raw) as (typeof bundled)[K];
    } catch {
      return fallback;
    }
  }
);
