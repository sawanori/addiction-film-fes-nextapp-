"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import SmartLink from "@/components/SmartLink";

const NAV_ITEMS = [
  { href: "/about", label: "About" },
  { href: "/programme", label: "Programme" },
  { href: "/tickets", label: "Tickets" },
  { href: "/news", label: "News" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // about ページだけは同一ページ内アンカー（#partner / #contact）になる
  const isAbout = pathname === "/about";
  const partnerHref = isAbout ? "#partner" : "/about#partner";
  const contactHref = isAbout ? "#contact" : "/about#contact";

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
          <Link className="brand" href="/">
            <span className="brand__en">Addiction Int'l Film Festival</span>
            <span className="brand__date">2026.10.11 — 10.12</span>
            <span className="brand__jp">アディクション国際映画祭〔企画中〕</span>
          </Link>

          <nav
            className={open ? "gnav is-open" : "gnav"}
            id="gnav"
            onClick={onNavClick}
          >
            <ul>
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <SmartLink
                    href={item.href}
                    aria-current={pathname === item.href ? "page" : undefined}
                  >
                    {item.label}
                  </SmartLink>
                </li>
              ))}
              <li className="gnav__extra">
                <SmartLink href={partnerHref}>パートナー募集</SmartLink>
              </li>
              <li className="gnav__extra">
                <SmartLink href={contactHref}>お問い合わせ</SmartLink>
              </li>
            </ul>
          </nav>

          <button
            className={open ? "nav-toggle is-open" : "nav-toggle"}
            type="button"
            aria-label={open ? "メニューを閉じる" : "メニューを開く"}
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
            <span>MAIN PARTNER 募集中</span>
            <span>OFFICIAL SUPPORTER 募集中</span>
            <span>MEDIA PARTNER 募集中</span>
          </div>
          <div className="utility">
            <span className="chip">DRAFT／仮デザイン</span>
            <SmartLink href="/news">Press</SmartLink>
            <SmartLink href={contactHref}>Contact</SmartLink>
            <SmartLink href={pathname}>JA</SmartLink>
          </div>
        </div>
      </div>
    </header>
  );
}
