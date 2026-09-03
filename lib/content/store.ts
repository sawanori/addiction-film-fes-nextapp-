import { LocalFsStore } from "@/lib/content/store-fs";
import { GitHubStore, isRepoSlug } from "@/lib/content/store-github";

/**
 * 管理画面から見た「保存先」の契約と、実装の選択。
 *
 * 管理APIの読み書きはすべてこの境界を通す（差し替えは task_005）。実装は2つ:
 *
 * - `LocalFsStore`（`lib/content/store-fs.ts`）… 作業ツリーの `content/<key>.json` を直接読み書きする
 * - `GitHubStore`（`lib/content/store-github.ts`。task_004 で追加）… GitHub の Contents / Commits API
 *
 * 仕様は `docs/plans/git-backed-cms/implementation-plan.md` の §7.1（契約と選択規則）・
 * §7.2（`sha` による楽観ロック）・§7.12（ローカル開発）・§7.13（直列化の正規化）。
 */

/** `sha` は git の blob SHA-1。楽観ロック専用で、画面には出さない。 */
export type StoredDocument = { key: string; data: unknown; sha: string };

export type HistoryEntry = { commit: string; note: string | null; createdAt: string };

export type WriteOutcome =
  | { ok: true; sha: string; commit: string | null; createdAt: string; unchanged: boolean }
  | { ok: false; reason: "conflict" | "not_found" | "forbidden" | "store"; sha?: string };

export interface ContentStore {
  read(key: string): Promise<StoredDocument | null | "store_error">;
  write(key: string, baseSha: string, data: unknown, note: string | null): Promise<WriteOutcome>;
  /** ダッシュボード用。updatedAt はそのファイルを最後に触ったコミットの日時（無ければ null） */
  list(): Promise<Array<{ key: string; updatedAt: string | null }> | "store_error">;
  history(key: string, limit: number): Promise<HistoryEntry[] | "store_error">;
  readAt(key: string, commit: string): Promise<{ data: unknown } | null | "store_error">;
}

/**
 * ドキュメント1件の直列化。**この形以外にしない**（計画書 §7.13）。
 *
 * GitHub 実装・FS 実装・正規化スクリプトがすべてこれを使うことで、保存のたびに
 * 意味の変わらない整形差分が出るのを防ぐ。`content/*.json` の11件は task_001 で
 * この形に揃えてあり、`scripts/verify-blob-sha.mjs` が維持されていることを確認する。
 */
export function serializeDocument(data: unknown): string {
  return JSON.stringify(data, null, 2) + "\n";
}

/**
 * git のオブジェクトIDと同じ blob SHA-1。`sha1("blob " + バイト長 + "\0" + 内容)`。
 *
 * バイト長は UTF-8 のバイト数（文字数ではない）。計算は **Web Crypto** で行う
 * （`node:crypto` は使わない。Node と workerd の両方で動かすため。`lib/admin/auth.ts` と同じ流儀）。
 * 戻り値は小文字16進40桁で、`git hash-object` および GitHub Contents API の `sha` と一致する。
 */
export async function gitBlobSha(text: string): Promise<string> {
  return gitBlobShaBytes(new TextEncoder().encode(text));
}

/**
 * `gitBlobSha` のバイト列版。
 *
 * ファイルから読んだ生バイト列をそのままハッシュするために要る（文字列へ復号してから
 * 再符号化すると、不正な UTF-8 や BOM を含むファイルで git と値がずれる）。
 */
export async function gitBlobShaBytes(body: Uint8Array): Promise<string> {
  const header = new TextEncoder().encode(`blob ${body.length}\0`);
  const bytes = new Uint8Array(header.length + body.length);
  bytes.set(header, 0);
  bytes.set(body, header.length);

  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 実装の選択（計画書 §7.1 の表。上から順に判定）。
 *
 * | 条件 | 選ぶ実装 |
 * |---|---|
 * | `CONTENT_STORE=fs` | `LocalFsStore` |
 * | `CONTENT_STORE=github`、または `NODE_ENV !== "development"` で `GITHUB_CONTENT_TOKEN` と `GITHUB_CONTENT_REPO` が両方ある | `GitHubStore` |
 * | `NODE_ENV === "development"`（`next dev`） | `LocalFsStore` |
 * | それ以外 | `null`（管理画面は 500 `server_misconfigured`） |
 *
 * **本番ビルドでは明示指定（`CONTENT_STORE=fs`）が無い限り FS 実装を選ばない。**
 * v1 の規則「`VERCEL` が無ければ FS」だと Cloudflare Workers 上で `LocalFsStore` に落ち、
 * `node:fs` へ書けたように見えて次のリクエストで消える。その事故を防ぐための順序。
 */
export function getContentStore(): ContentStore | null {
  const selected = process.env.CONTENT_STORE;

  if (selected === "fs") return new LocalFsStore();

  const hasGitHubEnv = Boolean(process.env.GITHUB_CONTENT_TOKEN && process.env.GITHUB_CONTENT_REPO);
  if (selected === "github" || (process.env.NODE_ENV !== "development" && hasGitHubEnv)) {
    return getGitHubStore();
  }

  if (process.env.NODE_ENV === "development") return new LocalFsStore();

  return null;
}

/**
 * GitHub 実装の組み立て（計画書 §7.10 の環境変数）。
 *
 * `GITHUB_CONTENT_REPO` は `owner/repo` 形式を検証してから URL に埋める（§7.1）。
 * 変数が欠けているか形式が違えば `null` を返し、管理画面は 500 `server_misconfigured` になる。
 * ブランチの既定は `main`。
 */
function getGitHubStore(): ContentStore | null {
  const token = process.env.GITHUB_CONTENT_TOKEN;
  const repo = process.env.GITHUB_CONTENT_REPO;
  if (!token || !repo || !isRepoSlug(repo)) return null;

  return new GitHubStore({ token, repo, branch: process.env.GITHUB_CONTENT_BRANCH || "main" });
}
