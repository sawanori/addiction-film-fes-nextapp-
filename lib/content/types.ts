/**
 * 管理画面から編集するコンテンツの型。
 *
 * 公開ページの DOM 構造・class 名はコード側（TSX）に残し、
 * その中に流し込む「値」だけをこの型で表す。構造ごと編集可能にすると
 * 変換元HTMLとの完全一致（CLAUDE.md の不変条件）を守れなくなるため。
 */

/**
 * 文中に装飾やリンクを含むテキスト。
 *
 * 現行の8ページには `<br>` 40件・`<strong>` 22件・`<b>` 5件・`<em>` 3件に加えて、
 * 文中の `<span class="small muted">` と文中リンク（`app/(public)/legal/page.tsx`）が存在する。
 * 素の文字列では表現できないため、許可タグを絞った構造で持つ。
 *
 * `dangerouslySetInnerHTML` を使わないので、ここに表現できないタグは
 * そもそも保存も描画もできない（保存型XSSの面積を構造的に小さくしている）。
 */
export type InlineNode =
  | string
  | { t: "br" }
  | { t: "strong" | "em" | "b"; c: InlineNode[] }
  | { t: "span"; cls?: string; c: InlineNode[] }
  | { t: "link"; href: string; cls?: string; c: InlineNode[] };

export type Inline = InlineNode[];

/** ページの `<title>` と `<meta name="description">`。 */
export type PageMeta = {
  title: string;
  description: string;
};

/** セクション見出しの3点セット（eyebrow / 英字見出し / 日本語見出し）。 */
export type SectionHead = {
  eyebrow: string;
  title: string;
  jp: string;
};

/** `.box` 1枚。`delay` は `--d` カスタムプロパティに入るアニメーション遅延。 */
export type Box = {
  h: string;
  p: Inline;
  delay?: string;
};

/* ------------------------------------------------------------------ *
 * tickets ページ
 * ------------------------------------------------------------------ */

export type TicketRow = {
  type: string;
  desc: string;
  price: string;
  sale: string;
};

export type FaqItem = {
  q: string;
  a: string;
};

export type TicketsDocument = {
  meta: PageMeta;
  head: {
    eyebrow: string;
    title: string;
    jp: string;
    lead: string;
  };
  price: {
    head: SectionHead;
    columns: [string, string, string, string];
    rows: TicketRow[];
    note: string;
    boxes: Box[];
  };
  novelty: {
    head: SectionHead;
    lead: Inline;
    body: string;
    boxes: Box[];
    cta: { label: string; href: string };
  };
  faq: {
    head: SectionHead;
    /** 変換元は `.faq.cols-2` の中に列が2つあり、各列に3組ずつ入っている。 */
    columns: FaqItem[][];
    note: string;
  };
};

/* ------------------------------------------------------------------ *
 * legal ページ（特定商取引法に基づく表記）
 * ------------------------------------------------------------------ */

/** 表記テーブルの1行。値は文中に `<br>`・`<span>`・リンクを含む。 */
export type LegalRow = {
  label: string;
  value: Inline;
};

export type LegalDocument = {
  meta: PageMeta;
  head: {
    eyebrow: string;
    title: string;
    jp: string;
    lead: string;
  };
  intro: Inline;
  rows: LegalRow[];
  related: {
    heading: string;
    items: Inline[];
  };
  footer: Inline;
};
