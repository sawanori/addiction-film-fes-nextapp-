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
    /** 申し込みフォーム（外部URL）へのボタンと、その下の注意書き。 */
    apply: {
      label: string;
      href: string;
      note: string;
    };
    boxes: Box[];
  };
  /** 会場で売る書籍の案内。 */
  books: {
    head: SectionHead;
    /** 書影。`.cols-2` の左半分に置く（右は `lead`）。 */
    img: { src: string; alt: string };
    lead: string;
    boxes: Box[];
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

/* ------------------------------------------------------------------ *
 * films ドキュメント（index / programme 共有の上映作品グリッド）
 * ------------------------------------------------------------------ */

/** テキスト付きリンク（`.arrow` など）。 */
export type TextLink = {
  label: string;
  href: string;
};

/**
 * 予告編（変換元 `<button class="film__play" data-trailer="…">` 相当）。
 * `id` が空でない作品だけサムネイルに再生ボタンが出る。空なら静止画のまま。
 *
 * `content/films.json` では全作品が4キーを持つ（未登録は空文字）。
 * ただし各フィールドを任意にしてあるのは、**古いリビジョンへ revert したときや
 * DB が旧形のときでも公開ページを落とさない**ため（`lib/content/load.ts` と同じ方針）。
 */
export type FilmTrailer = {
  /**
   * YouTube の動画ID（`data-trailer`）。空文字なら再生ボタンを出さない。
   * 管理画面では動画URLを貼れて、保存時にIDへ変換される（`lib/content/youtube.ts`）。
   */
  id: string;
  /** 再生開始秒（`data-trailer-start`）。空文字なら最初から。変換元では 05 のみ "3"。 */
  start?: string;
  /** 再生ボタンの aria-label。空なら `components/Films.tsx` が作品名から作る。 */
  aria?: string;
  /** `.film__play-label` の文言。空なら `Trailer`（表示は CSS で大文字化される）。 */
  label?: string;
};

/** 上映作品1本。`meta` は `<br>` を含むため Inline。 */
export type Film = {
  no: string;
  time: string;
  /** `film--lead`（01・02のみ）。 */
  lead: boolean;
  delay?: string;
  /** `loading="lazy"` を付けるか（01のみ false）。 */
  lazy: boolean;
  img: string;
  alt: string;
  k: string;
  t: string;
  en: string;
  meta: Inline;
  /**
   * programme でだけ使うクレジット。
   * 変換元では 04「一瞬の楽園」だけが2ページで異なり
   * （index は短縮版、programme は公式チラシどおりの全文）、
   * 04 にだけこのフィールドがある。
   */
  metaProgramme?: Inline;
  /** 予告編が公開されている作品にだけある（変換元では 04・05）。 */
  trailer?: FilmTrailer;
  d: string;
};

/** 予告編モーダル（`.vmodal`）の文言。index / programme の両ページ末尾に同じものが出る。 */
export type FilmsTrailerModal = {
  /** `.vmodal__t` の初期値。開くと作品タイトルに置き換わる。 */
  title: string;
  close: string;
  note: string;
};

export type FilmsDocument = {
  items: Film[];
  /** `.films__note` の注記。 */
  note: string;
  trailerModal: FilmsTrailerModal;
};

/* ------------------------------------------------------------------ *
 * timetable ドキュメント（programme の日付スライド）
 * ------------------------------------------------------------------ */

export type TimetableRow = {
  time: string;
  /** `<strong>作品名</strong>（分数）` の形式を含むため Inline。 */
  program: Inline;
};

/** 1日ぶん。タブとシートの両方がこの配列から生成される。 */
export type TimetableDay = {
  d: string;
  j: string;
  rows: TimetableRow[];
};

export type TimetableArrow = {
  dir: number;
  label: string;
  glyph: string;
};

export type TimetableDocument = {
  days: TimetableDay[];
  /** 表の列見出し（時間／プログラム）。 */
  columns: [string, string];
  /** スワイプ領域（`.timetable__track`）の aria-label。 */
  trackLabel: string;
  hint: string;
  arrows: TimetableArrow[];
};

/* ------------------------------------------------------------------ *
 * index ページ
 * ------------------------------------------------------------------ */

export type HeroSlide = {
  src: string;
  alt: string;
  lazy: boolean;
  /** 対応するドットの aria-label（`キービジュアル N枚目を表示`）。 */
  dotLabel: string;
};

export type HeroMetaItem = {
  term: string;
  desc: string;
};

export type HeroAction = {
  label: string;
  href: string;
  /** `light` は `.btn--light`（チケット情報）。 */
  variant?: "light";
};

/** ヒーロー（`components/Hero.tsx` に渡す静的データ。制御ロジックは含まない）。 */
export type IndexHero = {
  slides: HeroSlide[];
  /** スライド群（`#heroSlides`）の aria-label。 */
  slidesLabel: string;
  /** `.hero__edition` の eyebrow 2つ。 */
  edition: [string, string];
  /** h1 の2行（各行が `<span>`）。 */
  titleLines: [string, string];
  jp: string;
  meta: HeroMetaItem[];
  actions: HeroAction[];
};

/** QUICK LINKS の `.qcard` 1枚。 */
export type QuickCard = {
  t: string;
  jp: string;
  d: string;
  href: string;
  delay?: string;
};

/** 3 APPROACHES の `.scard` 1枚。 */
export type ApproachCard = {
  no: string;
  t: string;
  jp: string;
  d: string;
  href: string;
  delay?: string;
  /** `tall` は `.scard--tall`（01）、`red` は `.scard--red`（03）。 */
  variant?: "tall" | "red";
};

/** FORMAT セクションの `.box` 1枚。`dark` は `.box--dark`（観る・持ち帰る）。 */
export type FormatBox = {
  h: string;
  p: string;
  delay?: string;
  variant?: "dark";
};

/** FORMAT セクションの `.row-item` 1行。`meta` はリンクを含むため Inline。 */
export type FormatRow = {
  no: string;
  t: string;
  d: string;
  meta: Inline;
  delay?: string;
};

/** ナビゲーター紹介の `.navigator__facts` 1項目（`<b>` + `<span>`）。 */
export type NavigatorFact = {
  b: string;
  text: string;
};

/** NEWS セクションの `.ncard` 1枚。 */
export type IndexNewsItem = {
  date: string;
  t: string;
  href: string;
  delay?: string;
};

export type IndexDocument = {
  meta: PageMeta;
  hero: IndexHero;
  quick: {
    cards: QuickCard[];
  };
  statement: {
    /** `Why<br>Now`。 */
    title: Inline;
    link: TextLink;
    /** `<em>` を含む。 */
    lead: Inline;
    note: { k: string; p: string };
  };
  approach: {
    head: SectionHead;
    link: TextLink;
    cards: ApproachCard[];
  };
  /** FILMS セクションの見出しとリンク。作品データは films ドキュメント。 */
  films: {
    head: SectionHead;
    link: TextLink;
  };
  format: {
    head: {
      eyebrow: string;
      /** `1 Film,<br>1 Talk`。 */
      title: Inline;
      jp: string;
    };
    link: TextLink;
    boxes: FormatBox[];
    rows: FormatRow[];
  };
  navigator: {
    badge: string;
    img: { src: string; alt: string };
    eyebrow: string;
    /** `Guide<br>the Two Days`。 */
    title: Inline;
    k: string;
    name: string;
    en: string;
    lead: string;
    d: string;
    facts: NavigatorFact[];
    note: string;
  };
  news: {
    head: SectionHead;
    link: TextLink;
    /** 各カードの `.arrow` の文言（全カード共通）。 */
    readLabel: string;
    items: IndexNewsItem[];
  };
  manifesto: {
    /** `“` の引用マーク。 */
    mark: string;
    /** `映画の力で、<br>偏見を対話に変える。` */
    t: Inline;
    by: string;
  };
  cta: {
    t: string;
    link: TextLink;
  };
};

/* ------------------------------------------------------------------ *
 * programme ページ
 * ------------------------------------------------------------------ */

/** 「上映の考え方」の `.row-item` 1行。`title` は `<span class="small muted">`、`meta` は `<br>`・リンクを含む。 */
export type ProgrammeGuideRow = {
  no: string;
  /** 行全体に付く id（`talk` / `navigator`）。01には無い。 */
  id?: string;
  title: Inline;
  desc: string;
  meta: Inline;
  delay?: string;
};

/** 会場セクションの `.box` 1枚。1枚目の `p` は素文だが、2枚目は `<br>` を含むため `p` は Inline に統一。 */
export type ProgrammeVenueBox = {
  h: string;
  p: Inline;
  /** `marginTop: 14px` の段落。 */
  p2: string;
  /** 2枚目の `p2` に付く `small muted`。 */
  p2Cls?: string;
  delay?: string;
  /** `dark` は `.box--dark`（1枚目のみ）。 */
  variant?: "dark";
};

export type ProgrammeDocument = {
  meta: PageMeta;
  head: {
    eyebrow: string;
    /** `1 Film,<br>1 Talk`。 */
    title: Inline;
    jp: string;
    lead: string;
  };
  /** FILMS セクションの見出しとリンク。作品データは films ドキュメント。 */
  films: {
    head: SectionHead;
    link: TextLink;
  };
  guide: {
    rows: ProgrammeGuideRow[];
  };
  /** タイムテーブル枠の見出しと注記。日付データは timetable ドキュメント。 */
  timetable: {
    eyebrow: string;
    title: string;
    jp: string;
    note: string;
  };
  venue: {
    head: SectionHead;
    link: TextLink;
    boxes: ProgrammeVenueBox[];
    /** 住所と周辺地図。地図は Google マップの埋め込み（API キーの要らない `output=embed` 形式）。 */
    access: {
      h: string;
      address: string;
      map: { src: string; title: string };
      /** 最寄り駅と出口。改行で区切る。 */
      routes: Inline;
      note: string;
    };
  };
  cta: {
    t: string;
    link: TextLink;
  };
};

/* ------------------------------------------------------------------ *
 * site ドキュメント（全ページ共通ヘッダー / フッター）
 * ------------------------------------------------------------------ */

/** ページ内アンカーを含む共通ナビリンク。`hash` が空文字なら通常のページリンク。 */
export type SiteLink = {
  label: string;
  base: string;
  hash: string;
};

export type SiteBrand = {
  base: string;
  hash: string;
  en: string;
  date: string;
  jp: string;
};

export type SitePathnameLink = {
  label: string;
  href: "pathname";
};

export type SiteHeaderContent = {
  brand: SiteBrand;
  nav: SiteLink[];
  extra: SiteLink[];
  toggleLabel: {
    open: string;
    close: string;
  };
  partners: string[];
  utility: {
    chip: string;
    press: SiteLink;
    contact: SiteLink;
    language: SitePathnameLink;
  };
};

export type SiteFooterTextItem = {
  label: string;
};

export type SiteFooterItem = SiteLink | SiteFooterTextItem;

export type SiteFooterColumn = {
  heading: string;
  items: SiteFooterItem[];
};

export type SiteFooterContent = {
  columns: SiteFooterColumn[];
  note: string;
  legal: SiteLink[];
  copy: string;
};

export type SiteDocument = {
  header: SiteHeaderContent;
  footer: SiteFooterContent;
};
