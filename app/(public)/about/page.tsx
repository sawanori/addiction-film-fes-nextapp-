import type { Metadata } from "next";
import SmartLink from "@/components/SmartLink";
import { styleVars } from "@/lib/style";
import { about } from "@/lib/content/documents";
import { renderInline } from "@/lib/content/inline";

export const metadata: Metadata = {
  title: about.meta.title,
  description: about.meta.description,
};

export default function AboutPage() {
  const { head, background, approach, outline, org, partner, contact } = about;

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

      {/* 開催の背景 */}
      <section className="section">
        <div className="wrap">
          <div className="cols-2">
            {background.boxes.map((box) => (
              <div
                key={box.h}
                className={box.variant === "dark" ? "box box--dark rise" : "box rise"}
                {...(box.delay ? { style: styleVars({ "--d": box.delay }) } : {})}
              >
                <h3>{box.h}</h3>
                <p>{box.p1}</p>
                <p style={{ marginTop: "14px" }}>{box.p2}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3つのアプローチ */}
      <section className="panel panel--wine" id="approach">
        <div className="panel__dots" aria-hidden="true"></div>
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow" style={{ color: "var(--red)" }}>
                {approach.head.eyebrow}
              </span>
              <h2
                className="display display--sm"
                style={{ color: "var(--white)" }}
              >
                {approach.head.title}
              </h2>
              <p className="jp-head" style={{ color: "var(--red)" }}>
                {approach.head.jp}
              </p>
            </div>
          </div>

          <div className="rows" style={{ borderColor: "var(--rule-w)" }}>
            {approach.items.map((item) => (
              <div
                key={item.no}
                className="row-item rise"
                style={
                  item.delay
                    ? styleVars({ "--d": item.delay, borderColor: "var(--rule-w)" })
                    : { borderColor: "var(--rule-w)" }
                }
              >
                <span
                  className="row-item__no"
                  style={{ color: "var(--red)" }}
                >
                  {item.no}
                </span>
                <div>
                  <p
                    className="row-item__t"
                    style={{ color: "var(--white)" }}
                  >
                    {item.title}
                  </p>
                  <p
                    className="row-item__d"
                    style={{ color: "var(--mute)" }}
                  >
                    {item.desc}
                  </p>
                </div>
                <p
                  className="row-item__meta"
                  style={{ color: "var(--mute)" }}
                >
                  {item.meta}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 開催概要 */}
      <section className="section" id="outline">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">{outline.head.eyebrow}</span>
              <h2 className="display display--sm">{outline.head.title}</h2>
              <p className="jp-head">{outline.head.jp}</p>
            </div>
          </div>
          <table className="table">
            <tbody>
              {outline.rows.map((row, i) => (
                <tr key={row.label}>
                  <td {...(i === 0 ? { style: { width: "180px" } } : {})}>
                    <strong>{row.label}</strong>
                  </td>
                  <td>{renderInline(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 実行委員会 */}
      <section className="section" id="org" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">{org.head.eyebrow}</span>
              <h2 className="display display--sm">{org.head.title}</h2>
              <p className="jp-head">{org.head.jp}</p>
            </div>
          </div>
          <div className="cols-3">
            {org.boxes.map((box) => (
              <div
                key={box.h}
                className="box rise"
                {...(box.delay ? { style: styleVars({ "--d": box.delay }) } : {})}
              >
                <h3>{box.h}</h3>
                <p>{box.p}</p>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: "16px" }}>{org.note}</p>
        </div>
      </section>

      {/* パートナー募集 */}
      <section className="section" id="partner" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-bar rise">
            <p className="cta-bar__t">{partner.cta.text}</p>
            <SmartLink className="arrow" href={partner.cta.link.href}>
              {partner.cta.link.label}
            </SmartLink>
          </div>

          <div className="cols-3" style={{ marginTop: "24px" }}>
            {partner.boxes.map((box) => (
              <div
                key={box.h}
                className="box rise"
                {...(box.delay ? { style: styleVars({ "--d": box.delay }) } : {})}
              >
                <h3>{box.h}</h3>
                <p>{box.p}</p>
                <SmartLink
                  className="arrow"
                  href={box.link.href}
                  style={{ marginTop: "14px" }}
                >
                  {box.link.label}
                </SmartLink>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* お問い合わせ */}
      <section className="panel" id="contact">
        <div className="panel__dots panel__dots--red" aria-hidden="true"></div>
        <div className="wrap">
          <div className="panel__grid">
            <div className="rise">
              <span className="eyebrow" style={{ color: "var(--red)" }}>
                {contact.eyebrow}
              </span>
              <h2
                className="display display--sm"
                style={{ color: "var(--white)", marginTop: "8px" }}
              >
                {renderInline(contact.title)}
              </h2>
            </div>
            <div
              className="rise"
              style={styleVars({ "--d": contact.gridDelay })}
            >
              <table className="table table--dark">
                <tbody>
                  {contact.rows.map((row, i) => (
                    <tr key={row.label}>
                      <td {...(i === 0 ? { style: { width: "200px" } } : {})}>
                        {row.label}
                      </td>
                      <td>{renderInline(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p
                className="small"
                style={{ color: "var(--mute)", marginTop: "16px" }}
              >
                {contact.note}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
