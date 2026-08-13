"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * スクロールリビール（script.js の4つ目の IIFE に相当）。
 * .rise を IntersectionObserver で監視して is-in を付ける。
 * ページのあちこちで使うため、layout に1つだけ置き、
 * クライアント遷移のたびに新しい .rise を拾い直す。
 */
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(".rise:not(.is-in)")
    );
    if (!targets.length) return;
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
