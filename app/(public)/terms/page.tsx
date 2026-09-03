import { Fragment } from "react";
import type { Metadata } from "next";
import { getDocument } from "@/lib/content/load";
import { renderInline } from "@/lib/content/inline";
import type { TermsBlock } from "@/lib/content/types";

export async function generateMetadata(): Promise<Metadata> {
  const terms = await getDocument("terms");
  return {
    title: terms.meta.title,
    description: terms.meta.description,
  };
}

function renderBlock(block: TermsBlock, index: number) {
  if (block.t === "p") {
    return <p key={index}>{renderInline(block.value)}</p>;
  }

  return (
    <ol key={index}>
      {block.items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}

export default async function TermsPage() {
  const terms = await getDocument("terms");
  const { head, intro, chapters, footer } = terms;

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">{head.eyebrow}</span>
          <h1 className="display display--sm">{renderInline(head.title)}</h1>
          <p className="page-head__jp">{head.jp}</p>
          <p className="page-head__lead lead">{head.lead}</p>
          <div className="doc__tocs">
            {head.toc.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </div>
        </div>
      </section>

      <section className="doc">
        <div className="wrap">
          <div className="doc__sheet">
            <p className="doc__intro">{renderInline(intro)}</p>

            {chapters.map((chapter) => (
              <Fragment key={chapter.id}>
                <h2 id={chapter.id}>{chapter.title}</h2>

                {chapter.articles.map((article) => (
                  <Fragment key={article.title}>
                    <h3>{article.title}</h3>
                    {article.blocks.map(renderBlock)}
                  </Fragment>
                ))}
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
