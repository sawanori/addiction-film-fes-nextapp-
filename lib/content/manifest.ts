import * as bundled from "@/lib/content/documents";
import {
  createManifestBuilder,
  manifestPaths,
  type DocumentManifest,
  type Field,
} from "@/lib/content/manifest-core";

/**
 * アプリ側から使う manifest の入口。導出ロジックは `manifest-core.ts`
 * （何も import しないので `scripts/verify-coverage.mjs` からも同じものを使える）。
 */

export type { DocumentManifest, Field };
export { manifestPaths };

export type DocumentKey = keyof typeof bundled;

export const DOCUMENT_KEYS = Object.keys(bundled) as DocumentKey[];

/** ドキュメントキーの表示名。ここに無いキーはキー名をそのまま出す。 */
const DOCUMENT_LABELS: Record<string, string> = {
  index: "トップページ",
  about: "About ページ",
  programme: "Programme ページ",
  tickets: "Tickets ページ",
  news: "News ページ",
  privacy: "プライバシーポリシー",
  terms: "利用規約",
  legal: "特定商取引法に基づく表記",
  films: "上映作品（index / programme 共通）",
  timetable: "タイムテーブル（programme）",
  site: "ヘッダー・フッター（全ページ共通）",
};

export function documentLabel(key: string): string {
  return DOCUMENT_LABELS[key] ?? key;
}

const builder = createManifestBuilder(bundled as unknown as Record<string, unknown>);

/** ドキュメント1件のフィールド定義。`doc` を渡さなければ同梱データの形を使う。 */
export function buildManifest(key: DocumentKey, doc?: unknown): DocumentManifest {
  return builder.buildManifest(key, documentLabel(key), doc ?? bundled[key]);
}

/** 全ドキュメントぶん。管理画面のダッシュボードで使う。 */
export function buildAllManifests(): DocumentManifest[] {
  return DOCUMENT_KEYS.map((key) => buildManifest(key));
}
