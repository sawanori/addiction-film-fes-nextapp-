import type { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/session";
import { checkCsrf, jsonError, jsonOk, readJsonObject } from "@/lib/admin/request";
import { readDocument, writeDocument, listHistory } from "@/lib/admin/documents";
import {
  applyOps,
  validateDocument,
  normalizeDocument,
  formatDocument,
  type Op,
} from "@/lib/admin/ops";
import { buildManifest, DOCUMENT_KEYS, type DocumentKey } from "@/lib/content/manifest";
import type { WriteOutcome } from "@/lib/content/store";

export const dynamic = "force-dynamic";

/** 楽観ロックの鍵。GitHub Contents API の blob sha と同じ形（小文字16進40桁）。 */
const SHA_PATTERN = /^[0-9a-f]{40}$/;

function isKnownKey(key: string): key is DocumentKey {
  return (DOCUMENT_KEYS as string[]).includes(key);
}

/**
 * 書き込み失敗を HTTP に写す（計画書 §9）。
 * **ステータスコードの意味は現行のまま**（`DocumentEditor.tsx` はコードだけを見ている）。
 */
function writeFailed(written: Extract<WriteOutcome, { ok: false }>) {
  if (written.reason === "conflict") return jsonError("conflict", 409, { sha: written.sha });
  if (written.reason === "forbidden") return jsonError("forbidden", 403);
  if (written.reason === "not_found") return jsonError("not_found", 404);
  return jsonError("store_unavailable", 503);
}

/** 1件取得。編集フォームの初期表示に使う（manifest と変更履歴も一緒に返す）。 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { key } = await context.params;
  if (!isKnownKey(key)) return jsonError("not_found", 404);

  const stored = await readDocument(key);
  if (stored === "misconfigured") return jsonError("server_misconfigured", 500);
  if (stored === "store_error") return jsonError("store_unavailable", 503);
  if (stored === null) return jsonError("not_found", 404);

  const history = await listHistory(key, 20);
  const entries = history === "store_error" || history === "misconfigured" ? [] : history;

  return jsonOk({
    key: stored.key,
    data: stored.data,
    sha: stored.sha,
    updatedAt: entries[0]?.createdAt ?? null,
    manifest: buildManifest(key, stored.data),
    history: entries,
  });
}

/** 差分適用。全 ops が検証を通ったときだけ保存する。 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const csrf = checkCsrf(request);
  if (csrf) return csrf;

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { key } = await context.params;
  if (!isKnownKey(key)) return jsonError("not_found", 404);

  const body = await readJsonObject(request);
  if (!body) return jsonError("bad_request", 400);

  const baseSha = body.baseSha;
  if (typeof baseSha !== "string" || !SHA_PATTERN.test(baseSha)) return jsonError("bad_request", 400);

  const note = typeof body.note === "string" ? body.note : null;

  // ops の適用には「現在の内容」と manifest が要るので読み出す。
  // ここで sha の比較はしない（競合の判定は保存先が baseSha で行う。計画書 §7.2）。
  const stored = await readDocument(key);
  if (stored === "misconfigured") return jsonError("server_misconfigured", 500);
  if (stored === "store_error") return jsonError("store_unavailable", 503);
  if (stored === null) return jsonError("not_found", 404);

  const applied = applyOps(stored.data, body.ops as Op[], buildManifest(key, stored.data));
  if (!applied.ok) {
    return jsonError("validation_failed", 422, { errors: applied.errors });
  }

  const written = await writeDocument(key, baseSha, applied.data, note);
  if (written === "misconfigured") return jsonError("server_misconfigured", 500);
  if (!written.ok) return writeFailed(written);

  return jsonOk({
    data: applied.data,
    sha: written.sha,
    commit: written.commit,
    createdAt: written.createdAt,
    unchanged: written.unchanged,
  });
}

/**
 * ドキュメント全体の置き換え。管理画面のフォームはこちらを使う。
 *
 * 差分 ops をクライアントで組み立てると、配列の挿入・並べ替えで添字がずれた ops を
 * 作りうる。UI からは編集後のドキュメント全体を送り、サーバ側で manifest と
 * 突き合わせて全リーフを検証する（PATCH の ops 経路はプログラム用に残す）。
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const csrf = checkCsrf(request);
  if (csrf) return csrf;

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { key } = await context.params;
  if (!isKnownKey(key)) return jsonError("not_found", 404);

  const body = await readJsonObject(request);
  if (!body) return jsonError("bad_request", 400);

  const baseSha = body.baseSha;
  if (typeof baseSha !== "string" || !SHA_PATTERN.test(baseSha)) return jsonError("bad_request", 400);
  if (typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) {
    return jsonError("bad_request", 400);
  }

  const note = typeof body.note === "string" ? body.note : null;

  // manifest は**保存されている内容**と同梱JSON（正典）の「形の和」から作る
  // （`lib/content/manifest.ts` の buildManifest 参照）。送られてきた側から作ると
  // 未知のキーが許可リストに入ってしまい、検証が素通りする。
  // 競合の判定はここではしない（保存先が baseSha で行う。計画書 §7.2）。
  const stored = await readDocument(key);
  if (stored === "misconfigured") return jsonError("server_misconfigured", 500);
  if (stored === "store_error") return jsonError("store_unavailable", 503);
  if (stored === null) return jsonError("not_found", 404);

  const manifest = buildManifest(key, stored.data);
  // 改行を揃える → format 付きの欄を整形（動画URL→動画ID）→ 全リーフを検証、の順。
  // 整形を検証より先に置くのは、貼られた動画URLを「不正な値」として弾かないため。
  const next = formatDocument(normalizeDocument(body.data), manifest);
  const errors = validateDocument(next, manifest);
  if (errors.length > 0) return jsonError("validation_failed", 422, { errors });

  const written = await writeDocument(key, baseSha, next, note);
  if (written === "misconfigured") return jsonError("server_misconfigured", 500);
  if (!written.ok) return writeFailed(written);

  return jsonOk({
    data: next,
    sha: written.sha,
    commit: written.commit,
    createdAt: written.createdAt,
    unchanged: written.unchanged,
  });
}
