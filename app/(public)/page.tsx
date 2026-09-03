import type { Metadata } from "next";
import Hero from "@/components/Hero";
import Films from "@/components/Films";
import SmartLink from "@/components/SmartLink";
import { styleVars } from "@/lib/style";
import { getDocument } from "@/lib/content/load";
import { renderInline } from "@/lib/content/inline";

export async function generateMetadata(): Promise<Metadata> {
  const index = await getDocument("index");
  return {
    title: index.meta.title,
    description: index.meta.description,
  };
}

export default async function Home() {
  const index = await getDocument("index");
  const filmsDoc = await getDocument("films");
  const {
    hero,
    quick,
    statement,
    approach,
    films: filmsSection,
    format,
    navigator: navigatorSection,
    news,
    manifesto,
    cta,
  } = index;

  return (
    <>
      {/* ============ HERO ============ */}
      <Hero content={hero} />

      {/* ============ QUICK LINKS ============ */}
      <section className="quick">
        <div className="wrap">
          <div className="quick__grid">
            {quick.cards.map((card) => (
              <SmartLink
                key={card.t}
                className="qcard rise"
                {...(card.delay
                  ? { style: styleVars({ "--d": card.delay }) }
                  : {})}
                href={card.href}
              >
                <span>
                  <span className="qcard__t">{card.t}</span>
                  <span className="qcard__jp">{card.jp}</span>
                  <span className="qcard__d">{card.d}</span>
                </span>
                <span className="qcard__arrow">→</span>
              </SmartLink>
            ))}
          </div>
        </div>
      </section>

      {/* ============ STATEMENT ============ */}
      <section className="panel">
        <div className="panel__dots" aria-hidden="true"></div>
        <div className="wrap">
          <div className="panel__grid panel__grid--why">
            <div className="rise">
              <h2
                className="display display--sm display--rose"
                style={{ color: "var(--red)" }}
              >
                {renderInline(statement.title)}
              </h2>
              <SmartLink
                className="arrow"
                href={statement.link.href}
                style={{ color: "var(--red)", marginTop: "22px" }}
              >
                {statement.link.label}
              </SmartLink>
            </div>
            <p
              className="panel__lead rise"
              style={styleVars({ "--d": ".1s" })}
            >
              {renderInline(statement.lead)}
            </p>
            <div
              className="panel__note rise"
              style={styleVars({ "--d": ".18s" })}
            >
              <span className="panel__note__k">{statement.note.k}</span>
              <p>{statement.note.p}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 3 APPROACHES ============ */}
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">{approach.head.eyebrow}</span>
              <h2 className="display">{approach.head.title}</h2>
              <p className="jp-head">{approach.head.jp}</p>
            </div>
            <SmartLink className="arrow" href={approach.link.href}>
              {approach.link.label}
            </SmartLink>
          </div>

          {/* カードが2枚のため 1081px 以上では sections-grid--2 で2カラムに詰める（news の同グリッドは3枚のまま） */}
          <div className="sections-grid sections-grid--2">
            {approach.cards.map((card) => (
              <SmartLink
                key={card.no}
                className={
                  card.variant === "tall"
                    ? "scard scard--tall rise"
                    : card.variant === "red"
                      ? "scard scard--red rise"
                      : "scard rise"
                }
                {...(card.delay
                  ? { style: styleVars({ "--d": card.delay }) }
                  : {})}
                href={card.href}
              >
                <span className="scard__no">{card.no}</span>
                <span className="scard__dots" aria-hidden="true"></span>
                <span>
                  <span className="scard__t">{card.t}</span>
                  <span className="scard__jp">{card.jp}</span>
                  <span className="scard__d">{card.d}</span>
                </span>
              </SmartLink>
            ))}
          </div>
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

          <Films variant="index" content={filmsDoc} />
        </div>
      </section>

      {/* ============ FORMAT ============ */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">{format.head.eyebrow}</span>
              <h2 className="display">{renderInline(format.head.title)}</h2>
              <p className="jp-head">{format.head.jp}</p>
            </div>
            <SmartLink className="arrow" href={format.link.href}>
              {format.link.label}
            </SmartLink>
          </div>

          <div className="cols-2">
            {format.boxes.map((box) => (
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
                <p>{box.p}</p>
              </div>
            ))}
          </div>

          <div
            className="rows"
            style={{ marginTop: "clamp(28px,4vw,52px)" }}
          >
            {format.rows.map((row) => (
              <div
                key={row.no}
                className="row-item rise"
                {...(row.delay
                  ? { style: styleVars({ "--d": row.delay }) }
                  : {})}
              >
                <span className="row-item__no">{row.no}</span>
                <div>
                  <p className="row-item__t">{row.t}</p>
                  <p className="row-item__d">{row.d}</p>
                </div>
                <p className="row-item__meta">{renderInline(row.meta)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ NAVIGATOR ============ */}
      <section className="panel" id="navigator">
        <div className="panel__dots" aria-hidden="true"></div>
        <div className="wrap">
          <div className="navigator__grid">
            <figure className="navigator__img rise">
              <span className="navigator__badge">{navigatorSection.badge}</span>
              <img
                src={navigatorSection.img.src}
                alt={navigatorSection.img.alt}
                loading="lazy"
              />
            </figure>

            <div
              className="rise"
              style={styleVars({ "--d": ".08s" })}
            >
              <span className="eyebrow" style={{ color: "var(--red)" }}>
                {navigatorSection.eyebrow}
              </span>
              <h2
                className="display display--sm display--rose"
                style={{ color: "var(--red)", marginTop: "10px" }}
              >
                {renderInline(navigatorSection.title)}
              </h2>
              <span className="navigator__k eyebrow">{navigatorSection.k}</span>
              <span className="navigator__name">{navigatorSection.name}</span>
              <span className="navigator__en">{navigatorSection.en}</span>

              <p className="navigator__lead">{navigatorSection.lead}</p>

              <p className="navigator__d">{navigatorSection.d}</p>

              <ul className="navigator__facts">
                {navigatorSection.facts.map((fact) => (
                  <li key={fact.b}>
                    <b>{fact.b}</b>
                    <span>{fact.text}</span>
                  </li>
                ))}
              </ul>

              <p className="navigator__note">{navigatorSection.note}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ NEWS ============ */}
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">{news.head.eyebrow}</span>
              <h2 className="display">{news.head.title}</h2>
              <p className="jp-head">{news.head.jp}</p>
            </div>
            <SmartLink className="arrow" href={news.link.href}>
              {news.link.label}
            </SmartLink>
          </div>

          <div className="news">
            {news.items.map((item) => (
              <SmartLink
                key={item.date}
                className="ncard rise"
                {...(item.delay
                  ? { style: styleVars({ "--d": item.delay }) }
                  : {})}
                href={item.href}
              >
                <span className="ncard__date">{item.date}</span>
                <span className="ncard__t">{item.t}</span>
                <span className="arrow">{news.readLabel}</span>
              </SmartLink>
            ))}
          </div>
        </div>
      </section>

      {/* ============ MANIFESTO ============ */}
      <section className="panel panel--wine manifesto">
        <div className="panel__dots panel__dots--red" aria-hidden="true"></div>
        <div className="wrap">
          <p className="manifesto__mark" style={{ color: "var(--red)" }}>
            {manifesto.mark}
          </p>
          <p className="manifesto__t rise">{renderInline(manifesto.t)}</p>
          <p className="manifesto__by" style={{ color: "var(--red)" }}>
            {manifesto.by}
          </p>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section
        className="section"
        style={{ paddingTop: "clamp(40px,5vw,72px)" }}
      >
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
