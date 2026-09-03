import type { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/session";
import { checkCsrf, jsonError, jsonOk, readJsonObject } from "@/lib/admin/request";
import { readAt, readDocument, writeDocument } from "@/lib/admin/documents";
import { DOCUMENT_KEYS } from "@/lib/content/manifest";

export const dynamic = "force-dynamic";

/** 短縮 SHA も許す。URL に埋める値なので、保存先へ渡す前にここで形を確かめる（計画書 §9.5）。 */
const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/;

/**
 * 指定コミット時点の内容を**新しいコミットとして**書き戻す。
 * 履歴そのものは書き換えない（計画書 §7.7）。
 *
 * 復元する内容には**検証も変換も通さない**。今後書かれる版はすべて保存時に検証済みなので、
 * 過去の版も検証済みである（`docs/plans/trailer-admin/implementation-plan.md` §9.3 の帰納法）。
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const csrf = checkCsrf(request);
  if (csrf) return csrf;

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { key } = await context.params;
  if (!(DOCUMENT_KEYS as string[]).includes(key)) return jsonError("not_found", 404);

  const body = await readJsonObject(request);
  if (!body) return jsonError("bad_request", 400);

  const commit = body.commit;
  if (typeof commit !== "string" || !COMMIT_PATTERN.test(commit)) return jsonError("bad_request", 400);

  const target = await readAt(key, commit);
  if (target === "misconfigured") return jsonError("server_misconfigured", 500);
  if (target === "store_error") return jsonError("store_unavailable", 503);
  // そのコミットに当該ファイルが無い場合と、履歴を持たないローカル FS 実装。
  if (target === null) return jsonError("not_found", 404);

  const current = await readDocument(key);
  if (current === "misconfigured") return jsonError("server_misconfigured", 500);
  if (current === "store_error") return jsonError("store_unavailable", 503);
  if (current === null) return jsonError("not_found", 404);

  const short = commit.slice(0, 7);
  // コミットメッセージの1行目は保存先が組み立てる。ここで渡すのは本文（メモ）だけ。
  const written = await writeDocument(key, current.sha, target.data, `${short} から復元`);
  if (written === "misconfigured") return jsonError("server_misconfigured", 500);
  if (!written.ok) {
    if (written.reason === "conflict") return jsonError("conflict", 409, { sha: written.sha });
    if (written.reason === "forbidden") return jsonError("forbidden", 403);
    if (written.reason === "not_found") return jsonError("not_found", 404);
    return jsonError("store_unavailable", 503);
  }

  return jsonOk({
    data: target.data,
    sha: written.sha,
    commit: written.commit,
    createdAt: written.createdAt,
  });
}
