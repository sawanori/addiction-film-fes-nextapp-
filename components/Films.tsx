import { styleVars } from "@/lib/style";
import { renderInline } from "@/lib/content/inline";
import type { FilmsDocument } from "@/lib/content/types";

/**
 * 上映作品グリッド。index と programme で共用。
 * 変換元では 04「一瞬の楽園」のクレジットだけが2ページで異なる
 * （index は短縮版、programme は公式チラシどおりの全文）ため、
 * variant で出し分ける。それ以外の文言・構造は両ページで完全に同一。
 * データは content/films.json（04 は `meta` と `metaProgramme` を両方持つ）。
 */
export default function Films({
  variant,
  content,
}: {
  variant: "index" | "programme";
  content: FilmsDocument;
}) {
  return (
    <>
      <div className="films">
        {content.items.map((film) => (
          <article
            key={film.no}
            className={film.lead ? "film film--lead rise" : "film rise"}
            {...(film.delay
              ? { style: styleVars({ "--d": film.delay }) }
              : {})}
          >
            <span className="film__img">
              <span className="film__no">{film.no}</span>
              <span className="film__time">{film.time}</span>
              <img
                src={film.img}
                alt={film.alt}
                {...(film.lazy ? { loading: "lazy" } : {})}
              />
              {film.trailer?.id ? (
                <button
                  className="film__play"
                  type="button"
                  data-trailer={film.trailer.id}
                  {...(film.trailer.start
                    ? { "data-trailer-start": film.trailer.start }
                    : {})}
                  // 管理画面から動画URLだけ入れて登録した場合、読み上げ文と帯の文字は空になる。
                  // 空の aria-label はボタンを読み上げ不能にし、空の帯（背景色と padding を持つ）は
                  // 黒い矩形だけが残るため、既存2作品と同じ書式の既定値で補う。
                  aria-label={film.trailer.aria || `『${film.t}』の予告編を再生`}
                >
                  <span className="film__play-label">
                    {film.trailer.label || "Trailer"}
                  </span>
                </button>
              ) : null}
            </span>
            <span className="film__k">{film.k}</span>
            <span className="film__t">{film.t}</span>
            <span className="film__en">{film.en}</span>
            <span className="film__meta">
              {renderInline(
                variant === "programme" && film.metaProgramme
                  ? film.metaProgramme
                  : film.meta
              )}
            </span>
            <span className="film__d">{film.d}</span>
          </article>
        ))}
      </div>

      <p className="films__note">{content.note}</p>
    </>
  );
}
