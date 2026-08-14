"use client";

import { useState } from "react";
import Link from "next/link";
import type { DocumentManifest } from "@/lib/content/manifest-core";
import FieldEditor from "./FieldEditor";

type Revision = { revision: number; note: string | null; createdAt: string };

/** 具体パス（`price.rows.3.type`）で値を差し替えた新しいオブジェクトを返す。 */
function setAtPath(root: unknown, path: string, value: unknown): unknown {
  const segments = path.split(".");

  const walk = (current: unknown, depth: number): unknown => {
    if (depth === segments.length) return value;

    const segment = segments[depth];
    if (Array.isArray(current)) {
      const index = Number(segment);
      const next = current.slice();
      next[index] = walk(current[index], depth + 1);
      return next;
    }
    const record = (current ?? {}) as Record<string, unknown>;
    return { ...record, [segment]: walk(record[segment], depth + 1) };
  };

  return walk(root, 0);
}

export default function DocumentEditor({
  docKey,
  label,
  manifest,
  initialData,
  initialRevision,
  initialRevisions,
  publicPath,
}: {
  docKey: string;
  label: string;
  manifest: DocumentManifest;
  initialData: unknown;
  initialRevision: number;
  initialRevisions: Revision[];
  publicPath: string | null;
}) {
  const [data, setData] = useState<unknown>(initialData);
  const [revision, setRevision] = useState(initialRevision);
  const [revisions, setRevisions] = useState<Revision[]>(initialRevisions);
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [busy, setBusy] = useState(false);

  const handleChange = (path: string, value: unknown) => {
    setData((current: unknown) => setAtPath(current, path, value));
    setDirty(true);
    setStatus(null);
  };

  async function save() {
    setBusy(true);
    setErrors([]);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/documents/${docKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-aff-admin": "1" },
        body: JSON.stringify({ baseRevision: revision, data, note: note || null }),
      });
      const body: unknown = await res.json().catch(() => null);

      if (res.ok && body && typeof body === "object") {
        const result = body as { revision: number; data: unknown };
        setRevision(result.revision);
        setData(result.data);
        setDirty(false);
        setNote("");
        setRevisions((current) => [
          { revision: result.revision, note: note || null, createdAt: new Date().toISOString() },
          ...current,
        ]);
        setStatus(`保存しました（版 ${result.revision}）`);
        return;
      }

      if (res.status === 409) {
        setStatus("他の場所で更新されています。ページを再読み込みしてから編集し直してください。");
        return;
      }
      if (res.status === 422 && body && typeof body === "object" && "errors" in body) {
        setErrors((body as { errors: Array<{ path: string; message: string }> }).errors);
        setStatus("入力に問題があります。");
        return;
      }
      setStatus(`保存に失敗しました（${res.status}）`);
    } catch {
      setStatus("保存に失敗しました（通信エラー）");
    } finally {
      setBusy(false);
    }
  }

  async function revert(target: number) {
    if (!confirm(`版 ${target} の内容に戻します。よろしいですか？`)) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/documents/${docKey}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-aff-admin": "1" },
        body: JSON.stringify({ revision: target }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (res.ok && body && typeof body === "object") {
        const result = body as { revision: number; data: unknown };
        setRevision(result.revision);
        setData(result.data);
        setDirty(false);
        setRevisions((current) => [
          { revision: result.revision, note: `revision ${target} から復元`, createdAt: new Date().toISOString() },
          ...current,
        ]);
        setStatus(`版 ${target} の内容に戻しました（新しい版 ${result.revision}）`);
        return;
      }
      setStatus(`復元に失敗しました（${res.status}）`);
    } catch {
      setStatus("復元に失敗しました（通信エラー）");
    } finally {
      setBusy(false);
    }
  }

  const record = (data ?? {}) as Record<string, unknown>;

  return (
    <main className="adm__page">
      <header className="adm__bar">
        <div>
          <Link className="adm__link" href="/admin">
            ← 一覧
          </Link>
          <h1 className="adm__title">{label}</h1>
          <p className="adm__meta">
            キー <code>{docKey}</code> / 版 {revision}
            {publicPath ? (
              <>
                {" / "}
                <a className="adm__link" href={publicPath} target="_blank" rel="noreferrer">
                  公開ページを開く
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className="adm__save">
          <input
            className="adm__field"
            type="text"
            placeholder="変更メモ（任意）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="adm__button" type="button" onClick={save} disabled={!dirty || busy}>
            {dirty ? "保存" : "変更なし"}
          </button>
        </div>
      </header>

      {status ? <p className="adm__status">{status}</p> : null}
      {errors.length > 0 ? (
        <ul className="adm__error">
          {errors.map((e) => (
            <li key={`${e.path}:${e.message}`}>
              <code>{e.path}</code> {e.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="adm__form">
        {manifest.fields.map((field) => (
          <FieldEditor
            key={field.path}
            field={field}
            value={record[field.path]}
            path={field.path}
            onChange={handleChange}
          />
        ))}
      </div>

      <section className="adm__history">
        <h2 className="adm__legend">リビジョン履歴</h2>
        <table className="adm__table">
          <thead>
            <tr>
              <th>版</th>
              <th>日時</th>
              <th>メモ</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {revisions.map((r) => (
              <tr key={r.revision}>
                <td>{r.revision}</td>
                <td>{r.createdAt.replace("T", " ").slice(0, 19)}</td>
                <td>{r.note ?? ""}</td>
                <td>
                  {r.revision === revision ? (
                    <span className="adm__meta">現在</span>
                  ) : (
                    <button type="button" className="adm__mini" onClick={() => revert(r.revision)} disabled={busy}>
                      この版に戻す
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
