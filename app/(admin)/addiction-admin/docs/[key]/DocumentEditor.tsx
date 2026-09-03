"use client";

import { useEffect, useMemo, useState } from "react";
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

function formatDateTime(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

/** セクションに入力欄がいくつあるか（目次に出す）。 */
function countInputs(field: import("@/lib/content/manifest-core").Field): number {
  if (field.type === "group") return field.fields.reduce((sum, f) => sum + countInputs(f), 0);
  if (field.type === "array") return countInputs(field.item);
  return 1;
}

export default function DocumentEditor({
  docKey,
  label,
  description,
  manifest,
  initialData,
  initialRevision,
  initialRevisions,
  publicPath,
}: {
  docKey: string;
  label: string;
  description: string;
  manifest: DocumentManifest;
  initialData: unknown;
  initialRevision: number;
  initialRevisions: Revision[];
  publicPath: string | null;
}) {
  const [data, setData] = useState<unknown>(initialData);
  const [activeSection, setActiveSection] = useState<string>(manifest.fields[0]?.path ?? "");
  const [revision, setRevision] = useState(initialRevision);
  const [revisions, setRevisions] = useState<Revision[]>(initialRevisions);
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ text: string; warn?: boolean } | null>(null);
  const [errors, setErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [busy, setBusy] = useState(false);

  // 保存し忘れたままページを離れようとしたら引き止める
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // どのセクションを直したかを目次に出す（長いドキュメントで迷子にならないように）
  const changedSections = useMemo(() => {
    const before = (initialData ?? {}) as Record<string, unknown>;
    const after = (data ?? {}) as Record<string, unknown>;
    const changed = new Set<string>();
    for (const field of manifest.fields) {
      if (JSON.stringify(before[field.path]) !== JSON.stringify(after[field.path])) {
        changed.add(field.path);
      }
    }
    return changed;
  }, [data, initialData, manifest.fields]);

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
      const res = await fetch(`/api/addiction-admin/documents/${docKey}`, {
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
        setRevisions((current) => [
          { revision: result.revision, note: note || null, createdAt: new Date().toISOString() },
          ...current,
        ]);
        setNote("");
        setStatus({ text: `保存しました。公開ページにすぐ反映されています（版 ${result.revision}）` });
        return;
      }

      if (res.status === 409) {
        setStatus({ text: "ほかの場所で先に保存されています。ページを再読み込みしてから編集し直してください。", warn: true });
        return;
      }
      if (res.status === 422 && body && typeof body === "object" && "errors" in body) {
        setErrors((body as { errors: Array<{ path: string; message: string }> }).errors);
        setStatus({ text: "入力に問題があるので保存していません。下の一覧を確認してください。", warn: true });
        return;
      }
      setStatus({ text: `保存できませんでした（エラー ${res.status}）`, warn: true });
    } catch {
      setStatus({ text: "保存できませんでした（通信エラー）。もう一度お試しください。", warn: true });
    } finally {
      setBusy(false);
    }
  }

  async function revert(target: number) {
    if (!confirm(`版 ${target} の内容に戻します。いまの内容は履歴に残ります。よろしいですか？`)) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/addiction-admin/documents/${docKey}/revert`, {
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
          { revision: result.revision, note: `版 ${target} から復元`, createdAt: new Date().toISOString() },
          ...current,
        ]);
        setStatus({ text: `版 ${target} の内容に戻しました（新しい版 ${result.revision}）` });
        return;
      }
      setStatus({ text: `戻せませんでした（エラー ${res.status}）`, warn: true });
    } catch {
      setStatus({ text: "戻せませんでした（通信エラー）", warn: true });
    } finally {
      setBusy(false);
    }
  }

  const record = (data ?? {}) as Record<string, unknown>;

  return (
    <>
      <div className="adm__topbar">
        <div className="adm__topbar-inner">
          <div className="adm__brand">
            <p className="adm__brand-title">{label}</p>
            <span className="adm__brand-sub">
              版 {revision}
              {publicPath ? " ・ 保存すると公開ページにすぐ反映されます" : " ・ すべてのページに影響します"}
            </span>
          </div>
          <div className="adm__savebar">
            {dirty ? <span className="adm__dirty">未保存の変更あり</span> : null}
            <input
              className="adm__field"
              type="text"
              placeholder="変更メモ（任意）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button className="adm__button" type="button" onClick={save} disabled={!dirty || busy}>
              {busy ? "保存中…" : dirty ? "保存する" : "保存済み"}
            </button>
          </div>
        </div>
      </div>

      <main className="adm__page">
        <p className="adm__lead">
          <Link href="/addiction-admin">← 一覧にもどる</Link>
          {publicPath ? (
            <>
              {" ・ "}
              <a href={publicPath} target="_blank" rel="noreferrer">
                公開ページを別タブで開く
              </a>
            </>
          ) : null}
        </p>

        {status ? (
          <p className={status.warn ? "adm__status adm__status--warn" : "adm__status"}>{status.text}</p>
        ) : null}

        {errors.length > 0 ? (
          <ul className="adm__error">
            {errors.map((e) => (
              <li key={`${e.path}:${e.message}`}>
                {e.message}（<code>{e.path}</code>）
              </li>
            ))}
          </ul>
        ) : null}

        <p className="adm__note">
          {description}
          <br />
          左の一覧から直したい部分を選んでください。文字を直したら右上の「保存する」を押します。
          保存するたびに履歴が残るので、いつでも前の内容に戻せます。
        </p>

        <div className="adm__layout">
          <nav className="adm__rail" aria-label="編集する部分">
            <p className="adm__rail-title">このページの構成</p>
            <ul className="adm__rail-list">
              {manifest.fields.map((field) => {
                const isActive = field.path === activeSection;
                const count =
                  field.type === "array" && Array.isArray(record[field.path])
                    ? `${(record[field.path] as unknown[]).length}件`
                    : `${countInputs(field)}項目`;
                return (
                  <li key={field.path}>
                    <button
                      type="button"
                      className={isActive ? "adm__rail-item adm__rail-item--on" : "adm__rail-item"}
                      onClick={() => setActiveSection(field.path)}
                      aria-current={isActive ? "true" : undefined}
                    >
                      <span className="adm__rail-label">{field.label}</span>
                      <span className="adm__rail-count">{count}</span>
                      {changedSections.has(field.path) ? (
                        <span className="adm__rail-dot" title="未保存の変更があります" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="adm__form">
            {manifest.fields
              .filter((field) => field.path === activeSection)
              .map((field) => (
                <FieldEditor
                  key={field.path}
                  field={field}
                  value={record[field.path]}
                  path={field.path}
                  onChange={handleChange}
                />
              ))}
          </div>
        </div>

        <h2 className="adm__h2">変更の履歴</h2>
        <table className="adm__table">
          <thead>
            <tr>
              <th style={{ width: "4.5rem" }}>版</th>
              <th style={{ width: "11rem" }}>日時</th>
              <th>メモ</th>
              <th style={{ width: "9rem" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {revisions.map((r) => (
              <tr key={r.revision}>
                <td>{r.revision}</td>
                <td>{formatDateTime(r.createdAt)}</td>
                <td>{r.note ?? "—"}</td>
                <td>
                  {r.revision === revision ? (
                    <span className="adm__badge-now">いまの内容</span>
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
      </main>
    </>
  );
}
