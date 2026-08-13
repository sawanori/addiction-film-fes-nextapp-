import type { Metadata } from "next";
import { legal } from "@/lib/content/documents";
import { renderInline } from "@/lib/content/inline";

export const metadata: Metadata = {
  title: legal.meta.title,
  description: legal.meta.description,
};

export default function LegalPage() {
  const { head, intro, rows, related, footer } = legal;

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">{head.eyebrow}</span>
          <h1 className="display display--sm">{head.title}</h1>
          <p className="page-head__jp">{head.jp}</p>
          <p className="page-head__lead lead">{head.lead}</p>
        </div>
      </section>

      <section className="doc">
        <div className="wrap">
          <div className="doc__sheet">
            <p className="doc__intro">{renderInline(intro)}</p>

            <table className="table">
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{renderInline(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>{related.heading}</h2>
            <ul>
              {related.items.map((item, i) => (
                <li key={i}>{renderInline(item)}</li>
              ))}
            </ul>

            <div className="doc__meta">
              <p>{renderInline(footer)}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
