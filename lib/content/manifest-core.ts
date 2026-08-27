/**
 * manifest（管理画面のフォーム定義）の導出ロジック。
 *
 * **このファイルは何も import しない。** `@/` エイリアスや JSON import を含めると
 * `scripts/verify-coverage.mjs`（Node が TypeScript を直接読む）から使えなくなるため。
 * アプリ側の入口は `lib/content/manifest.ts`。
 *
 * 手書きのフィールド一覧を持たず、実データの形から機械的に導出する。手書きにすると
 * 「型にはあるがフォームに出ていない項目」が生まれ、編集網羅性
 * （`docs/implementation-plan.md` §5）が成り立たなくなるため。
 *
 * パス表記:
 * - 正規化パス（manifest）… 配列の添字を伏せる。例 `price.rows[].type`
 * - 具体パス（PATCH の ops）… 添字を含む。例 `price.rows.3.type`（計画 §9.2）
 */

export type Field =
  | { type: "text" | "textarea" | "image" | "boolean" | "inline"; path: string; label: string; hint?: string }
  | { type: "group"; path: string; label: string; hint?: string; fields: Field[] }
  | { type: "array"; path: string; label: string; hint?: string; item: Field; template: unknown };

export type DocumentManifest = {
  key: string;
  label: string;
  fields: Field[];
};

/**
 * 項目の表示名と補足説明。
 *
 * **生のキー名（`d` / `k` / `en` / `t` など）をそのまま出すと、説明書なしには何の欄か分からない。**
 * 正規化パス（優先）とキー名の2段構えで日本語名を与え、意味が取りにくいものには補足も付ける。
 * ここに無いキーだけがキー名のまま表示される。
 */

/** 正規化パスごとの表示名（同じキー名でも場所によって意味が違うものはここで上書きする）。 */
const PATH_LABELS: Record<string, [label: string, hint?: string]> = {
  // 共通
  "meta": ["ページ設定", "検索結果やブラウザのタブに出る文字。本文には表示されません"],
  "meta.title": ["ページタイトル", "ブラウザのタブとブックマークに出ます"],
  "meta.description": ["ページの説明文", "検索結果に出る要約。120文字前後が目安です"],

  // films（上映作品。index と programme の両方に出る）
  "items": ["上映作品", "index と programme の両方に同じものが出ます"],
  "items[]": ["作品", ""],
  "items[].no": ["通し番号", "カードの左上に出る 01・02 …"],
  "items[].time": ["上映日時"],
  "items[].lead": ["大きく表示する", "オンにするとカードが1枚分大きくなります"],
  "items[].lazy": ["画像を遅延読み込みする", "画面に入ってから読み込みます。最初に見える作品はオフのままに"],
  "items[].img": ["作品画像"],
  "items[].alt": ["画像の説明", "画像が出ないときや読み上げに使われます"],
  "items[].k": ["ジャンル・上映時間", "例: Documentary ・ 104min"],
  "items[].t": ["作品タイトル"],
  "items[].en": ["監督などの英字表記", "例: Directed by Kevin Hanlon"],
  "items[].meta": ["補足情報", "製作会社など。1行ずつ足せます"],
  "items[].d": ["作品紹介文"],
  "items[].metaProgramme": ["補足情報（programme 用）", "programme ページだけ別の文言にする場合に使います"],
  "items[].trailer": ["予告編", "YouTube の動画IDを入れた作品だけ、サムネイルに再生ボタンが出ます"],
  "items[].trailer.id": ["YouTube の動画ID", "動画URLの v= の後ろの英数字。空欄なら再生ボタンを出しません"],
  "items[].trailer.start": ["再生開始位置（秒）", "例: 3。空欄なら最初から再生します"],
  "items[].trailer.aria": ["再生ボタンの読み上げ文", "例: 『一瞬の楽園』の予告編を再生。画面には出ません"],
  "items[].trailer.label": ["再生ボタンの帯の文字", "例: Trailer"],
  "trailerModal": ["予告編の再生画面", "予告編を開いたときに出る枠。index と programme で共通です"],
  "trailerModal.title": ["見出しの初期値", "開くと作品タイトルに置き換わるため、通常は画面に出ません"],
  "trailerModal.close": ["閉じるボタンの文字"],
  "trailerModal.note": ["注記", "再生画面の下に出る小さな文"],

  // index（トップページ）
  "hero": ["ファーストビュー", "トップページを開いて最初に見える大きな部分"],
  "hero.edition": ["英字の肩書き", "大見出しの上に小さく出る行"],
  "hero.titleLines": ["大見出し", "1行ずつ登録します"],
  "hero.meta": ["開催情報の一覧", "開催日・会場・形式・料金など"],
  "hero.meta[].term": ["項目名", "例: Dates / Venue"],
  "hero.meta[].desc": ["内容"],
  "hero.actions": ["ボタン"],
  "hero.slides": ["背景のスライド画像"],
  "hero.slides[].dotLabel": ["スライドの説明", "下の丸いボタンの読み上げに使われます"],
  "hero.slidesLabel": ["スライド全体の説明", "読み上げ用。画面には出ません"],
  "quick": ["3つの案内カード", "ファーストビューのすぐ下に並ぶカード"],
  "quick.cards[].t": ["見出し（英字）"],
  "quick.cards[].jp": ["見出し（日本語）"],
  "quick.cards[].d": ["説明文"],
  "navigator": ["ナビゲーター紹介"],
  "navigator.badge": ["肩書きバッジ"],
  "navigator.k": ["職業・肩書き"],
  "navigator.name": ["お名前"],
  "navigator.en": ["お名前（英字）"],
  "navigator.facts": ["紹介の箇条書き"],
  "navigator.facts[].b": ["太字にする部分"],
  "manifesto": ["宣言文"],
  "manifesto.mark": ["引用符などの記号"],
  "manifesto.by": ["署名"],
  "news.readLabel": ["「続きを読む」の文字"],

  // site（ヘッダー・フッター）
  "header": ["ヘッダー", "全ページの上部に出ます"],
  "header.brand": ["サイト名まわり"],
  "header.brand.base": ["リンク先のページ"],
  "header.brand.hash": ["リンク先の見出し", "ページ内の位置。空欄ならページの先頭"],
  "header.brand.en": ["サイト名（英字）"],
  "header.brand.jp": ["サイト名（日本語）"],
  "header.brand.date": ["会期の表示"],
  "header.nav": ["メニュー項目"],
  "header.extra": ["メニュー内の追加リンク"],
  "header.partners": ["協賛リンク"],
  "header.utility.chip": ["右上のラベル", "例: DRAFT／仮デザイン"],
  "header.utility.language": ["言語切替"],
  "header.toggleLabel": ["メニューボタンの読み上げ文言"],
  "header.toggleLabel.open": ["開くとき"],
  "header.toggleLabel.close": ["閉じるとき"],
  "footer": ["フッター", "全ページの下部に出ます"],
  "footer.columns": ["フッターの列"],
  "footer.legal": ["規約類へのリンク"],
  "footer.copy": ["著作権表示"],

  // timetable（programme のタイムテーブル）
  "days": ["日ごとのタイムテーブル"],
  "days[].d": ["日のラベル", "例: DAY 1"],
  "days[].j": ["日付の表示", "例: 10月11日（日）"],
  "days[].rows": ["進行"],
  "days[].rows[].time": ["時刻"],
  "days[].rows[].program": ["内容"],
  "trackLabel": ["表全体の説明", "読み上げ用"],
  "hint": ["操作の案内文"],
  "arrows": ["前後の日へ移動するボタン"],
  "arrows[].dir": ["方向", "-1 が前の日、1 が次の日"],
  "arrows[].glyph": ["矢印の記号"],

  // tickets
  "price.rows[].type": ["券種"],
  "price.rows[].sale": ["発売時期"],
  "faq": ["よくある質問"],
  "faq.columns": ["列", "画面上で左右に分かれて並びます"],

  // privacy / terms
  "tocs": ["目次"],
  "sections": ["章"],
  "sections[].id": ["リンク用のID", "目次から飛ぶときの目印。英数字で"],
  "chapters": ["章"],
  "blocks": ["本文ブロック"],
};

/** キー名ごとの表示名（パス指定が無いときのフォールバック）。 */
const FIELD_LABELS: Record<string, [label: string, hint?: string]> = {
  title: ["見出し"],
  description: ["説明文"],
  head: ["セクションの見出し"],
  eyebrow: ["英字の小見出し"],
  jp: ["日本語の見出し"],
  lead: ["リード文"],
  h: ["見出し"],
  p: ["本文"],
  p1: ["本文1"],
  p2: ["本文2"],
  p2Cls: ["本文2の見た目", "空欄で問題ありません"],
  d: ["説明文"],
  desc: ["説明文"],
  text: ["文章"],
  body: ["本文"],
  note: ["注記"],
  intro: ["導入文"],
  footer: ["末尾の文"],
  heading: ["見出し"],
  label: ["表示する文字"],
  href: ["リンク先", "サイト内なら / から始めます。例: /tickets"],
  base: ["リンク先のページ"],
  hash: ["リンク先の見出し", "ページ内の位置。空欄ならページの先頭"],
  link: ["リンク"],
  cta: ["行動をうながす部分"],
  buttons: ["ボタン"],
  actions: ["ボタン"],
  src: ["画像"],
  img: ["画像"],
  alt: ["画像の説明", "画像が出ないときや読み上げに使われます"],
  lazy: ["画像を遅延読み込みする"],
  delay: ["表示アニメの遅れ", "例: .06s。空欄なら遅れなし"],
  gridDelay: ["表示アニメの遅れ"],
  variant: ["見た目の種類", "決められた値だけが使えます。分からなければ触らないでください"],
  cls: ["見た目の種類", "決められた値だけが使えます"],
  kind: ["ブロックの種類", "決められた値だけが使えます"],
  boxes: ["ボックス"],
  rows: ["行"],
  columns: ["列"],
  items: ["項目"],
  cards: ["カード"],
  sections: ["セクション"],
  blocks: ["本文ブロック"],
  articles: ["記事"],
  slides: ["スライド"],
  facts: ["箇条書き"],
  toc: ["目次"],
  q: ["質問"],
  a: ["回答"],
  no: ["番号"],
  time: ["時刻"],
  date: ["日付"],
  year: ["年"],
  day: ["日"],
  name: ["名前"],
  en: ["英字表記"],
  k: ["肩書き・分類"],
  t: ["見出し"],
  b: ["太字にする部分"],
  value: ["内容"],
  term: ["項目名"],
  badge: ["バッジ"],
  chip: ["ラベル"],
  glyph: ["記号"],
  dir: ["方向"],
  id: ["リンク用のID"],
  type: ["種別"],
  sale: ["発売時期"],
  price: ["料金"],
  copy: ["著作権表示"],
  mark: ["記号"],
  by: ["署名"],
  form: ["入力欄"],
  placeholder: ["入力欄の薄い文字"],
  button: ["ボタンの文字"],
  ariaLabel: ["読み上げ用の説明", "画面には出ません"],
  dotLabel: ["読み上げ用の説明", "画面には出ません"],
  slidesLabel: ["読み上げ用の説明", "画面には出ません"],
  trackLabel: ["読み上げ用の説明", "画面には出ません"],
  toggleLabel: ["読み上げ用の説明", "画面には出ません"],
  utility: ["右上の要素"],
  brand: ["サイト名まわり"],
  nav: ["メニュー"],
  extra: ["追加リンク"],
  partners: ["協賛リンク"],
  legal: ["規約類"],
  language: ["言語切替"],
  open: ["開くとき"],
  close: ["閉じるとき"],
  press: ["プレス向け"],
  latest: ["最新のお知らせ"],
  archive: ["過去のお知らせ"],
  related: ["関連リンク"],
  contact: ["お問い合わせ"],
  partner: ["協賛・パートナー"],
  org: ["主催・体制"],
  outline: ["開催概要"],
  background: ["背景"],
  approach: ["取り組み"],
  statement: ["ステートメント"],
  format: ["開催形式"],
  guide: ["ご案内"],
  venue: ["会場"],
  news: ["お知らせ"],
  films: ["上映作品"],
  hero: ["ファーストビュー"],
  quick: ["案内カード"],
  navigator: ["ナビゲーター"],
  manifesto: ["宣言文"],
  trailer: ["予告編"],
  trailerModal: ["予告編の再生画面"],
  timetable: ["タイムテーブル"],
  days: ["日程"],
  arrows: ["前後移動ボタン"],
  chapters: ["章"],
  tocs: ["目次"],
  faq: ["よくある質問"],
  program: ["内容"],
  metaProgramme: ["補足情報"],
  meta: ["補足情報"],
  header: ["ヘッダー"],
};

function labelFor(path: string, key: string): { label: string; hint?: string } {
  const byPath = PATH_LABELS[path];
  if (byPath) return { label: byPath[0], hint: byPath[1] || undefined };
  const byKey = FIELD_LABELS[key];
  if (byKey) return { label: byKey[0], hint: byKey[1] || undefined };
  return { label: key };
}

/** Inline AST で許可しているタグ（lib/admin/ops.ts の isValidInline と同じ5種）。 */
const INLINE_TAGS = new Set(["br", "strong", "em", "b", "span", "link"]);

/**
 * Inline AST の装飾ノードか。
 *
 * **`t` というキーの有無だけで判定してはいけない。** 実データには `t` を普通の項目名として
 * 使っている箇所がある（`films.items[].t` は作品タイトル、`index.quick.cards[].t` は見出し、
 * `terms` の `blocks[]` は `{t:"p", value:[…]}` というブロック種別）。タグ名が許可5種であること、
 * および `br` 以外は子ノード配列 `c` を持つことまで確かめる。
 */
function isInlineNodeObject(node: unknown): boolean {
  if (typeof node !== "object" || node === null || Array.isArray(node)) return false;
  const record = node as Record<string, unknown>;
  if (typeof record.t !== "string" || !INLINE_TAGS.has(record.t)) return false;
  if (record.t === "br") return true;
  return Array.isArray(record.c);
}

/** `["…", {t:"br"}, {t:"strong", c:[…]}]` のような Inline AST の配列か。 */
function hasMarkupNode(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (!value.some(isInlineNodeObject)) return false;
  // 装飾ノードと文字列だけで構成されていること（他のオブジェクトが混ざる配列は inline ではない）
  return value.every((node) => typeof node === "string" || isInlineNodeObject(node));
}

/**
 * 全ドキュメントを走査して「その正規化パスの配列は inline である」ものを集める。
 * 1件だけ見ると、たまたま装飾を含まない `["ただの文字列"]` を素の配列と誤判定するため、
 * 同じパスが他のドキュメント・他の要素で装飾を持つかどうかで決める。
 */
function collectInlinePaths(allDocuments: Record<string, unknown>): Set<string> {
  const inlinePaths = new Set<string>();

  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      if (hasMarkupNode(value)) {
        inlinePaths.add(path);
        return;
      }
      value.forEach((item) => walk(item, `${path}[]`));
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };

  for (const doc of Object.values(allDocuments)) {
    walk(doc, "");
  }
  return inlinePaths;
}

/**
 * 同じ正規化パスに現れる値をすべて畳み込んで、代表値（形の和）を作る。
 *
 * 配列の1件目だけを見て形を決めると、**後続の要素にしか無いキーが manifest から落ちる**
 * （実測: `boxes[].delay` や `articles[].variant` など58件が漏れた）。
 * `privacy.sections[].blocks[]` のように要素ごとに形が違う配列もあるため、
 * 全要素のキーの和をとる。
 */
function unify(values: unknown[]): unknown {
  const present = values.filter((v) => v !== undefined);
  if (present.length === 0) return "";

  if (present.some((v) => Array.isArray(v))) {
    const inner = present.filter(Array.isArray).flat();
    return inner.length > 0 ? [unify(inner)] : [];
  }

  if (present.some((v) => typeof v === "object" && v !== null)) {
    const objects = present.filter(
      (v): v is Record<string, unknown> => typeof v === "object" && v !== null
    );
    const keys = new Set<string>();
    objects.forEach((o) => Object.keys(o).forEach((k) => keys.add(k)));
    const merged: Record<string, unknown> = {};
    for (const k of keys) {
      merged[k] = unify(objects.map((o) => o[k]));
    }
    return merged;
  }

  // スカラーは型判定に使うだけなので、いちばん情報量の多いものを代表にする
  const strings = present.filter((v): v is string => typeof v === "string");
  if (strings.length > 0) {
    return strings.reduce((a, b) => (b.length > a.length ? b : a));
  }
  return present[0];
}

function stringFieldType(key: string, value: string): "text" | "textarea" | "image" {
  if (key === "src" || value.startsWith("/assets/")) return "image";
  if (value.includes("\n") || value.length >= 60) return "textarea";
  return "text";
}

/** 配列の「追加」用の雛形（文字列は空、真偽値は false）。 */
function blankTemplate(value: unknown): unknown {
  if (typeof value === "string") return "";
  if (typeof value === "boolean") return false;
  if (typeof value === "number") return 0;
  if (Array.isArray(value)) return [];
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, blankTemplate(v)])
    );
  }
  return null;
}

/**
 * 導出器を作る。`allDocuments` は inline 判定のために全ドキュメントを渡す
 * （アプリ側は同梱JSON、検証スクリプトは `content/*.json` を渡す）。
 */
export function createManifestBuilder(allDocuments: Record<string, unknown>) {
  const inlinePaths = collectInlinePaths(allDocuments);

  const inferField = (value: unknown, path: string, key: string): Field => {
    const { label, hint } = labelFor(path, key);

    if (Array.isArray(value)) {
      if (inlinePaths.has(path) || hasMarkupNode(value)) {
        return { type: "inline", path, label, hint };
      }
      // 1件目ではなく全要素の形の和をとる（unify のコメント参照）
      const sample = unify(value);
      const item = inferField(sample, `${path}[]`, key);
      // 要素側に辞書の当たりが無いときは、配列自身の表示名を引き継ぐ
      // （`hero.titleLines[]` が「edition」のような生のキー名で出るのを防ぐ）
      if (item.label === key) item.label = label;
      return {
        type: "array",
        path,
        label,
        hint,
        item,
        template: blankTemplate(sample),
      };
    }

    if (typeof value === "object" && value !== null) {
      return {
        type: "group",
        path,
        label,
        hint,
        fields: Object.entries(value as Record<string, unknown>).map(([k, v]) =>
          inferField(v, path ? `${path}.${k}` : k, k)
        ),
      };
    }

    if (typeof value === "boolean") return { type: "boolean", path, label, hint };
    if (typeof value === "string") return { type: stringFieldType(key, value), path, label, hint };

    // 数値・null は現行データに存在しない。将来出てきたらテキストとして扱う。
    return { type: "text", path, label, hint };
  };

  const buildManifest = (key: string, label: string, doc: unknown): DocumentManifest => ({
    key,
    label,
    fields: Object.entries(doc as Record<string, unknown>).map(([k, v]) => inferField(v, k, k)),
  });

  return { buildManifest, inlinePaths };
}

/**
 * manifest が受け持つ正規化パスの一覧。
 * `inline` は配下をまとめて1フィールドが受け持つので終端として扱う。
 */
export function manifestPaths(fields: Field[]): { leaves: string[]; inlines: string[] } {
  const leaves: string[] = [];
  const inlines: string[] = [];

  const walk = (field: Field): void => {
    switch (field.type) {
      case "group":
        field.fields.forEach(walk);
        return;
      case "array":
        walk(field.item);
        return;
      case "inline":
        inlines.push(field.path);
        return;
      default:
        leaves.push(field.path);
    }
  };

  fields.forEach(walk);
  return { leaves, inlines };
}
