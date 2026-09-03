import {
  getContentStore,
  type HistoryEntry,
  type StoredDocument,
  type WriteOutcome,
} from "@/lib/content/store";

/**
 * 管理APIから見たドキュメントの読み書き。
 *
 * 実体は `lib/content/store.ts` の `ContentStore`（GitHub 実装 / ローカル FS 実装）で、
 * ここはその薄い入口。**管理画面の読み書きはすべてこの5関数を通す**。
 *
 * 書き込みは**楽観ロック**で、鍵は「ファイルの blob sha の一致」。呼び出し側が持っている
 * `baseSha` が保存先の現在の blob sha と違えば `conflict` を返し、何も書かない
 * （計画書 `docs/plans/git-backed-cms/implementation-plan.md` §7.2）。
 *
 * 保存先が決まらない（環境変数が足りない）場合は `"misconfigured"` を返す。API はこれを
 * 500 `server_misconfigured`、`"store_error"` / `reason:"store"` を 503 `store_unavailable`
 * に対応させる（§9）。
 */

/** 保存先が決まらないときの `"misconfigured"` を足した読み出し結果。 */
export type ReadResult = StoredDocument | null | "store_error" | "misconfigured";

/** 現在の内容と blob sha。保存先が読めなければ `"store_error"`、キーが無ければ `null`。 */
export async function readDocument(key: string): Promise<ReadResult> {
  const store = getContentStore();
  if (store === null) return "misconfigured";
  return store.read(key);
}

/** 楽観ロック付きの書き込み。`baseSha` が現在の blob sha と一致したときだけ保存する。 */
export async function writeDocument(
  key: string,
  baseSha: string,
  data: unknown,
  note: string | null
): Promise<WriteOutcome | "misconfigured"> {
  const store = getContentStore();
  if (store === null) return "misconfigured";
  return store.write(key, baseSha, data, note);
}

/** ダッシュボード用の一覧。`updatedAt` はそのファイルの最終コミット日時（無ければ null）。 */
export async function listDocuments(): Promise<
  Array<{ key: string; updatedAt: string | null }> | "store_error" | "misconfigured"
> {
  const store = getContentStore();
  if (store === null) return "misconfigured";
  return store.list();
}

/** 変更履歴（新しい順）。ローカル FS 実装では常に空配列。 */
export async function listHistory(
  key: string,
  limit = 20
): Promise<HistoryEntry[] | "store_error" | "misconfigured"> {
  const store = getContentStore();
  if (store === null) return "misconfigured";
  return store.history(key, limit);
}

/** 指定コミット時点の内容。無ければ `null`（ローカル FS 実装では常に `null`）。 */
export async function readAt(
  key: string,
  commit: string
): Promise<{ data: unknown } | null | "store_error" | "misconfigured"> {
  const store = getContentStore();
  if (store === null) return "misconfigured";
  return store.readAt(key, commit);
}
