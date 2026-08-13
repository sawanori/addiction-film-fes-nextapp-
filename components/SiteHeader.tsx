"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import SmartLink from "@/components/SmartLink";
import type { SiteHeaderContent, SiteLink } from "@/lib/content/types";

function frag(pathname: string, base: string, hash: string) {
  return hash && pathname === base ? hash : `${base}${hash}`;
}

function hrefFor(pathname: string, link: SiteLink) {
  return frag(pathname, link.base, link.hash);
}

export default function SiteHeader({ content }: { content: SiteHeaderContent }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 開いている間は html と body に nav-open を付ける。
  // 描画前に確定させるため useLayoutEffect で反映し、cleanup で必ず外す
  // （開いたままアンマウントされても nav-open が残らないようにする）。
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("nav-open", open);
    document.body.classList.toggle("nav-open", open);
    return () => {
      document.documentElement.classList.remove("nav-open");
      document.body.classList.remove("nav-open");
    };
  }, [open]);

  // Escape で閉じる
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // クライアント遷移後に開きっぱなしにならないよう閉じる
  // （元サイトはページ遷移＝再読み込みで必ず閉じた状態になる）
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // ナビ内リンクのクリックで閉じる
  const onNavClick = (e: React.MouseEvent<HTMLElement>) => {
    if (e.target instanceof Element && e.target.closest("a")) setOpen(false);
  };

  return (
    <header className="header">
      <div className="wrap">
        <div className="header__top">
          <Link
            className="brand"
            href={frag(pathname, content.brand.base, content.brand.hash)}
          >
            <span className="brand__en">
              {content.brand.en || <>Addiction Int'l Film Festival</>}
            </span>
            <span className="brand__date">{content.brand.date}</span>
            <span className="brand__jp">{content.brand.jp}</span>
          </Link>

          <nav
            className={open ? "gnav is-open" : "gnav"}
            id="gnav"
            onClick={onNavClick}
          >
            <ul>
              {content.nav.map((item) => (
                <li key={`${item.base}${item.hash}`}>
                  <SmartLink
                    href={hrefFor(pathname, item)}
                    aria-current={
                      !item.hash && pathname === item.base ? "page" : undefined
                    }
                  >
                    {item.label}
                  </SmartLink>
                </li>
              ))}
              {content.extra.map((item) => (
                <li className="gnav__extra" key={`${item.base}${item.hash}`}>
                  <SmartLink href={hrefFor(pathname, item)}>
                    {item.label}
                  </SmartLink>
                </li>
              ))}
            </ul>
          </nav>

          <button
            className={open ? "nav-toggle is-open" : "nav-toggle"}
            type="button"
            aria-label={
              open ? content.toggleLabel.close : content.toggleLabel.open
            }
            aria-expanded={open}
            aria-controls="gnav"
            onClick={() => setOpen(!open)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>

        <div className="header__bottom">
          <div className="partners-inline">
            {content.partners.map((partner) => (
              <span key={partner}>{partner}</span>
            ))}
          </div>
          <div className="utility">
            <span className="chip">{content.utility.chip}</span>
            <SmartLink href={hrefFor(pathname, content.utility.press)}>
              {content.utility.press.label}
            </SmartLink>
            <SmartLink href={hrefFor(pathname, content.utility.contact)}>
              {content.utility.contact.label}
            </SmartLink>
            <SmartLink href={pathname}>{content.utility.language.label}</SmartLink>
          </div>
        </div>
      </div>
    </header>
  );
}
