import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin/session";
import { listDocuments } from "@/lib/admin/documents";
import { documentLabel } from "@/lib/content/manifest";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ダッシュボード | 管理画面",
};

/** 公開ページのパス。`site` のようにページを持たないドキュメントは null。 */
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

export default async function AdminDashboardPage() {
  // 認証チェックはレイアウトではなくページ側で行う（lib/admin/session.ts のコメント参照）
  await requireAdminSession("/admin");

  const documents = await listDocuments();

  return (
    <main className="adm__page">
      <header className="adm__bar">
        <h1 className="adm__title">コンテンツ管理</h1>
        <LogoutButton />
      </header>

      {documents === "db_error" ? (
        <p className="adm__error">データベースに接続できませんでした。</p>
      ) : (
        <table className="adm__table">
          <thead>
            <tr>
              <th>ドキュメント</th>
              <th>キー</th>
              <th>版</th>
              <th>最終更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.key}>
                <td>{documentLabel(doc.key)}</td>
                <td><code>{doc.key}</code></td>
                <td>{doc.revision}</td>
                <td>{doc.updatedAt.replace("T", " ").slice(0, 19)}</td>
                <td className="adm__actions">
                  <Link className="adm__link" href={`/admin/docs/${doc.key}`}>
                    編集
                  </Link>
                  {PUBLIC_PATH[doc.key] ? (
                    <a
                      className="adm__link"
                      href={PUBLIC_PATH[doc.key] as string}
                      target="_blank"
                      rel="noreferrer"
                    >
                      公開ページ
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
