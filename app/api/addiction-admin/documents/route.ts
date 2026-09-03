import { requireAdminApi } from "@/lib/admin/session";
import { jsonError, jsonOk } from "@/lib/admin/request";
import { listDocuments } from "@/lib/admin/documents";
import { documentLabel } from "@/lib/content/manifest";

export const dynamic = "force-dynamic";

/** ドキュメント一覧。ダッシュボードの表に出す。 */
export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const documents = await listDocuments();
  if (documents === "misconfigured") return jsonError("server_misconfigured", 500);
  if (documents === "store_error") return jsonError("store_unavailable", 503);

  return jsonOk({
    documents: documents.map((doc) => ({
      key: doc.key,
      label: documentLabel(doc.key),
      updatedAt: doc.updatedAt,
    })),
  });
}
