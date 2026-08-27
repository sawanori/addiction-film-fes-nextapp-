# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## コマンド

```bash
npm run dev        # 開発サーバ（AGENTS.md の nextjs-agent-rules ブロックを書き戻す）
npm run build      # 本番ビルド（型チェック込み）
npx tsc --noEmit   # 型チェック単独
npm run lint       # ESLint（eslint-config-next の core-web-vitals + typescript）
npm start          # 本番ビルドの起動（見た目の差分検証はこれで行う）
```

テストランナーは導入していない。変更の検証は `npm run build` + `npx tsc --noEmit` と、後述の HTML 突き合わせで行う。

## このリポジトリの性質

静的HTMLサイト `/Users/noritakasawada/AI_P/addiction-film-festival`（index/about/programme/tickets/news/privacy/terms/legal の8ページ + `styles.css` + `script.js`）を、**見た目と文言を一切変えずに** Next.js 16 App Router へ移植したもの。変換の全仕様は `CONVERSION_SPEC.md`、変換時の判断は `README.md` 末尾の「変換時の判断メモ」にある。

変換元は**読み取り専用**。差分の正解を確認するために読むのはよいが、書き換えない。

### 不変条件（壊してはいけないもの）

- **可視テキスト・DOM構造・class名・`title`/`description` は変換元の8ページと完全一致**していることが実測済み。この一致を壊す変更は不可。リファクタは内部実装に限る。
- **日本語の文言・数値・日付・作品名・分数を1文字も変えない。** 誤字に見えても直さない（`嘘つきは〇○のはじまり` の表記ゆれ、`assets/nagigater` というフォルダ名の綴りは意図的）。
- `app/globals.css` は変換元 `styles.css` の**バイト単位のコピー**（`diff` で同一を確認済み）。CSS Modules / Tailwind へ移し替えない。セレクタ・カスタムプロパティ名を変えない。デザイントークンの意図は `README.md` の「デザイントークン」「ポスタライゼーション」節にある。
- 画像は `next/image` ではなく素の `<img>`。CSS が `object-fit` / `aspect-ratio` で寸法を制御しているため置き換えると見た目が変わる。`@next/next/no-img-element` の ESLint 警告は許容する仕様。
- Google Fonts は `next/font` ではなく `app/layout.tsx` の `<head>` 内 `<link>` 3行のまま（`--font-en` / `--font-jp` に当たる書体を変えないため）。

## 構成

`app/` の8ルート（`/`, `/about`, `/programme`, `/tickets`, `/news`, `/privacy`, `/terms`, `/legal`）はすべて Server Component で、変換元HTMLの `<main>` 相当をそのまま TSX 化したもの。ページ固有の `title` / `description` は各 `page.tsx` の `export const metadata`。全ページ共通の `noindex, nofollow, noarchive` は `app/layout.tsx` の `metadata.robots`。

`app/(public)/layout.tsx` が `SiteHeader` / `SiteFooter` / `TrailerModal` / `ScrollReveal` を公開8ページに置く。ルート遷移では再マウントされない点に注意（`SiteHeader` は `pathname` 変化を `useEffect` で拾ってメニューを閉じ、`TrailerModal` は `pathname` を依存に取り直してボタンへリスナーを付け直す）。

`components/` は変換元 `script.js` の5つの IIFE と、ページ間で重複していたマークアップの受け皿：

| ファイル | 役割 |
|---|---|
| `SiteHeader` (client) | 全ページ共通ヘッダー。ハンバーガー開閉（`html`/`body` の `nav-open` は `useLayoutEffect` で反映し cleanup で必ず除去）、`usePathname()` による `aria-current` と自ページ内アンカーの出し分け |
| `SiteFooter` (client) | 全ページ共通フッター。ヘッダーと同じく自ページへのリンクは `#…` 形式 |
| `Hero` (client) | ヒーロースライドショー。6000ms 巡回・ドット連動・`prefers-reduced-motion` で自動送り停止・`visibilitychange` で停止/再開 |
| `Timetable` (client) | programme のみ。日付データは `DAYS` 配列1つからタブとシートの両方を生成する（片方だけ増やせない設計） |
| `ScrollReveal` (client) | layout に1つだけ置く。`.rise:not(.is-in)` を IntersectionObserver（`rootMargin:'0px 0px -10% 0px'`, `threshold:0.08`）で拾い、クライアント遷移のたびに再スキャン |
| `TrailerModal` (client) | 予告編の YouTube モーダル。`(public)/layout.tsx` がフッター直後に置くが、変換元で `<dialog>` を持つ index / programme 以外では null。`.film__play` は DOM から拾ってリスナーを付け、iframe は開いたとき生成・閉じたら破棄 |
| `Films` | index / programme で共有する上映作品グリッド。両ページ唯一の差異（04「一瞬の楽園」のクレジット）を `variant: "index" \| "programme"` で出し分ける。`trailer` を持つ作品（04・05）だけ `.film__play` ボタンを描画 |
| `SmartLink` | `#` 始まりは素の `<a>`、それ以外の内部リンクは `next/link`。ヘッダー/フッターの内部リンクはこれを通す |

`lib/style.ts` の `styleVars()` / `StyleWithVars` は、`style={{ "--d": ".08s" }}` のようなカスタムプロパティを通すための型。**`as CSSProperties` で object 全体をアサートしない**（通常プロパティの typo が型チェックをすり抜けるため）。

import alias は `@/*` → リポジトリルート。

## 公開前の未確定事項

- **掲載情報はすべて仮置き。** 差し替え対象の全件は `PLACEHOLDERS.md` にある。会期・料金・登壇者・応募要項・連絡先は確定した事実ではない。
- 検索結果に出さないための手当ては **`app/layout.tsx` の `metadata.robots`（`noindex, nofollow, noarchive`）**が担う。`public/robots.txt` は `Allow: /` で**クロールを許可している**（Disallow で止めるとクローラーが noindex を読めなくなるため。理由は robots.txt 本文のコメントに書いてある）。`Sitemap:` 行はコメントアウトしてあり、`public/sitemap.xml` のドメインは `https://example.jp/` のまま。**この節は以前「robots.txt は全面 Disallow」と書いていたが誤りで、2026-08-14 に実ファイルと突き合わせて訂正した。**
- `privacy` / `terms` / `legal` は法務未確認の雛形で、未確定箇所は本文に〔調整中〕として残っている。
- `/public/assets/film/`・`/public/assets/nagigater/`（権利者から預かった原本素材 計4.5GB）と `*.pptx` は `.gitignore` で除外。追跡しているのは Web用に縮小した `public/assets/films/` のみ。

## 変更後の検証

`npm run build` と `npx tsc --noEmit` を通すだけでは足りない。マークアップに触れた場合は `npm start` で本番ビルドを起動し、8ルートすべてを取得して**修正前後で可視テキストと class 集合が変化していない**ことを確認する。変換元との突き合わせが必要なら `/Users/noritakasawada/AI_P/addiction-film-festival` の対応するHTMLを読む。
