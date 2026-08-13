"use client";

import { usePathname } from "next/navigation";
import SmartLink from "@/components/SmartLink";

/**
 * 8ページ共通フッター。
 * 変換元では「そのページ自身へのフラグメント付きリンク」だけが `#…` 形式になり、
 * それ以外は `<ページ名>.html#…` 形式になっている。その差異を保つため、
 * 現在のパスに応じて href を切り替える。
 */
export default function SiteFooter() {
  const pathname = usePathname();
  const frag = (base: string, hash: string) =>
    pathname === base ? hash : `${base}${hash}`;

  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__cols">
          <div>
            <h3>Festival</h3>
            <ul>
              <li>
                <SmartLink href="/programme">上映とトーク</SmartLink>
              </li>
              <li>
                <SmartLink href={frag("/programme", "#venue")}>会場</SmartLink>
              </li>
              <li>
                <SmartLink href="/tickets">チケット</SmartLink>
              </li>
              <li>
                <SmartLink href={frag("/tickets", "#novelty")}>
                  ノベルティ
                </SmartLink>
              </li>
            </ul>
          </div>
          <div>
            <h3>About</h3>
            <ul>
              <li>
                <SmartLink href="/about">映画祭について</SmartLink>
              </li>
              <li>
                <SmartLink href={frag("/about", "#approach")}>
                  3つのアプローチ
                </SmartLink>
              </li>
              <li>
                <SmartLink href={frag("/about", "#outline")}>開催概要</SmartLink>
              </li>
              <li>
                <SmartLink href={frag("/about", "#org")}>実行委員会</SmartLink>
              </li>
            </ul>
          </div>
          <div>
            <h3>Media</h3>
            <ul>
              <li>
                <SmartLink href="/news">お知らせ</SmartLink>
              </li>
              <li>
                <SmartLink href="/news">プレスリリース</SmartLink>
              </li>
              <li>
                <SmartLink href={frag("/news", "#press")}>
                  取材のご依頼
                </SmartLink>
              </li>
            </ul>
          </div>
          <div>
            <h3>Support</h3>
            <ul>
              <li>
                <SmartLink href={frag("/about", "#partner")}>協賛</SmartLink>
              </li>
              <li>
                <SmartLink href={frag("/about", "#partner")}>
                  メディアパートナー
                </SmartLink>
              </li>
              <li>
                <SmartLink href={frag("/about", "#contact")}>
                  お問い合わせ
                </SmartLink>
              </li>
            </ul>
          </div>
          <div>
            <h3>Venue</h3>
            <ul>
              <li>よみうりホール</li>
              <li>東京・有楽町</li>
              <li>
                <SmartLink href={frag("/programme", "#venue")}>
                  アクセス
                </SmartLink>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          {/* 日本語の文中で改行すると JSX が空白を挿入するため1行で書く */}
          <p className="footer__note">本サイトはデザイン検討用の試作です。企画書に記載のない情報（開催日・会場名・上映作品・登壇者・タイムテーブル・記事・連絡先など）はすべて仮置きであり、確定した事実ではありません。差し替え対象の一覧は PLACEHOLDERS.md を参照してください。</p>
          <div className="footer__legal">
            <ul>
              <li>
                <SmartLink href="/privacy">プライバシーポリシー</SmartLink>
              </li>
              <li>
                <SmartLink href="/terms">利用規約・来場規約</SmartLink>
              </li>
              <li>
                <SmartLink href="/legal">特定商取引法に基づく表記</SmartLink>
              </li>
            </ul>
            <p className="footer__copy">
              © 2026 アディクション国際映画祭 実行委員会〔仮称〕
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
