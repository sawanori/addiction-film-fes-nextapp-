import type { Metadata } from "next";
import SmartLink from "@/components/SmartLink";
import { styleVars } from "@/lib/style";
import { getDocument } from "@/lib/content/load";
import { renderInline } from "@/lib/content/inline";

export async function generateMetadata(): Promise<Metadata> {
  const news = await getDocument("news");
  return {
    title: news.meta.title,
    description: news.meta.description,
  };
}

export default async function NewsPage() {
  const news = await getDocument("news");
  const { head, latest, archive, press } = news;

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">{head.eyebrow}</span>
          <h1 className="display">{head.title}</h1>
          <p className="page-head__jp">{head.jp}</p>
          <p className="page-head__lead lead">{head.lead}</p>
        </div>
      </section>

      {/* 最新 */}
      <section className="section">
        <div className="wrap">
          <div className="sections-grid">
            {latest.articles.map((article, i) => {
              const scardClasses = ["scard"];
              if (i === 0) scardClasses.push("scard--tall");
              if (article.variant === "red") scardClasses.push("scard--red");
              scardClasses.push("rise");

              return (
                <SmartLink
                  key={article.no}
                  className={scardClasses.join(" ")}
                  href={article.href}
                  {...(article.delay ? { style: styleVars({ "--d": article.delay }) } : {})}
                >
                  <span className="scard__no">{article.no}</span>
                  <span className="scard__dots" aria-hidden="true"></span>
                  <span>
                    <span className="ecard__k" style={{ color: "var(--red)" }}>
                      {article.kind}
                    </span>
                    <span
                      className="scard__jp"
                      style={
                        i === 0
                          ? {
                              fontSize: "clamp(19px,2vw,28px)",
                              marginTop: "10px",
                            }
                          : {}
                      }
                    >
                      {article.title}
                    </span>
                    <span className="scard__d">{article.desc}</span>
                  </span>
                </SmartLink>
              );
            })}
          </div>
        </div>
      </section>

      {/* 一覧 */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">{archive.head.eyebrow}</span>
              <h2 className="display display--sm">{archive.head.title}</h2>
              <p className="jp-head">{archive.head.jp}</p>
            </div>
          </div>

          <div className="rows">
            {archive.items.map((item) => (
              <SmartLink
                key={item.title}
                className="row-item rise"
                href={item.href}
                {...(item.delay ? { style: styleVars({ "--d": item.delay }) } : {})}
              >
                <span className="row-item__no">
                  {item.date.year}
                  <br />
                  <span style={{ fontSize: ".5em" }}>{item.date.day}</span>
                </span>
                <div>
                  <p className="row-item__t">{item.title}</p>
                  <p className="row-item__d">{item.desc}</p>
                </div>
                <p className="row-item__meta">{item.meta}</p>
              </SmartLink>
            ))}
          </div>

          <p className="small muted" style={{ marginTop: "20px" }}>
            {archive.note}
          </p>
        </div>
      </section>

      {/* プレス */}
      <section className="panel" id="press">
        <div className="panel__dots" aria-hidden="true"></div>
        <div className="wrap">
          <div className="panel__grid">
            <div className="rise">
              <span className="eyebrow" style={{ color: "var(--red)" }}>
                {press.eyebrow}
              </span>
              <h2
                className="display display--sm"
                style={{ color: "var(--white)", marginTop: "8px" }}
              >
                {renderInline(press.title)}
              </h2>
            </div>
            <div className="rise" style={styleVars({ "--d": press.gridDelay })}>
              <p className="panel__lead">{renderInline(press.lead)}</p>
              <p className="panel__body">{press.body}</p>
              <div
                style={{
                  marginTop: "22px",
                  display: "flex",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                {press.buttons.map((button) => (
                  <SmartLink
                    key={button.label}
                    className={`btn btn--${button.variant}`}
                    href={button.href}
                  >
                    {button.label}
                  </SmartLink>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
