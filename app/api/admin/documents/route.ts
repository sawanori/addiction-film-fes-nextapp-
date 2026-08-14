import { requireAdminApi } from "@/lib/admin/session";
import { jsonError, jsonOk } from "@/lib/admin/request";
import { getDbClient } from "@/lib/db";
import { documentLabel } from "@/lib/content/manifest";

export const dynamic = "force-dynamic";

/** ドキュメント一覧。ダッシュボードの表に出す。 */
export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const client = getDbClient();
  if (!client) return jsonError("server_misconfigured", 500);

  try {
    const { rows } = await client.execute(
      "SELECT key, revision, updated_at FROM content_documents ORDER BY key"
    );
    return jsonOk({
      documents: rows.map((row) => ({
        key: String(row.key),
        label: documentLabel(String(row.key)),
        revision: Number(row.revision),
        updatedAt: String(row.updated_at),
      })),
    });
  } catch {
    return jsonError("db_unavailable", 503);
  }
}
