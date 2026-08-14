import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/admin/session";
import { readDocument, listRevisions } from "@/lib/admin/documents";
import { buildManifest, documentLabel, DOCUMENT_KEYS, type DocumentKey } from "@/lib/content/manifest";
import DocumentEditor from "./DocumentEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "編集 | 管理画面",
};

const PUBLIC_PATH: Record<string, string | null> = {
  index: "/",
  about: "/about",
  programme: "/programme",
  tickets: "/tickets",
  news: "/news",
  privacy: "/privacy",
  terms: "/terms",
  legal: "/legal",
  films: "/programme",
  timetable: "/programme",
  site: null,
};

export default async function AdminDocumentPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;

  // 認証チェックはこのページの先頭で行う（レイアウトでは足りない。lib/admin/session.ts 参照）
  await requireAdminSession(`/admin/docs/${key}`);

  if (!(DOCUMENT_KEYS as string[]).includes(key)) notFound();

  const stored = await readDocument(key);
  if (stored === "db_error") {
    return (
      <main className="adm__page">
        <p className="adm__error">データベースに接続できませんでした。</p>
      </main>
    );
  }
  if (stored === null) notFound();

  const revisions = await listRevisions(key);

  return (
    <DocumentEditor
      docKey={key}
      label={documentLabel(key)}
      manifest={buildManifest(key as DocumentKey, stored.data)}
      initialData={stored.data}
      initialRevision={stored.revision}
      initialRevisions={revisions === "db_error" ? [] : revisions}
      publicPath={PUBLIC_PATH[key] ?? null}
    />
  );
}
