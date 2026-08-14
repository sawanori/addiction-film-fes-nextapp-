import { Fragment } from "react";
import type { Metadata } from "next";
import { getDocument } from "@/lib/content/load";
import { renderInline } from "@/lib/content/inline";
import type { PrivacyBlock } from "@/lib/content/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const privacy = await getDocument("privacy");
  return {
    title: privacy.meta.title,
    description: privacy.meta.description,
  };
}

/** 条文本文の1ブロック。段落・箇条書き・表の DOM はここに残し、値だけを JSON から受け取る。 */
function renderBlock(block: PrivacyBlock, key: number) {
  switch (block.kind) {
    case "p":
      return (
        <p key={key} {...(block.cls ? { className: block.cls } : {})}>
          {renderInline(block.text)}
        </p>
      );
    case "ol":
      return (
        <ol key={key}>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "table":
      return (
        <table key={key} className="table">
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

export default async function PrivacyPage() {
  const privacy = await getDocument("privacy");
  const { head, tocs, intro, sections, footer } = privacy;

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">{head.eyebrow}</span>
          <h1 className="display display--sm">{head.title}</h1>
          <p className="page-head__jp">{head.jp}</p>
          <p className="page-head__lead lead">{head.lead}</p>
          <div className="doc__tocs">
            {tocs.map((toc) => (
              <a key={toc.href} href={toc.href}>
                {toc.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="doc">
        <div className="wrap">
          <div className="doc__sheet">
            <p className="doc__intro">{renderInline(intro)}</p>

            {sections.map((section) => (
              <Fragment key={section.id}>
                <h2 id={section.id}>{section.heading}</h2>
                {section.blocks.map(renderBlock)}
              </Fragment>
            ))}

            <div className="doc__meta">
              <p>{renderInline(footer)}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
