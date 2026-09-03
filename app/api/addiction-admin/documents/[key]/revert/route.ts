import type { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/session";
import { checkCsrf, jsonError, jsonOk, readJsonObject } from "@/lib/admin/request";
import { readDocument, readRevision, writeDocument } from "@/lib/admin/documents";
import { DOCUMENT_KEYS } from "@/lib/content/manifest";

export const dynamic = "force-dynamic";

/**
 * 指定リビジョンの内容を**新しいリビジョンとして**書き戻す。
 * 履歴そのものは書き換えない（`docs/implementation-plan.md` §9.2）。
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

  const revision = body.revision;
  if (!Number.isInteger(revision)) return jsonError("bad_request", 400);

  const target = await readRevision(key, revision as number);
  if (target === "db_error") return jsonError("db_unavailable", 503);
  if (target === null) return jsonError("not_found", 404);

  const current = await readDocument(key);
  if (current === "db_error") return jsonError("db_unavailable", 503);
  if (current === null) return jsonError("not_found", 404);

  const written = await writeDocument(
    key,
    current.revision,
    target.data,
    `revision ${revision} から復元`
  );
  if (!written.ok) {
    if (written.reason === "conflict") return jsonError("conflict", 409, { revision: current.revision });
    return jsonError("db_unavailable", 503);
  }

  return jsonOk({ data: target.data, revision: written.revision });
}
