import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ScrollReveal";
import TrailerModal from "@/components/TrailerModal";
import { getDocument } from "@/lib/content/load";

/**
 * 公開8ページ共通のレイアウト。
 *
 * ヘッダー・フッター・スクロール演出はここに置く。ルートレイアウトに置くと
 * `/admin` 配下にも必ず適用されてしまい、管理画面に公開サイトのヘッダーと
 * IntersectionObserver が混入するため。
 *
 * Route Group（`(public)`）は URL に現れないので、8ルートのパスは
 * `/`, `/about`, … のまま変わらない。
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = await getDocument("site");
  const films = await getDocument("films");

  return (
    <>
      <SiteHeader content={site.header} />
      {children}
      <SiteFooter content={site.footer} />
      {/* 変換元と同じくフッター直後に置く。index / programme 以外では何も描画しない。
          truthy 判定は、デプロイ直後に DB がまだ旧形（trailerModal なし）でも
          公開ページを落とさないための保険（lib/content/load.ts と同じ方針） */}
      {films.trailerModal ? <TrailerModal content={films.trailerModal} /> : null}
      <ScrollReveal />
    </>
  );
}
