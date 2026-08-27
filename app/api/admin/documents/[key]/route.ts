import type { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/session";
import { checkCsrf, jsonError, jsonOk, readJsonObject } from "@/lib/admin/request";
import { readDocument, writeDocument, listRevisions } from "@/lib/admin/documents";
import {
  applyOps,
  validateDocument,
  normalizeDocument,
  formatDocument,
  type Op,
} from "@/lib/admin/ops";
import { buildManifest, DOCUMENT_KEYS, type DocumentKey } from "@/lib/content/manifest";

export const dynamic = "force-dynamic";

function isKnownKey(key: string): key is DocumentKey {
  return (DOCUMENT_KEYS as string[]).includes(key);
}

/** 1件取得。編集フォームの初期表示に使う（manifest とリビジョン履歴も一緒に返す）。 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { key } = await context.params;
  if (!isKnownKey(key)) return jsonError("not_found", 404);

  const stored = await readDocument(key);
  if (stored === "db_error") return jsonError("db_unavailable", 503);
  if (stored === null) return jsonError("not_found", 404);

  const revisions = await listRevisions(key);

  return jsonOk({
    key: stored.key,
    data: stored.data,
    revision: stored.revision,
    updatedAt: stored.updatedAt,
    manifest: buildManifest(key, stored.data),
    revisions: revisions === "db_error" ? [] : revisions,
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

  const baseRevision = body.baseRevision;
  if (!Number.isInteger(baseRevision)) return jsonError("bad_request", 400);

  const note = typeof body.note === "string" ? body.note : null;

  const stored = await readDocument(key);
  if (stored === "db_error") return jsonError("db_unavailable", 503);
  if (stored === null) return jsonError("not_found", 404);

  if (stored.revision !== baseRevision) {
    return jsonError("conflict", 409, { revision: stored.revision });
  }

  const applied = applyOps(stored.data, body.ops as Op[], buildManifest(key, stored.data));
  if (!applied.ok) {
    return jsonError("validation_failed", 422, { errors: applied.errors });
  }

  const written = await writeDocument(key, stored.revision, applied.data, note);
  if (!written.ok) {
    if (written.reason === "conflict") {
      const latest = await readDocument(key);
      return jsonError("conflict", 409, {
        revision: latest && latest !== "db_error" ? latest.revision : undefined,
      });
    }
    return jsonError("db_unavailable", 503);
  }

  return jsonOk({ data: applied.data, revision: written.revision });
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

  const baseRevision = body.baseRevision;
  if (!Number.isInteger(baseRevision)) return jsonError("bad_request", 400);
  if (typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) {
    return jsonError("bad_request", 400);
  }

  const note = typeof body.note === "string" ? body.note : null;

  const stored = await readDocument(key);
  if (stored === "db_error") return jsonError("db_unavailable", 503);
  if (stored === null) return jsonError("not_found", 404);

  if (stored.revision !== baseRevision) {
    return jsonError("conflict", 409, { revision: stored.revision });
  }

  const manifest = buildManifest(key, stored.data);
  // 改行を揃える → format 付きの欄を整形（動画URL→動画ID）→ 全リーフを検証、の順。
  // 整形を検証より先に置くのは、貼られた動画URLを「不正な値」として弾かないため。
  const next = formatDocument(normalizeDocument(body.data), manifest);
  const errors = validateDocument(next, manifest);
  if (errors.length > 0) return jsonError("validation_failed", 422, { errors });

  const written = await writeDocument(key, stored.revision, next, note);
  if (!written.ok) {
    if (written.reason === "conflict") return jsonError("conflict", 409, { revision: stored.revision });
    return jsonError("db_unavailable", 503);
  }

  return jsonOk({ data: next, revision: written.revision });
}
