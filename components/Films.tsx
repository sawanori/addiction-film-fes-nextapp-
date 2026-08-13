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
