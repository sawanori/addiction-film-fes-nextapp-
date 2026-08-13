import { Fragment } from "react";
import type { Metadata } from "next";
import SmartLink from "@/components/SmartLink";
import { styleVars } from "@/lib/style";
import { tickets } from "@/lib/content/documents";
import { renderInline } from "@/lib/content/inline";
import type { Box } from "@/lib/content/types";

export const metadata: Metadata = {
  title: tickets.meta.title,
  description: tickets.meta.description,
};

/** `.box` の style。遅延が無い1枚目だけ style 属性そのものを付けない（変換元と同じ）。 */
function boxStyle(box: Box, extra?: Record<string, string>) {
  if (box.delay) return styleVars({ "--d": box.delay, ...extra });
  return extra;
}

export default function TicketsPage() {
  const { head, price, novelty, faq } = tickets;

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

      {/* 券種 */}
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">{price.head.eyebrow}</span>
              <h2 className="display display--sm">{price.head.title}</h2>
              <p className="jp-head">{price.head.jp}</p>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                {price.columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {price.rows.map((row) => (
                <tr key={row.type}>
                  <td>
                    <strong>{row.type}</strong>
                  </td>
                  <td>{row.desc}</td>
                  <td>{row.price}</td>
                  <td>{row.sale}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: "16px" }}>{price.note}</p>

          <div className="cols-3" style={{ marginTop: "32px" }}>
            {price.boxes.map((box) => (
              <div
                key={box.h}
                className="box rise"
                {...(box.delay ? { style: boxStyle(box) } : {})}
              >
                <h3>{box.h}</h3>
                <p>{renderInline(box.p)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ノベルティ */}
      <section className="panel panel--wine" id="novelty">
        <div className="panel__dots panel__dots--red" aria-hidden="true"></div>
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow" style={{ color: "var(--red)" }}>
                {novelty.head.eyebrow}
              </span>
              <h2
                className="display display--sm"
                style={{ color: "var(--white)" }}
              >
                {novelty.head.title}
              </h2>
              <p className="jp-head" style={{ color: "var(--red)" }}>
                {novelty.head.jp}
              </p>
            </div>
          </div>

          <p className="panel__lead" style={{ maxWidth: "26ch" }}>
            {renderInline(novelty.lead)}
          </p>
          <p className="panel__body">{novelty.body}</p>

          <div className="cols-3" style={{ marginTop: "32px" }}>
            {novelty.boxes.map((box) => (
              <div
                key={box.h}
                className="box box--dark rise"
                style={boxStyle(box, { borderColor: "var(--red)" })}
              >
                <h3 style={{ color: "var(--red)" }}>{box.h}</h3>
                <p>{renderInline(box.p)}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "28px" }}>
            <SmartLink className="btn btn--light" href={novelty.cta.href}>
              {novelty.cta.label}
            </SmartLink>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">{faq.head.eyebrow}</span>
              <h2 className="display display--sm">{faq.head.title}</h2>
              <p className="jp-head">{faq.head.jp}</p>
            </div>
          </div>
          <dl className="faq cols-2">
            {faq.columns.map((column, i) => (
              <div key={i}>
                {column.map((item) => (
                  <Fragment key={item.q}>
                    <dt>{item.q}</dt>
                    <dd>{item.a}</dd>
                  </Fragment>
                ))}
              </div>
            ))}
          </dl>
          <p className="small muted" style={{ marginTop: "20px" }}>{faq.note}</p>
        </div>
      </section>
    </>
  );
}
