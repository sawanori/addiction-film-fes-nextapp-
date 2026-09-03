import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin/session";
import { listDocuments } from "@/lib/admin/documents";
import { documentLabel, documentDescription } from "@/lib/content/manifest";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "コンテンツ管理",
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

/** 一覧の並び順。よく直すページを上に置く。 */
const ORDER = [
  "index",
  "films",
  "programme",
  "timetable",
  "tickets",
  "news",
  "about",
  "site",
  "privacy",
  "terms",
  "legal",
];

function formatDateTime(iso: string | null): string {
  return iso === null ? "—" : iso.replace("T", " ").slice(0, 16);
}

export default async function AdminDashboardPage() {
  // 認証チェックはレイアウトではなくページ側で行う（lib/admin/session.ts のコメント参照）
  await requireAdminSession("/addiction-admin");

  const documents = await listDocuments();
  // "store_error"（保存先に届かない）と "misconfigured"（環境変数が足りない）はどちらも同じ表示。
  const failed = typeof documents === "string";
  const sorted =
    failed
      ? []
      : [...documents].sort((a, b) => {
          const ai = ORDER.indexOf(a.key);
          const bi = ORDER.indexOf(b.key);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });

  return (
    <>
      <div className="adm__topbar">
        <div className="adm__topbar-inner">
          <div className="adm__brand">
            <p className="adm__brand-title">アディクション国際映画祭　コンテンツ管理</p>
            <span className="adm__brand-sub">サイトの文章と画像を差し替えます</span>
          </div>
          <a className="adm__ghost" href="/" target="_blank" rel="noreferrer">
            サイトを見る
          </a>
          <LogoutButton />
        </div>
      </div>

      <main className="adm__page">
        <p className="adm__note">
          直したいページを選んで「編集する」を押してください。
          <br />
          保存すると、1〜2分ほどで公開サイトに反映されます。保存のたびに履歴が残るので、間違えても前の内容に戻せます。
        </p>

        {failed ? (
          <p className="adm__error">
            保存先（GitHub）に接続できませんでした。時間をおいて再読み込みしてください。
          </p>
        ) : (
          <ul className="adm__cards">
            {sorted.map((doc) => (
              <li className="adm__card" key={doc.key}>
                <h2 className="adm__card-title">{documentLabel(doc.key)}</h2>
                <p className="adm__card-desc">{documentDescription(doc.key)}</p>
                <div className="adm__card-meta">最終更新 {formatDateTime(doc.updatedAt)}</div>
                <div className="adm__card-actions">
                  <Link className="adm__button" href={`/addiction-admin/docs/${doc.key}`}>
                    編集する
                  </Link>
                  {PUBLIC_PATH[doc.key] ? (
                    <a
                      className="adm__ghost"
                      href={PUBLIC_PATH[doc.key] as string}
                      target="_blank"
                      rel="noreferrer"
                    >
                      公開ページ
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
