"use client";

import { usePathname } from "next/navigation";
import SmartLink from "@/components/SmartLink";
import type {
  SiteFooterContent,
  SiteFooterItem,
  SiteLink,
} from "@/lib/content/types";

function hasLink(item: SiteFooterItem): item is SiteLink {
  return "base" in item;
}

/**
 * 8ページ共通フッター。
 * 変換元では「そのページ自身へのフラグメント付きリンク」だけが `#…` 形式になり、
 * それ以外は `<ページ名>.html#…` 形式になっている。その差異を保つため、
 * 現在のパスに応じて href を切り替える。
 */
export default function SiteFooter({ content }: { content: SiteFooterContent }) {
  const pathname = usePathname();
  const frag = (base: string, hash: string) =>
    hash && pathname === base ? hash : `${base}${hash}`;

  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__cols">
          {content.columns.map((column) => (
            <div key={column.heading}>
              <h3>{column.heading}</h3>
              <ul>
                {column.items.map((item) => {
                  const key = hasLink(item)
                    ? `${item.label}-${item.base}-${item.hash}`
                    : item.label;

                  return (
                    <li key={key}>
                      {hasLink(item) ? (
                        <SmartLink href={frag(item.base, item.hash)}>
                          {item.label}
                        </SmartLink>
                      ) : (
                        item.label
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer__bottom">
          <p className="footer__note">{content.note}</p>
          <div className="footer__legal">
            <ul>
              {content.legal.map((item) => (
                <li key={`${item.base}${item.hash}`}>
                  <SmartLink href={frag(item.base, item.hash)}>
                    {item.label}
                  </SmartLink>
                </li>
              ))}
            </ul>
            <p className="footer__copy">{content.copy}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
