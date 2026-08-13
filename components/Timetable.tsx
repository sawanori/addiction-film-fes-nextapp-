"use client";

import { useEffect, useRef, useState } from "react";
import { renderInline } from "@/lib/content/inline";
import type { TimetableDocument } from "@/lib/content/types";

/**
 * タイムテーブルの日付スライド（script.js の3つ目の IIFE に相当）。
 * スワイプ自体は CSS のスクロールスナップが担当し、ここはタブ・矢印との同期だけを見る。
 *
 * 日付・見出し・その日の行データは content/timetable.json の days 配列1つにまとめ、
 * タブとシートの両方をその配列から生成する
 * （変換元 script.js がシート枚数を DOM から数えていたのと同じく、
 *   日を増減するときは days だけを触ればよい設計）。
 */
export default function Timetable({ content }: { content: TimetableDocument }) {
  const days = content.days;
  const [current, setCurrent] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef(0);
  const reducedRef = useRef<boolean | null>(null);
  const tickingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const clamp = (i: number) => Math.max(0, Math.min(days.length - 1, i));

  const isReduced = () => {
    if (reducedRef.current === null) {
      reducedRef.current = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
    }
    return reducedRef.current;
  };

  const sync = (i: number) => {
    currentRef.current = i;
    setCurrent(i);
  };

  const go = (i: number) => {
    const next = clamp(i);
    const track = trackRef.current;
    if (track) {
      track.scrollTo({
        left: next * track.clientWidth,
        behavior: isReduced() ? "auto" : "smooth",
      });
    }
    sync(next);
  };

  const onTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(currentRef.current + 1);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(currentRef.current - 1);
    }
  };

  // 指でスワイプされたときは scrollLeft から現在位置を割り出してタブに反映する
  const onTrackScroll = () => {
    if (tickingRef.current) return;
    tickingRef.current = true;
    rafRef.current = requestAnimationFrame(() => {
      tickingRef.current = false;
      rafRef.current = null;
      const track = trackRef.current;
      if (!track) return;
      const i = clamp(Math.round(track.scrollLeft / (track.clientWidth || 1)));
      if (i !== currentRef.current) sync(i);
    });
  };

  // 幅が変わるとシート幅も変わるので、表示中の日に合わせ直す
  useEffect(() => {
    const onResize = () => {
      const track = trackRef.current;
      if (track) track.scrollLeft = currentRef.current * track.clientWidth;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // アンマウント時に残っている rAF を止める
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="timetable rise">
      <div className="timetable__tabs">
        {days.map((day, i) => (
          <button
            key={day.d}
            className={
              i === current ? "timetable__tab is-active" : "timetable__tab"
            }
            type="button"
            aria-pressed={i === current}
            onClick={() => go(i)}
          >
            <span className="timetable__tab-d">{day.d}</span>
            <span className="timetable__tab-j">{day.j}</span>
          </button>
        ))}
      </div>

      <div
        className="timetable__track"
        id="timetableTrack"
        tabIndex={0}
        role="group"
        aria-label={content.trackLabel}
        ref={trackRef}
        onKeyDown={onTrackKeyDown}
        onScroll={onTrackScroll}
      >
        {days.map((day) => (
          <div className="timetable__sheet" key={day.d}>
            <div className="timetable__sheet-head">
              <span className="timetable__day">{day.d}</span>
              <span className="timetable__date">{day.j}</span>
            </div>
            <table className="table table--dark">
              <thead>
                <tr>
                  <th>{content.columns[0]}</th>
                  <th>{content.columns[1]}</th>
                </tr>
              </thead>
              <tbody>
                {day.rows.map((row) => (
                  <tr key={row.time}>
                    <td>
                      <strong>{row.time}</strong>
                    </td>
                    <td>{renderInline(row.program)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="timetable__nav">
        <span className="timetable__hint">{content.hint}</span>
        {content.arrows.map((arrow) => (
          <button
            key={arrow.dir}
            className="timetable__arrow"
            type="button"
            data-dir={arrow.dir}
            aria-label={arrow.label}
            disabled={clamp(current + arrow.dir) === current}
            onClick={() => go(currentRef.current + arrow.dir)}
          >
            {arrow.glyph}
          </button>
        ))}
      </div>
    </div>
  );
}
