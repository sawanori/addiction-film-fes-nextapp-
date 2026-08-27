import * as bundled from "@/lib/content/documents";
import {
  createManifestBuilder,
  manifestPaths,
  unify,
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

/** 一覧と編集画面に出す「このドキュメントを直すとどこが変わるか」の説明。 */
const DOCUMENT_DESCRIPTIONS: Record<string, string> = {
  index: "トップページの本文。ファーストビュー・案内カード・ナビゲーター紹介・宣言文。",
  about: "About ページの本文。背景・取り組み・開催概要・主催体制・協賛の案内・お問い合わせ。",
  programme: "Programme ページの本文。見出し・鑑賞の案内・タイムテーブルまわり・会場案内。",
  tickets: "Tickets ページの本文。料金表・よくある質問。",
  news: "News ページの本文。最新のお知らせ・過去のお知らせ・プレス向けの案内。",
  privacy: "プライバシーポリシーの本文。",
  terms: "利用規約の本文。",
  legal: "特定商取引法に基づく表記の本文。",
  films: "上映作品の一覧。トップページと Programme ページの両方に、同じ内容が出ます。",
  timetable: "Programme ページのタイムテーブル（日ごとの進行）。",
  site: "全ページ共通のヘッダーとフッター。メニュー項目・サイト名・著作権表示など。",
};

export function documentDescription(key: string): string {
  return DOCUMENT_DESCRIPTIONS[key] ?? "このドキュメントの内容を編集します。";
}

const builder = createManifestBuilder(bundled as unknown as Record<string, unknown>);

/**
 * ドキュメント1件のフィールド定義。`doc` を渡さなければ同梱データの形を使う。
 *
 * `doc` を渡すときは、**同梱JSON（正典）との「形の和」**から導出する。
 * manifest は実データの形から機械導出しているので、DBの側で任意キーが欠けていると
 * その項目がフォームから消え、**二度と入力できなくなる**（`FieldEditor` は値の無い
 * 子項目を描画せず、`always` を宣言していても manifest にフィールドが無ければ効かない）。
 *
 * 実測した具体例: 予告編機能より前に作られたリビジョンへ revert すると、全作品から
 * `trailer` が消えて manifest からも落ち、管理画面から予告編を再登録できなくなった。
 * 正典と和をとることで、値が無くてもフィールド定義だけは残る。
 * manifest は**形の導出にしか使わず**（値は `initialData` として別に渡す）、
 * 保存時の許可リストが正典のぶんだけ広がるのは、まさに「消えた項目を入れ直せる」ために要る。
 */
export function buildManifest(key: DocumentKey, doc?: unknown): DocumentManifest {
  const canonical: unknown = bundled[key];
  const shape = doc === undefined ? canonical : unify([canonical, doc]);
  return builder.buildManifest(key, documentLabel(key), shape);
}

/** 全ドキュメントぶん。管理画面のダッシュボードで使う。 */
export function buildAllManifests(): DocumentManifest[] {
  return DOCUMENT_KEYS.map((key) => buildManifest(key));
}
