import { cache } from "react";
import * as bundled from "@/lib/content/documents";

/**
 * 公開ページのコンテンツ読み出し。
 *
 * 正典は `content/*.json`（`lib/content/documents.ts` が export する同梱JSON）。
 * 管理画面での保存は GitHub へコミットされ、Vercel の再ビルドでこの同梱JSONに取り込まれる
 * （`docs/plans/git-backed-cms/implementation-plan.md` §7.3）。公開ページは実行時に外部へ
 * 読みに行かない。
 *
 * キーは `content/<key>.json` のファイル名（`tickets` / `legal` …）。
 * `react` の `cache()` で包んでいるので、同一リクエスト内で `generateMetadata` と
 * ページ本体の両方から呼んでも読み出しは1回で済む。
 */
export type DocumentKey = keyof typeof bundled;

export const getDocument = cache(
  async <K extends DocumentKey>(key: K): Promise<(typeof bundled)[K]> => {
    return bundled[key];
  }
);
