import { getDbClient } from "@/lib/db";

/**
 * 管理APIから見たドキュメントの読み書き。
 *
 * 書き込みは**楽観ロック**（`WHERE key = ? AND revision = ?`）で、更新とリビジョン記録を
 * `client.batch(..., "write")` の1トランザクションで行う。リビジョン記録側は
 * 「更新後の revision を持つ行」を SELECT して INSERT するので、UPDATE が0行だった場合は
 * 何も挿入されない（＝競合時に履歴だけ増える事故が起きない）。
 */

export type StoredDocument = {
  key: string;
  data: unknown;
  revision: number;
  updatedAt: string;
};

export type WriteOutcome =
  | { ok: true; revision: number }
  | { ok: false; reason: "conflict" | "not_found" | "db" };

export async function readDocument(key: string): Promise<StoredDocument | null | "db_error"> {
  const client = getDbClient();
  if (!client) return "db_error";

  try {
    const { rows } = await client.execute({
      sql: "SELECT key, data, revision, updated_at FROM content_documents WHERE key = ?",
      args: [key],
    });
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      key: String(row.key),
      data: JSON.parse(String(row.data)),
      revision: Number(row.revision),
      updatedAt: String(row.updated_at),
    };
  } catch {
    return "db_error";
  }
}

export async function readRevision(
  key: string,
  revision: number
): Promise<{ data: unknown; note: string | null; createdAt: string } | null | "db_error"> {
  const client = getDbClient();
  if (!client) return "db_error";

  try {
    const { rows } = await client.execute({
      sql: "SELECT data, note, created_at FROM content_revisions WHERE doc_key = ? AND revision = ?",
      args: [key, revision],
    });
    if (rows.length === 0) return null;
    return {
      data: JSON.parse(String(rows[0].data)),
      note: rows[0].note === null ? null : String(rows[0].note),
      createdAt: String(rows[0].created_at),
    };
  } catch {
    return "db_error";
  }
}

export async function listRevisions(
  key: string
): Promise<Array<{ revision: number; note: string | null; createdAt: string }> | "db_error"> {
  const client = getDbClient();
  if (!client) return "db_error";

  try {
    const { rows } = await client.execute({
      sql: "SELECT revision, note, created_at FROM content_revisions WHERE doc_key = ? ORDER BY revision DESC",
      args: [key],
    });
    return rows.map((row) => ({
      revision: Number(row.revision),
      note: row.note === null ? null : String(row.note),
      createdAt: String(row.created_at),
    }));
  } catch {
    return "db_error";
  }
}

/** 楽観ロック付きの書き込み。成功したら新しい revision を返す。 */
export async function writeDocument(
  key: string,
  baseRevision: number,
  data: unknown,
  note: string | null
): Promise<WriteOutcome> {
  const client = getDbClient();
  if (!client) return { ok: false, reason: "db" };

  const nextRevision = baseRevision + 1;
  const serialized = JSON.stringify(data);

  try {
    const results = await client.batch(
      [
        {
          sql: `UPDATE content_documents
                SET data = ?, revision = revision + 1,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
                WHERE key = ? AND revision = ?`,
          args: [serialized, key, baseRevision],
        },
        {
          sql: `INSERT INTO content_revisions (doc_key, revision, data, note)
                SELECT key, revision, data, ?
                FROM content_documents
                WHERE key = ? AND revision = ?`,
          args: [note, key, nextRevision],
        },
      ],
      "write"
    );

    const updated = Number(results[0]?.rowsAffected ?? 0);
    if (updated === 0) return { ok: false, reason: "conflict" };
    return { ok: true, revision: nextRevision };
  } catch {
    return { ok: false, reason: "db" };
  }
}
