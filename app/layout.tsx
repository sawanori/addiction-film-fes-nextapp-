import type { Metadata } from "next";
import "./globals.css";

/**
 * 全ルート共通の最小の殻。
 *
 * ヘッダー・フッター・スクロール演出は `app/(public)/layout.tsx` にある。
 * ここに置くと `/admin` にも適用されてしまうため、公開面だけの関心事は
 * Route Group 側に寄せている。ここに残すのは、管理画面にも等しく必要な
 * `<html lang>` と、変換元と一致させる必要がある `<head>` の中身だけ。
 */
export const metadata: Metadata = {
  // 変換元の全ページ共通 <meta name="robots" content="noindex, nofollow, noarchive">
  robots: { index: false, follow: false, noarchive: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <head>
        {/* 変換元と同じ Google Fonts を <link> で読み込む（--font-en / --font-jp の当たる書体を変えないため） */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Noto+Sans+JP:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
