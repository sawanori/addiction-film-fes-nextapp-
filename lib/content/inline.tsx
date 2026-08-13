import { createElement, Fragment, type ReactNode } from "react";
import SmartLink from "@/components/SmartLink";
import type { Inline, InlineNode } from "@/lib/content/types";

/**
 * `Inline` を JSX に戻す。
 *
 * JSX 記法ではなく `createElement` で組み立てているのは意図的。JSX で書くと
 * 行頭・行末の改行がテキストノードに空白として混入する事故経路があり
 * （`components/SiteFooter.tsx` に同じ理由のコメントがある）、
 * レンダラ自身がその経路を持ち込むのを避けたい。
 *
 * 隣接する文字列は呼び出し側（データ側）で1本に連結しておくこと。
 * React の SSR は隣接テキストノードの境界に `<!-- -->` を挿入するため、
 * 連続した文字列要素があると変換元との差分になる。
 * 現行8ページのコメントノードは0個で、`npm run verify:text` がこれを検査する。
 */
function renderNode(node: InlineNode, key: number): ReactNode {
  if (typeof node === "string") return node;

  if (node.t === "br") return createElement("br", { key });

  if (node.t === "link") {
    return createElement(
      SmartLink,
      {
        key,
        href: node.href,
        ...(node.cls ? { className: node.cls } : {}),
      },
      ...node.c.map(renderNode)
    );
  }

  if (node.t === "span") {
    return createElement(
      "span",
      { key, ...(node.cls ? { className: node.cls } : {}) },
      ...node.c.map(renderNode)
    );
  }

  return createElement(node.t, { key }, ...node.c.map(renderNode));
}

export function renderInline(value: Inline): ReactNode {
  return createElement(Fragment, null, ...value.map(renderNode));
}
