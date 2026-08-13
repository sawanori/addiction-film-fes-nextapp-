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

/* ------------------------------------------------------------------ *
 * terms ページ（利用規約・来場規約）
 * ------------------------------------------------------------------ */

export type TermsTocItem = {
  href: string;
  label: string;
};

export type TermsBlock =
  | { t: "p"; value: Inline }
  | { t: "ol"; items: string[] };

export type TermsArticle = {
  title: string;
  blocks: TermsBlock[];
};

export type TermsChapter = {
  id: string;
  title: string;
  articles: TermsArticle[];
};

export type TermsDocument = {
  meta: PageMeta;
  head: {
    eyebrow: string;
    title: Inline;
    jp: string;
    lead: string;
    toc: TermsTocItem[];
  };
  intro: Inline;
  chapters: TermsChapter[];
  footer: Inline;
};

/* ------------------------------------------------------------------ *
 * news ページ
 * ------------------------------------------------------------------ */

export type NewsLatestArticle = {
  no: string;
  kind: string;
  title: string;
  desc: string;
  href: string;
  delay?: string;
  variant?: "red";
};

/** `archive` の日付。`day` に `.5em` のスタイルがつくため Inline ではなく専用の型にする。 */
export type NewsArchiveDate = {
  year: string;
  day: string;
};

export type NewsArchiveItem = {
  date: NewsArchiveDate;
  title: string;
  desc: string;
  meta: string;
  href: string;
  delay?: string;
};

export type NewsPressButton = {
  label: string;
  href: string;
  variant: "light" | "red";
};

export type NewsDocument = {
  meta: PageMeta;
  head: {
    eyebrow: string;
    title: string;
    jp: string;
    lead: string;
  };
  latest: {
    articles: NewsLatestArticle[];
  };
  archive: {
    head: SectionHead;
    items: NewsArchiveItem[];
    note: string;
  };
  press: {
    eyebrow: string;
    title: Inline;
    lead: Inline;
    body: string;
    buttons: NewsPressButton[];
    gridDelay: string;
  };
};

/* ------------------------------------------------------------------ *
 * privacy ページ（プライバシーポリシー）
 * ------------------------------------------------------------------ */

/** ページ頭の目次（`.doc__tocs`）の1項目。ページ内アンカーへのリンク。 */
export type PrivacyTocItem = {
  href: string;
  label: string;
};

/** 条文テーブル（`.table`）の1行。現行の2表はいずれも素の文字列のみ。 */
export type PrivacyTableRow = {
  label: string;
  value: string;
};

/**
 * 条文本文の1ブロック。段落・箇条書き・表の3種。
 * 段落は <strong> を含むものと `<p class="small muted">` の注記があるため
 * Inline と `cls` で表す。箇条書きと表の中身は現行すべて素の文字列。
 */
export type PrivacyBlock =
  | { kind: "p"; text: Inline; cls?: string }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; rows: PrivacyTableRow[] };

/** 条文の1節（`<h2 id="sN">` とその本文）。 */
export type PrivacySection = {
  id: string;
  heading: string;
  blocks: PrivacyBlock[];
};

export type PrivacyDocument = {
  meta: PageMeta;
  head: {
    eyebrow: string;
    title: string;
    jp: string;
    lead: string;
  };
  tocs: PrivacyTocItem[];
  intro: Inline;
  sections: PrivacySection[];
  footer: Inline;
};

/* ------------------------------------------------------------------ *
 * about ページ
 * ------------------------------------------------------------------ */

/** 「開催の背景」の `.box` 1枚。段落を2つ持ち、2つ目には marginTop 14px が付く。 */
export type AboutBackgroundBox = {
  h: string;
  p1: string;
  p2: string;
  delay?: string;
  /** `dark` は `.box--dark`（1枚目のみ）。 */
  variant?: "dark";
};

/** 「3つのアプローチ」の `.row-item` 1行。 */
export type AboutApproachItem = {
  no: string;
  title: string;
  desc: string;
  meta: string;
  delay?: string;
};

/** 開催概要テーブルの1行。label は `<strong>` で包む。値は `<span class="small muted">`・`<br>`・文中リンクを含む。 */
export type AboutOutlineRow = {
  label: string;
  value: Inline;
};

/** 実行委員会の `.box` 1枚。 */
export type AboutOrgBox = {
  h: string;
  p: string;
  delay?: string;
};

/** パートナー募集の `.box` 1枚。`#contact` または `/news#press` への `.arrow` リンクを持つ。 */
export type AboutPartnerBox = {
  h: string;
  p: string;
  delay?: string;
  link: { label: string; href: string };
};

/** お問い合わせテーブルの1行。label は素の文字列（`<strong>` なし）。 */
export type AboutContactRow = {
  label: string;
  value: Inline;
};

export type AboutDocument = {
  meta: PageMeta;
  head: {
    eyebrow: string;
    /** `Bias into<br>Dialogue`。 */
    title: Inline;
    jp: string;
    lead: string;
  };
  background: {
    boxes: AboutBackgroundBox[];
  };
  approach: {
    head: SectionHead;
    items: AboutApproachItem[];
  };
  outline: {
    head: SectionHead;
    rows: AboutOutlineRow[];
  };
  org: {
    head: SectionHead;
    boxes: AboutOrgBox[];
    note: string;
  };
  partner: {
    cta: { text: string; link: { label: string; href: string } };
    boxes: AboutPartnerBox[];
  };
  contact: {
    eyebrow: string;
    /** `Get in<br>Touch`。 */
    title: Inline;
    rows: AboutContactRow[];
    note: string;
    gridDelay: string;
  };
};
