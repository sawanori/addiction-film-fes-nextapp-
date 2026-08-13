# 変換仕様：静的HTMLサイト → Next.js 16 App Router（TypeScript）

## 役割

既存の静的サイトを、見た目と文言を一切変えずに Next.js の TSX へ移植する。
**新しいデザインを考える作業ではない。既存の HTML を忠実に TSX へ写し替える作業である。**

## ディレクトリ

- 変換元（読み取りのみ。**絶対に書き換えないこと**）：`/Users/noritakasawada/AI_P/addiction-film-festival`
- 変換先（ここに書く）：`/Users/noritakasawada/AI_P/addiction-film-fes-nextapp`

変換先はすでに `create-next-app@16.3.0`（Next.js 16.3.0 / React 19.2.8 / TypeScript / App Router /
Tailwindなし / ESLintあり / src-dirなし / import alias `@/*`）で雛形を作成済み。
`public/assets/` には必要な画像（films, hero, navigator）と `robots.txt` をコピー済み。

## ルート対応表

| 変換元 | 変換先 |
| --- | --- |
| `index.html` | `app/page.tsx` |
| `about.html` | `app/about/page.tsx` |
| `programme.html` | `app/programme/page.tsx` |
| `tickets.html` | `app/tickets/page.tsx` |
| `news.html` | `app/news/page.tsx` |
| `privacy.html` | `app/privacy/page.tsx` |
| `terms.html` | `app/terms/page.tsx` |
| `legal.html` | `app/legal/page.tsx` |

リンクの書き換え：`index.html`→`/`、`about.html`→`/about`、`programme.html`→`/programme`、
`tickets.html`→`/tickets`、`news.html`→`/news`、`privacy.html`→`/privacy`、`terms.html`→`/terms`、
`legal.html`→`/legal`。`about.html#contact` のようなフラグメント付きは `/about#contact` にする。
内部リンクは `next/link` の `<Link href="...">` を使う。同一ページ内のアンカー（`#navigator` など）は
`<a href="#navigator">` のまま残してよい。

## CSS

`styles.css`（742行）を **1文字も変えずに** `app/globals.css` へ移す。
雛形が生成した `app/globals.css` の中身は破棄して丸ごと置き換える。
`app/layout.tsx` で `import "./globals.css"` する。
CSS内の `url("assets/...")` 等の相対パスがあれば `/assets/...` に直す（絶対パス化）。
クラス名・セレクタ・カスタムプロパティ名は変更禁止。CSS Modules や Tailwind へ移し替えない。

## `app/layout.tsx`

- `<html lang="ja">`
- Google Fonts（Space Grotesk / Noto Sans JP）は各HTMLの `<head>` にある `<link>` と同じものを読み込む。
  `next/font/google` へ移し替えてもよいが、フォールバック指定を含む CSS の `--font-en` / `--font-jp` の
  値と実際に当たる書体が変わらないことを最優先する。確信が持てないなら `<link>` のままでよい。
- 全ページ共通の `<meta name="robots" content="noindex, nofollow, noarchive">` を
  `export const metadata` の `robots` で表現する。
- 共通の `<header class="header">` と `<footer class="footer">` を
  `components/SiteHeader.tsx` / `components/SiteFooter.tsx` として切り出し、layout に置く。
  ただし **フッターのリンク構成はページごとに差異がある可能性がある**ので、
  8ページすべてのフッターを実際に比較し、完全に同一である場合のみ共通化する。
  差異があるページは、その差異を props で受けるか、そのページ内に個別に書く。
  勝手に統一して内容を落とさないこと。

## `script.js` の移植

`script.js` には4つの IIFE がある。それぞれ `"use client"` を付けた React コンポーネント／フックにする。
`components/` 配下に置く。DOM を `document.querySelector` で拾う実装のままにせず、
React の `useRef` / `useState` / `useEffect` で書き直す。挙動は完全に同じにすること。

1. **ハンバーガーメニュー**（〜1080px）：`.nav-toggle` と `#gnav` の開閉。開いている間は
   `html` と `body` に `nav-open` クラスを付ける。Escape で閉じる。ナビ内リンクのクリックで閉じる。
2. **ヒーローのスライドショー**：`#heroSlides` 内の `.hero__slide` を6000ms間隔で巡回。
   `#heroNav` の `.hero__dot` と連動。`prefers-reduced-motion: reduce` なら自動送りしない。
   タブが非表示（`visibilitychange`）の間は停止。
3. **スクロールリビール**：`.rise` を IntersectionObserver（`rootMargin: '0px 0px -10% 0px'`,
   `threshold: 0.08`）で監視し `is-in` を付ける。IntersectionObserver 非対応なら即座に全部付ける。
   ページ内のあちこちで使うため、`useRevealOnScroll` のような共通フックにして
   layout かクライアント境界の最上位で1回だけ動かす形にする。
4. **タイムテーブルの日付スライド**（programme のみ）：`#timetableTrack` の横スクロールスナップと
   `.timetable__tab` / `.timetable__arrow` の同期。スワイプ時は `scrollLeft / clientWidth` から
   現在の日を割り出してタブへ反映。端では矢印を `disabled` にする。リサイズ時に位置を合わせ直す。
   `prefers-reduced-motion` では `behavior: 'auto'`。

## 厳守事項

- **日本語の文言・数値・日付・作品名・分数を1文字も変えない。** 誤字に見えても直さない
  （例：`嘘つきは〇○のはじまり` の表記ゆれ、`assets/nagigater` というフォルダ名の綴りは意図的にそのまま）。
- 画像は `next/image` ではなく通常の `<img>` のままにする。CSS が `object-fit` や
  `aspect-ratio` で寸法を制御しているため、`next/image` に替えると見た目が変わる。
  ESLint が `@next/next/no-img-element` で警告を出すが、それは無視してよい。
  必要なら該当行に eslint-disable コメントを付ける。
- HTML属性の JSX 化を漏らさない：`class`→`className`、`for`→`htmlFor`、
  `tabindex`→`tabIndex`、`aria-*` はそのまま、`style="--d:.08s"` のようなインラインの
  カスタムプロパティは `style={styleVars({ "--d": ".08s" })}` のように
  `lib/style.ts` の `styleVars()`（`StyleWithVars` 型）で受ける形にする
  （object 全体の `as CSSProperties` アサーションは使わない）。
  自己終了タグ（`<br>`→`<br />`、`<img>`→`<img />`、`<meta>`）を閉じる。
  HTMLコメント `<!-- -->` は JSX コメント `{/* */}` にする。
- ページ固有の `<title>` と `<meta name="description">` は、各 `page.tsx` の
  `export const metadata: Metadata` に移す。値は変換元と完全に同じ文字列にする。
- `sitemap.xml` は `public/` へそのまま置くか `app/sitemap.ts` にする。どちらでもよいが、
  URL の一覧は変換元の `sitemap.xml` と同じ内容にする。
- `PLACEHOLDERS.md` と `README.md` は変換元からコピーして変換先にも置く。
- `.pptx` と `assets/film/` `assets/nagigater/` は**コピーしない**（権利者から預かった原本素材で
  合計4.5GB、変換元の `.gitignore` で除外されている）。変換先の `.gitignore` にも同じ除外を書き足す。

## 完了条件

作業の最後に変換先ディレクトリで以下を順に実行し、**両方が成功すること**を自分で確認する。
失敗したら原因を直してから再実行する。通るまで終了しない。

```
npm run build
npx tsc --noEmit
```

`npm run build` のログに型エラー・未定義参照・ビルド失敗が無いこと。
8ルート（`/`, `/about`, `/programme`, `/tickets`, `/news`, `/privacy`, `/terms`, `/legal`）
すべてがビルド出力に現れること。

最後に、変換先の `README.md` の末尾へ「変換時の判断メモ」として、
共通化したコンポーネント・迷った箇所・変換元と挙動が変わった箇所があればそれを箇条書きで残す。
