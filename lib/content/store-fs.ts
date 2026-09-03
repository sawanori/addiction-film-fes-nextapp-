import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { DOCUMENT_KEYS } from "@/lib/content/manifest";
import {
  gitBlobSha,
  gitBlobShaBytes,
  serializeDocument,
  type ContentStore,
  type HistoryEntry,
  type StoredDocument,
  type WriteOutcome,
} from "@/lib/content/store";

/**
 * ローカルファイルシステム実装（計画書 §7.12）。
 *
 * `content/<key>.json` を `node:fs` で直接読み書きする。`next dev` の既定であり、
 * `npm start` をローカルで動かして管理画面を試すときは `CONTENT_STORE=fs` で明示する。
 * 保存すると作業ツリーの `content/*.json` が書き換わる。**試し書きを戻すのは
 * `git checkout -- content/`**。
 */

/** キーは必ずこの集合で検証してからパスに使う（外部入力をそのまま連結しない）。 */
const KNOWN_KEYS: ReadonlySet<string> = new Set<string>(DOCUMENT_KEYS);

function contentPath(key: string): string | null {
  if (!KNOWN_KEYS.has(key)) return null;
  return path.join(process.cwd(), "content", `${key}.json`);
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "ENOENT";
}

/** ファイルの生バイト列。無ければ `"missing"`、読めなければ `"error"`。 */
async function readBytes(file: string): Promise<Buffer | "missing" | "error"> {
  try {
    return await readFile(file);
  } catch (error) {
    return isNotFound(error) ? "missing" : "error";
  }
}

export class LocalFsStore implements ContentStore {
  async read(key: string): Promise<StoredDocument | null | "store_error"> {
    const file = contentPath(key);
    if (file === null) return null;

    const bytes = await readBytes(file);
    if (bytes === "missing") return null;
    if (bytes === "error") return "store_error";

    let data: unknown;
    try {
      data = JSON.parse(bytes.toString("utf8"));
    } catch {
      return "store_error";
    }
    // sha は**ファイルの生バイト列**に対して取る（`git hash-object <file>` と同じ値）。
    return { key, data, sha: await gitBlobShaBytes(bytes) };
  }

  /**
   * 楽観ロック付きの書き込み。`note` は受け取らない（FS 実装はコミットを作らないので使い道がない）。
   * 引数を減らしても `ContentStore` は満たす。
   */
  async write(key: string, baseSha: string, data: unknown): Promise<WriteOutcome> {
    const file = contentPath(key);
    if (file === null) return { ok: false, reason: "not_found" };

    const current = await readBytes(file);
    if (current === "missing") return { ok: false, reason: "not_found" };
    if (current === "error") return { ok: false, reason: "store" };

    const currentSha = await gitBlobShaBytes(current);
    if (currentSha !== baseSha) return { ok: false, reason: "conflict", sha: currentSha };

    const createdAt = new Date().toISOString();
    const text = serializeDocument(data);
    const next = Buffer.from(text, "utf8");

    // 直列化した結果が現在のファイルと**バイト単位で同一**なら書かない（計画書 §7.2）。
    if (current.equals(next)) {
      return { ok: true, sha: baseSha, commit: null, createdAt, unchanged: true };
    }

    try {
      await writeFile(file, next);
    } catch {
      return { ok: false, reason: "store" };
    }
    return { ok: true, sha: await gitBlobSha(text), commit: null, createdAt, unchanged: false };
  }

  async list(): Promise<Array<{ key: string; updatedAt: string | null }> | "store_error"> {
    const entries: Array<{ key: string; updatedAt: string | null }> = [];
    for (const key of DOCUMENT_KEYS) {
      const file = contentPath(key);
      // 履歴が無いので updatedAt はファイルの mtime。ファイルが無ければ null。
      let updatedAt: string | null = null;
      if (file !== null) {
        try {
          updatedAt = (await stat(file)).mtime.toISOString();
        } catch {
          updatedAt = null;
        }
      }
      entries.push({ key, updatedAt });
    }
    return entries;
  }

  /**
   * ローカルでは履歴表は空、復元は 404（計画書 §7.12）。
   * `git log` を子プロセスで叩く案は採らない（Next のサーバに子プロセスを持ち込まない）。
   */
  async history(): Promise<HistoryEntry[]> {
    return [];
  }

  /** 履歴を持たないので過去版も引けない（`history()` と同じ理由）。 */
  async readAt(): Promise<{ data: unknown } | null | "store_error"> {
    return null;
  }
}
