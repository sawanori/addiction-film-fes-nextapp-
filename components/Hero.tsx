"use client";

import { useEffect, useRef, useState } from "react";
import SmartLink from "@/components/SmartLink";

const SLIDES = [
  {
    src: "/assets/films/hero-01-secret-sea.jpg",
    alt: "『嘘つきは〇○のはじまり』より、海を望む階段に立つ二人",
    lazy: false,
  },
  {
    src: "/assets/films/hero-01-paradise.jpg",
    alt: "『一瞬の楽園』より、夜の歩道橋を歩く二人",
    lazy: true,
  },
  {
    src: "/assets/films/hero-03-binetsu.jpg",
    alt: "『微熱』より、遊技台の光に照らされる男",
    lazy: true,
  },
  {
    src: "/assets/films/hero-04-billw.jpg",
    alt: "『Bill W.』より、ステッピング・ストーンズを歩く二人",
    lazy: true,
  },
];

const INTERVAL = 6000;

/**
 * ヒーローのキービジュアル・スライドショー（script.js の2つ目の IIFE に相当）。
 * 6000ms ごとに巡回し、#heroNav の .hero__dot と連動する。
 * prefers-reduced-motion: reduce では自動送りしない。
 * タブが非表示のあいだは停止する。
 */
export default function Hero() {
  const [index, setIndex] = useState(0);
  const handlersRef = useRef<{
    show: (next: number) => void;
    start: () => void;
  } | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let current = 0;
    let timer = 0;

    const show = (next: number) => {
      current = ((next % SLIDES.length) + SLIDES.length) % SLIDES.length;
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
        写真が用意できたら、各 .hero__slide の <img src> を .jpg に差し替えるだけで入れ替わる
        （推奨サイズ 2000×1125 前後・16:9）。スライドは増減自由。増やす場合は
        .hero__slide をコピーし、下の .hero__nav にも同じ数だけ .hero__dot を追加する。
        写真に切り替えたあと世界観を揃えたい場合は、下の div に is-duotone を足すと
        朱赤のデュオトーンになる（例: className="hero__slides is-duotone"）。
        （React 版では SLIDES 配列を増減するだけでドットも連動する）
      */}
      <div
        className="hero__slides"
        id="heroSlides"
        role="group"
        aria-label="キービジュアル"
      >
        {SLIDES.map((slide, i) => (
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
          <span className="eyebrow">1st Edition</span>
          <span className="eyebrow">All Films with Talk Show</span>
        </div>

        <h1 className="display display--xl hero__title">
          <span>Turn Bias</span>
          <span>into Dialogue</span>
        </h1>
        <p className="hero__jp">映画の力で、偏見を対話に変える。</p>

        <dl className="hero__meta">
          <div>
            <dt>Dates</dt>
            <dd>2026年10月11日（日）— 12日（月・祝）</dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>よみうりホール（東京・有楽町）</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>全作品にトークショーを併催</dd>
          </div>
          <div>
            <dt>Tickets</dt>
            <dd>1日券 3,000円／2日券 5,000円</dd>
          </div>
        </dl>

        <div className="hero__actions">
          <SmartLink className="btn" href="/programme">
            上映とトークを見る
          </SmartLink>
          <SmartLink className="btn btn--light" href="/tickets">
            チケット情報
          </SmartLink>
        </div>

        <div className="hero__nav" id="heroNav">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.src}
              className={
                i === index ? "hero__dot is-active" : "hero__dot"
              }
              type="button"
              aria-label={`キービジュアル ${i + 1}枚目を表示`}
              onClick={() => onDotClick(i)}
            ></button>
          ))}
        </div>
      </div>
    </section>
  );
}
