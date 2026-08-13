"use client";

import { useEffect, useRef, useState } from "react";
import SmartLink from "@/components/SmartLink";
import type { IndexHero } from "@/lib/content/types";

const INTERVAL = 6000;

/**
 * ヒーローのキービジュアル・スライドショー（script.js の2つ目の IIFE に相当）。
 * 6000ms ごとに巡回し、#heroNav の .hero__dot と連動する。
 * prefers-reduced-motion: reduce では自動送りしない。
 * タブが非表示のあいだは停止する。
 *
 * スライドの画像パス・alt・aria-label と静的テキストは props（content/index.json の hero）
 * から受け取る。制御ロジックは変換元から変更していない。
 */
export default function Hero({ content }: { content: IndexHero }) {
  const [index, setIndex] = useState(0);
  // モジュール定数だった SLIDES の props 化。effect の deps（[]）を変えずに
  // 枚数を参照するため、マウント時の値を ref に保持する（スライドは静的データ）。
  const slidesRef = useRef(content.slides);
  const handlersRef = useRef<{
    show: (next: number) => void;
    start: () => void;
  } | null>(null);

  useEffect(() => {
    const slides = slidesRef.current;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let current = 0;
    let timer = 0;

    const show = (next: number) => {
      current = ((next % slides.length) + slides.length) % slides.length;
      setIndex(current);
    };
    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    };
    const start = () => {
      if (reduced) return;
      stop();
      timer = window.setInterval(() => show(current + 1), INTERVAL);
    };

    handlersRef.current = { show, start };
    show(0);
    start();

    // タブが非表示のあいだは止める（無駄な再描画を避ける）
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      handlersRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const onDotClick = (i: number) => {
    handlersRef.current?.show(i);
    handlersRef.current?.start();
  };

  return (
    <section className="hero">
      {/*
        キービジュアルのスライドショー。
        写真が用意できたら content/index.json の hero.slides の src を差し替えるだけで入れ替わる
        （推奨サイズ 2000×1125 前後・16:9）。スライドは増減自由（ドットも連動する）。
        写真に切り替えたあと世界観を揃えたい場合は、下の div に is-duotone を足すと
        朱赤のデュオトーンになる（例: className="hero__slides is-duotone"）。
      */}
      <div
        className="hero__slides"
        id="heroSlides"
        role="group"
        aria-label={content.slidesLabel}
      >
        {content.slides.map((slide, i) => (
          <div
            key={slide.src}
            className={
              i === index ? "hero__slide is-active" : "hero__slide"
            }
          >
            <img
              src={slide.src}
              alt={slide.alt}
              {...(slide.lazy ? { loading: "lazy" } : {})}
            />
          </div>
        ))}
      </div>
      <div className="hero__veil" aria-hidden="true"></div>
      <div className="hero__dots" aria-hidden="true"></div>

      <div className="wrap hero__inner">
        <div className="hero__edition">
          <span className="eyebrow">{content.edition[0]}</span>
          <span className="eyebrow">{content.edition[1]}</span>
        </div>

        <h1 className="display display--xl hero__title">
          <span>{content.titleLines[0]}</span>
          <span>{content.titleLines[1]}</span>
        </h1>
        <p className="hero__jp">{content.jp}</p>

        <dl className="hero__meta">
          {content.meta.map((item) => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>{item.desc}</dd>
            </div>
          ))}
        </dl>

        <div className="hero__actions">
          {content.actions.map((action) => (
            <SmartLink
              key={action.href}
              className={action.variant === "light" ? "btn btn--light" : "btn"}
              href={action.href}
            >
              {action.label}
            </SmartLink>
          ))}
        </div>

        <div className="hero__nav" id="heroNav">
          {content.slides.map((slide, i) => (
            <button
              key={slide.src}
              className={
                i === index ? "hero__dot is-active" : "hero__dot"
              }
              type="button"
              aria-label={slide.dotLabel}
              onClick={() => onDotClick(i)}
            ></button>
          ))}
        </div>
      </div>
    </section>
  );
}
