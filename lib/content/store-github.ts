import { DOCUMENT_KEYS } from "@/lib/content/manifest";
import {
  serializeDocument,
  type ContentStore,
  type HistoryEntry,
  type StoredDocument,
  type WriteOutcome,
} from "@/lib/content/store";

/**
 * GitHub 実装（計画書 §7.1・§7.2・§7.6・§7.7・§7.11）。
 *
 * `content/<key>.json` を GitHub の Contents API / Commits API 越しに読み書きする。
 * 保存は「1保存 = 1コミット」で、Vercel の本番デプロイがそれを追いかける（§7.8）。
 *
 * 検証用ブランチ `cms-staging` に対する実測（2026-09-03）:
 *
 * | 試したこと | 応答 |
 * |---|---|
 * | GET `contents/content/news.json?ref=cms-staging` | 200。`sha`(blob) と base64 の `content` が1往復で揃う |
 * | 正しい `sha` で PUT（更新） | **200**（201 ではない）。`content.sha` / `commit.sha` / `commit.committer.date` が返る |
 * | 古い `sha` で PUT | **409** `content/news.json does not match <sha>` |
 * | 存在しないパスへ `sha` 無しで PUT（新規作成） | **201** |
 *
 * 409 は「ほかで先に保存された」か「同一リポジトリへの並行 PUT による ref 衝突」の
 * どちらかで、区別は読み直した blob sha でつける（§7.2）。
 */

const API_ORIGIN = "https://api.github.com";

/** GitHub が止まったときに管理画面のリクエストが関数上限までぶら下がるのを防ぐ（§7.1）。 */
const TIMEOUT_MS = 10_000;

/** コミットメッセージの本文に載せる `note` の上限（§7.7）。 */
const NOTE_MAX_LENGTH = 500;

/** Commits API の `per_page` の上限。 */
const PER_PAGE_MAX = 100;

/** キーは必ずこの集合で検証してからパスに使う（`store-fs.ts` と同じ規律）。 */
const KNOWN_KEYS: ReadonlySet<string> = new Set<string>(DOCUMENT_KEYS);

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** `readAt` に渡ってくるコミット指定。短縮 SHA も許す。 */
const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/;

/** `owner/repo` 形式か。URL に埋める前に必ず通す（§7.1）。 */
export function isRepoSlug(value: string): boolean {
  return REPO_PATTERN.test(value);
}

function contentPath(key: string): string | null {
  if (!KNOWN_KEYS.has(key)) return null;
  return `content/${key}.json`;
}

/**
 * コミットメッセージ（§7.7）。
 *
 * ```
 * content(films): 管理画面から更新
 *
 * <メモ欄の文字列>
 * ```
 *
 * **`note` の加工はここだけで行う。** 計画書 §8.4 の「保存時に文字列を加工しない」は
 * *保存されるデータ* の規約で、コミットメッセージはその対象外。
 */
function buildMessage(key: string, note: string | null): string {
  const head = `content(${key}): 管理画面から更新`;
  const body = sanitizeNote(note);
  return body === "" ? head : `${head}\n\n${body}`;
}

/** 制御文字（U+0000–U+001F と U+007F。ただし改行 `\n` = U+000A は残す）を除いて 500 文字で切る。 */
function sanitizeNote(note: string | null): string {
  if (note === null) return "";
  // U+000A（`\n`）だけ範囲から外して残す。
  return note.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").slice(0, NOTE_MAX_LENGTH);
}

/** コミットメッセージの「最初の空行より後」。無ければ null（§7.7）。 */
function extractNote(message: string): string | null {
  const normalized = message.replace(/\r\n/g, "\n");
  const separator = normalized.indexOf("\n\n");
  if (separator === -1) return null;
  const body = normalized.slice(separator + 2).replace(/\n+$/, "");
  return body === "" ? null : body;
}

type ApiResponse = { status: number; body: unknown };

/** ネットワーク例外・タイムアウト・5xx は呼び出し側で `store_error` に倒す。 */
type ApiResult = ApiResponse | "error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Contents API の応答から必要な3つを取り出す。想定外の形なら null。 */
function parseFileResponse(body: unknown): { text: string; sha: string } | null {
  if (!isRecord(body)) return null;
  const { content, encoding, sha } = body;
  if (typeof content !== "string" || typeof sha !== "string") return null;
  if (encoding !== "base64") return null;
  // base64 は 60 桁ごとに改行が入って返る。
  const text = Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
  return { text, sha };
}

/** Commits API の1要素から `{commit, note, createdAt}` を組み立てる。想定外の形なら null。 */
function parseCommitEntry(entry: unknown): HistoryEntry | null {
  if (!isRecord(entry)) return null;
  const sha = entry.sha;
  const commit = entry.commit;
  if (typeof sha !== "string" || !isRecord(commit)) return null;

  const committer = commit.committer;
  const createdAt = isRecord(committer) && typeof committer.date === "string" ? committer.date : null;
  if (createdAt === null) return null;

  const message = typeof commit.message === "string" ? commit.message : "";
  return { commit: sha, note: extractNote(message), createdAt };
}

export class GitHubStore implements ContentStore {
  private readonly token: string;
  private readonly repo: string;
  private readonly branch: string;

  constructor(options: { token: string; repo: string; branch: string }) {
    this.token = options.token;
    this.repo = options.repo;
    this.branch = options.branch;
  }

  async read(key: string): Promise<StoredDocument | null | "store_error"> {
    const path = contentPath(key);
    if (path === null) return null;

    const file = await this.fetchFile(path, this.branch);
    if (file === "error") return "store_error";
    if (file === null) return null;

    let data: unknown;
    try {
      data = JSON.parse(file.text);
    } catch {
      return "store_error";
    }
    return { key, data, sha: file.sha };
  }

  async write(key: string, baseSha: string, data: unknown, note: string | null): Promise<WriteOutcome> {
    // Preview 環境からは書かせない（§7.6 の3枚重ねのうちコード側の1枚）。
    if (process.env.VERCEL_ENV === "preview") return { ok: false, reason: "forbidden" };

    const path = contentPath(key);
    if (path === null) return { ok: false, reason: "not_found" };

    const current = await this.fetchFile(path, this.branch);
    if (current === "error") return { ok: false, reason: "store" };
    if (current === null) return { ok: false, reason: "not_found" };

    const text = serializeDocument(data);
    // 直列化した結果が現在の内容と同一ならコミットしない（§7.2「変更なし」の扱い）。
    // 返す sha は読み直した現在値。baseSha が古くても内容が同じなら「保存するものが無い」だけなので
    // 呼び出し側には最新の sha を持たせ、次の本当の保存で無駄な 409 往復を起こさない。
    if (current.text === text) {
      return { ok: true, sha: current.sha, commit: null, createdAt: new Date().toISOString(), unchanged: true };
    }

    const put = await this.putFile(path, text, baseSha, buildMessage(key, note));
    if (put !== "conflict") return put;

    // 409。読み直した blob sha が baseSha と同じなら並行 PUT による ref 衝突なので1回だけ再試行。
    // 違えば、ほかで先に保存されたということ（§7.2 (a)(b)）。
    const latest = await this.fetchFile(path, this.branch);
    if (latest === "error") return { ok: false, reason: "store" };
    if (latest === null) return { ok: false, reason: "not_found" };
    if (latest.sha !== baseSha) return { ok: false, reason: "conflict", sha: latest.sha };

    const retry = await this.putFile(path, text, baseSha, buildMessage(key, note));
    if (retry === "conflict") return { ok: false, reason: "conflict", sha: latest.sha };
    return retry;
  }

  async list(): Promise<Array<{ key: string; updatedAt: string | null }> | "store_error"> {
    // 11本並列。認証済みの上限（5,000/h・同時100）に対して十分小さい（§7.11）。
    return Promise.all(
      DOCUMENT_KEYS.map(async (key) => ({ key, updatedAt: await this.lastCommitDate(key) })),
    );
  }

  async history(key: string, limit: number): Promise<HistoryEntry[] | "store_error"> {
    const entries = await this.fetchCommits(key, limit);
    if (entries === "error") return "store_error";
    return entries;
  }

  async readAt(key: string, commit: string): Promise<{ data: unknown } | null | "store_error"> {
    const path = contentPath(key);
    if (path === null) return null;
    if (!COMMIT_PATTERN.test(commit)) return null;

    const file = await this.fetchFile(path, commit);
    if (file === "error") return "store_error";
    if (file === null) return null;

    try {
      return { data: JSON.parse(file.text) };
    } catch {
      return "store_error";
    }
  }

  /** ファイル1件の生テキストと blob sha。404 は null、通信断・5xx・想定外の形は `"error"`。 */
  private async fetchFile(path: string, ref: string): Promise<{ text: string; sha: string } | null | "error"> {
    const url = `${API_ORIGIN}/repos/${this.repo}/contents/${path}?ref=${encodeURIComponent(ref)}`;
    const result = await this.request(url);
    if (result === "error") return "error";
    if (result.status === 404) return null;
    if (result.status !== 200) return "error";
    return parseFileResponse(result.body) ?? "error";
  }

  /** PUT 1回ぶん。409 だけは呼び出し側で分岐させるため文字列で返す。 */
  private async putFile(
    path: string,
    text: string,
    baseSha: string,
    message: string,
  ): Promise<WriteOutcome | "conflict"> {
    const url = `${API_ORIGIN}/repos/${this.repo}/contents/${path}`;
    // author / committer は付けない。トークン所有者になる（§7.6）。
    const payload = {
      message,
      content: Buffer.from(text, "utf8").toString("base64"),
      sha: baseSha,
      branch: this.branch,
    };

    const result = await this.request(url, { method: "PUT", body: JSON.stringify(payload) });
    if (result === "error") return { ok: false, reason: "store" };
    if (result.status === 409) return "conflict";
    if (result.status === 404) return { ok: false, reason: "not_found" };
    if (result.status !== 200 && result.status !== 201) return { ok: false, reason: "store" };

    const body = result.body;
    if (!isRecord(body) || !isRecord(body.content) || !isRecord(body.commit)) {
      return { ok: false, reason: "store" };
    }
    const sha = body.content.sha;
    const commit = body.commit.sha;
    const committer = body.commit.committer;
    const createdAt = isRecord(committer) && typeof committer.date === "string" ? committer.date : null;
    if (typeof sha !== "string" || typeof commit !== "string" || createdAt === null) {
      return { ok: false, reason: "store" };
    }
    return { ok: true, sha, commit, createdAt, unchanged: false };
  }

  private async fetchCommits(key: string, limit: number): Promise<HistoryEntry[] | "error"> {
    const path = contentPath(key);
    if (path === null) return [];

    const perPage = Math.min(Math.max(Math.trunc(limit), 1), PER_PAGE_MAX);
    const url =
      `${API_ORIGIN}/repos/${this.repo}/commits` +
      `?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(this.branch)}&per_page=${perPage}`;

    const result = await this.request(url);
    if (result === "error") return "error";
    // ブランチもファイルも無ければ 404 / 409 が返りうる。履歴が無いのと同じ扱い。
    if (result.status === 404 || result.status === 409) return [];
    if (result.status !== 200 || !Array.isArray(result.body)) return "error";

    const entries: HistoryEntry[] = [];
    for (const raw of result.body) {
      const entry = parseCommitEntry(raw);
      if (entry !== null) entries.push(entry);
    }
    return entries;
  }

  /** 一覧の「最終更新」。取れなければ null（§7.11。ここでは 1件でも落ちたら全体を落とす、はしない）。 */
  private async lastCommitDate(key: string): Promise<string | null> {
    const entries = await this.fetchCommits(key, 1);
    if (entries === "error") return null;
    return entries[0]?.createdAt ?? null;
  }

  private async request(url: string, init?: { method: string; body: string }): Promise<ApiResult> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "addiction-film-fes-admin",
    };
    if (init !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetch(url, {
        method: init?.method ?? "GET",
        body: init?.body,
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // タイムアウト（AbortSignal.timeout）とネットワーク例外はここ。
      return "error";
    }

    if (response.status >= 500) return "error";

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }
}
