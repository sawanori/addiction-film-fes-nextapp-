"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { FilmsTrailerModal } from "@/lib/content/types";

/**
 * 予告編モーダル。変換元 script.js の5つ目の IIFE（予告編モーダル）の移植。
 *
 * 変換元で `<dialog id="trailerModal">` を持つのは index.html と programme.html の
 * 2ページだけなので、それ以外のルートでは何も描画しない。layout に1つ置き、
 * フッター直後（変換元と同じ位置）に出す。
 *
 * `.film__play` ボタンは Films（Server Component）が data-trailer 属性つきで
 * 描画するので、変換元と同じく DOM から拾ってリスナーを付ける。ルート遷移では
 * ページ側だけ差し変わるため、pathname を依存に取り直して付け直す。
 *
 * iframe は開いたときに作り、閉じたら捨てる（state を null に戻す）。ページを
 * 開いただけでは YouTube を読み込まないし、閉じれば再生も止まる。Esc と背景の
 * 暗転は <dialog> なのでブラウザ任せ。
 */
export default function TrailerModal({
  content,
}: {
  content: FilmsTrailerModal;
}) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [heading, setHeading] = useState(content.title);
  const [video, setVideo] = useState<{ src: string; title: string } | null>(
    null
  );
  const show = pathname === "/" || pathname === "/programme";

  useEffect(() => {
    if (!show) return;
    const dlg = dialogRef.current;
    if (!dlg || typeof dlg.showModal !== "function") return;

    const titleOf = (btn: HTMLElement) => {
      const t = btn.closest(".film")?.querySelector(".film__t");
      const text = t?.textContent?.trim();
      return text ? `『${text}』予告編` : content.title;
    };

    const open = (btn: HTMLElement) => {
      const id = btn.getAttribute("data-trailer");
      if (!id) return;
      const start = btn.getAttribute("data-trailer-start");
      const src =
        "https://www.youtube-nocookie.com/embed/" +
        encodeURIComponent(id) +
        "?autoplay=1&rel=0&playsinline=1&modestbranding=1" +
        (start ? "&start=" + encodeURIComponent(start) : "");
      const title = titleOf(btn);
      setVideo({ src, title });
      setHeading(title);
      dlg.showModal();
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
    };

    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".film__play")
    );
    const handlers = buttons.map((btn) => {
      const handler = () => open(btn);
      btn.addEventListener("click", handler);
      return [btn, handler] as const;
    });

    // 背景（パネルの外側）のクリックで閉じる
    const onBackdropClick = (e: MouseEvent) => {
      if (e.target === dlg) dlg.close();
    };
    // Esc・閉じるボタンのどちらでも通る後片付け
    const onClose = () => {
      setVideo(null);
      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
    };
    dlg.addEventListener("click", onBackdropClick);
    dlg.addEventListener("close", onClose);

    return () => {
      handlers.forEach(([btn, handler]) =>
        btn.removeEventListener("click", handler)
      );
      dlg.removeEventListener("click", onBackdropClick);
      dlg.removeEventListener("close", onClose);
      // 開いたままルート遷移した場合、close イベントのリスナーはもう居ないので
      // ここで直接後片付けする（スクロールロック解除と iframe の破棄）
      if (dlg.open) dlg.close();
      setVideo(null);
      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
    };
  }, [show, pathname, content.title]);

  if (!show) return null;

  return (
    <dialog
      className="vmodal"
      id="trailerModal"
      aria-labelledby="trailerTitle"
      ref={dialogRef}
    >
      <div className="vmodal__panel">
        <div className="vmodal__head">
          <p className="vmodal__t" id="trailerTitle">
            {heading}
          </p>
          <button
            className="vmodal__close"
            type="button"
            data-vmodal-close=""
            onClick={() => dialogRef.current?.close()}
          >
            {content.close}
          </button>
        </div>
        <div className="vmodal__frame">
          {video ? (
            <iframe
              src={video.src}
              title={video.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : null}
        </div>
        <p className="vmodal__note">{content.note}</p>
      </div>
    </dialog>
  );
}
