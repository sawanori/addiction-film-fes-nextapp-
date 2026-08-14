import type { Metadata } from "next";
import Films from "@/components/Films";
import Timetable from "@/components/Timetable";
import SmartLink from "@/components/SmartLink";
import { styleVars } from "@/lib/style";
import { getDocument } from "@/lib/content/load";
import { renderInline } from "@/lib/content/inline";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const programme = await getDocument("programme");
  return {
    title: programme.meta.title,
    description: programme.meta.description,
  };
}

export default async function ProgrammePage() {
  const filmsDoc = await getDocument("films");
  const programme = await getDocument("programme");
  const timetableDoc = await getDocument("timetable");
  const { head, films: filmsSection, guide, timetable, venue, cta } = programme;

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">{head.eyebrow}</span>
          <h1 className="display">{renderInline(head.title)}</h1>
          <p className="page-head__jp">{head.jp}</p>
          <p className="page-head__lead lead">{head.lead}</p>
        </div>
      </section>

      {/* ============ FILMS ============ */}
      <section className="section" id="films">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">{filmsSection.head.eyebrow}</span>
              <h2 className="display">{filmsSection.head.title}</h2>
              <p className="jp-head">{filmsSection.head.jp}</p>
            </div>
            <SmartLink className="arrow" href={filmsSection.link.href}>
              {filmsSection.link.label}
            </SmartLink>
          </div>

          <Films variant="programme" content={filmsDoc} />
        </div>
      </section>

      {/* 上映の考え方 */}
      <section className="section">
        <div className="wrap">
          <div className="rows">
            {guide.rows.map((row) => (
              <div
                key={row.no}
                className="row-item rise"
                {...(row.delay
                  ? { style: styleVars({ "--d": row.delay }) }
                  : {})}
                {...(row.id ? { id: row.id } : {})}
              >
                <span className="row-item__no">{row.no}</span>
                <div>
                  <p className="row-item__t">{renderInline(row.title)}</p>
                  <p className="row-item__d">{row.desc}</p>
                </div>
                <p className="row-item__meta">{renderInline(row.meta)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* タイムテーブル */}
      <section className="panel panel--wine">
        <div className="panel__dots" aria-hidden="true"></div>
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow" style={{ color: "var(--red)" }}>
                {timetable.eyebrow}
              </span>
              <h2
                className="display display--sm"
                style={{ color: "var(--white)" }}
              >
                {timetable.title}
              </h2>
              <p className="jp-head" style={{ color: "var(--red)" }}>
                {timetable.jp}
              </p>
            </div>
          </div>
          <Timetable content={timetableDoc} />
          <p className="small muted" style={{ marginTop: "16px" }}>{timetable.note}</p>
        </div>
      </section>

      {/* 会場 */}
      <section className="section" id="venue">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">{venue.head.eyebrow}</span>
              <h2 className="display display--sm">{venue.head.title}</h2>
              <p className="jp-head">{venue.head.jp}</p>
            </div>
            <SmartLink className="arrow" href={venue.link.href}>
              {venue.link.label}
            </SmartLink>
          </div>

          <div className="cols-2">
            {venue.boxes.map((box) => (
              <div
                key={box.h}
                className={
                  box.variant === "dark" ? "box box--dark rise" : "box rise"
                }
                {...(box.delay
                  ? { style: styleVars({ "--d": box.delay }) }
                  : {})}
              >
                <h3>{box.h}</h3>
                <p>{renderInline(box.p)}</p>
                <p
                  style={{ marginTop: "14px" }}
                  {...(box.p2Cls ? { className: box.p2Cls } : {})}
                >
                  {box.p2}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-bar rise">
            <p className="cta-bar__t">{cta.t}</p>
            <SmartLink className="arrow" href={cta.link.href}>
              {cta.link.label}
            </SmartLink>
          </div>
        </div>
      </section>
    </>
  );
}
