import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/admin/session";
import { readDocument, listHistory } from "@/lib/admin/documents";
import { isRepoSlug } from "@/lib/content/store-github";
import {
  buildManifest,
  documentLabel,
  documentDescription,
  DOCUMENT_KEYS,
  type DocumentKey,
} from "@/lib/content/manifest";
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

/**
 * 履歴表の下に出す「GitHub で見る」のリンク先（計画書 §8.3）。
 * `GITHUB_CONTENT_REPO` が無い／`owner/repo` 形式でない（ローカルの FS 実装など）なら null。
 */
function historyUrlFor(key: string): string | null {
  const repo = process.env.GITHUB_CONTENT_REPO;
  if (!repo || !isRepoSlug(repo)) return null;
  const branch = process.env.GITHUB_CONTENT_BRANCH || "main";
  return `https://github.com/${repo}/commits/${branch}/content/${key}.json`;
}

export default async function AdminDocumentPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;

  // 認証チェックはこのページの先頭で行う（レイアウトでは足りない。lib/admin/session.ts 参照）
  await requireAdminSession(`/addiction-admin/docs/${key}`);

  if (!(DOCUMENT_KEYS as string[]).includes(key)) notFound();

  const stored = await readDocument(key);
  // "store_error"（保存先に届かない）と "misconfigured"（環境変数が足りない）はどちらも同じ表示。
  if (typeof stored === "string") {
    return (
      <main className="adm__page">
        <p className="adm__error">
          保存先（GitHub）に接続できませんでした。時間をおいて再読み込みしてください。
        </p>
      </main>
    );
  }
  if (stored === null) notFound();

  const history = await listHistory(key, 20);

  return (
    <DocumentEditor
      docKey={key}
      label={documentLabel(key)}
      description={documentDescription(key)}
      manifest={buildManifest(key as DocumentKey, stored.data)}
      initialData={stored.data}
      initialSha={stored.sha}
      initialHistory={typeof history === "string" ? [] : history}
      historyUrl={historyUrlFor(key)}
      publicPath={PUBLIC_PATH[key] ?? null}
    />
  );
}
