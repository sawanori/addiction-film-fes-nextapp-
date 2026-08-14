import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ScrollReveal from "@/components/ScrollReveal";
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

  return (
    <>
      <SiteHeader content={site.header} />
      {children}
      <SiteFooter content={site.footer} />
      <ScrollReveal />
    </>
  );
}
