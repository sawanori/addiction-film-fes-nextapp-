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
npm run verify:blob-sha  # 直列化と blob sha が git hash-object と一致するか
npm run deploy:cf  # Cloudflare Workers へデプロイ（Vercel は git push で自動）
```

## デプロイ先

**Vercel（主）** — `main` への push で本番デプロイ、それ以外のブランチはプレビュー。
手順・環境変数・引き継ぎ事項は `docs/deploy-vercel.md`。設定は `vercel.json`
（実行リージョンを東京 `hnd1` に固定。公開8ページは静的生成なので、効くのは管理画面まわり）。

**掲載内容の保存先は GitHub リポジトリ自身**（`content/<key>.json`）。管理画面で保存すると
1コミットができ、それを Vercel が拾って本番デプロイし、**1〜2分ほどで公開に反映される**
（2026-09-03 に検証用 Vercel で実測: 保存リクエストから公開反映まで 31秒〜102秒。差はビルドの
キュー待ちで、ビルド自体は約20秒）。何も変えずに保存してもコミットは増えない。

**Cloudflare Workers（従）** — `npm run deploy:cf`。移行期間中の並行運用として残してある。
`wrangler.jsonc` / `open-next.config.ts` / `next.config.ts` 末尾の
`initOpenNextCloudflareForDev` がこちら向け。不要になったら消せる
（消す範囲は `docs/deploy-vercel.md` §7）。**Cloudflare 版は `deploy:cf` を打った時点の
`content/*.json` のスナップショット**で、管理画面で保存しても自動更新されない
（GitHub に書かれ、Vercel だけが追随する）。

環境変数は必須4つ（`GITHUB_CONTENT_TOKEN` / `GITHUB_CONTENT_REPO` /
`ADMIN_PASSWORD_PBKDF2` / `ADMIN_SESSION_SECRET`）＋任意の `GITHUB_CONTENT_BRANCH`
（省略時 `main`）。ローカル専用に `CONTENT_STORE=fs` があり、指定すると `npm start` でも
作業ツリーの `content/*.json` に保存する（`next dev` では指定不要）。見本は `.env.example`、
ローカルは `.env.local` に置く。
**環境変数がゼロでも公開8ページは同梱の `content/*.json` で表示される**
（管理画面だけが 500 になる）。実測で確認済み。

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
| `lib/content/youtube.ts` | 予告編の動画URL→動画ID変換。管理画面のサーバ側（`lib/admin/ops.ts`）とクライアント側（`FieldEditor`）が同じ規則を使う。回帰テストは `node scripts/verify-youtube-id.mjs` |
| `lib/content/store*.ts` | 管理画面から見た保存先の契約（`store.ts` の `ContentStore`）と2実装（`store-github.ts` / `store-fs.ts`）。直列化は `serializeDocument()` に固定し、楽観ロックは git の blob sha で行う。`getContentStore()` の選択規則は**本番ビルドでは明示指定（`CONTENT_STORE=fs`）が無い限り FS 実装を選ばない**（Cloudflare Workers 上で `node:fs` に書けたように見えて消えるのを防ぐため） |
| `Films` | index / programme で共有する上映作品グリッド。両ページ唯一の差異（04「一瞬の楽園」のクレジット）を `variant: "index" \| "programme"` で出し分ける。`trailer` を持つ作品（04・05）だけ `.film__play` ボタンを描画 |
| `SmartLink` | `#` 始まりは素の `<a>`、それ以外の内部リンクは `next/link`。ヘッダー/フッターの内部リンクはこれを通す |

`lib/style.ts` の `styleVars()` / `StyleWithVars` は、`style={{ "--d": ".08s" }}` のようなカスタムプロパティを通すための型。**`as CSSProperties` で object 全体をアサートしない**（通常プロパティの typo が型チェックをすり抜けるため）。

import alias は `@/*` → リポジトリルート。

## 管理画面のフォーム定義（manifest）で覚えておくこと

- **manifest は手書きせず実データの形から機械導出する。** ただし `buildManifest` は
  同梱JSON（正典）と**保存データの形の和**をとる。実データ側で任意キーが欠けると
  その項目がフォームから消え、二度と入力できなくなるため（予告編の項目が消えた版へ
  revert したときに実測した。`docs/plans/trailer-admin/implementation-plan.md` §9.3）。
- **`FieldEditor` は値が `undefined` の子項目を描画しない。** `privacy` / `terms` の
  `blocks[]` のように要素ごとに形が違う配列で、段落ブロックに箇条書き用の欄が出るのを
  防ぐための仕様。値が無くても必ず出したい項目は `manifest-core.ts` の `ALWAYS_SHOWN`
  にパスを足す。2026-08-27 時点で、**任意キーが欠けていて編集できなかった35欄はすべて
  開いた**（`delay` / `variant` / `metaProgramme` / フッターのリンク先など26パス）。
  残る85件は多態ブロック由来で、**出さないのが正しい**。
- **`ALWAYS_SHOWN` にパスを足すときは、空欄で保存しても公開DOMが変わらないことを実測する。**
  描画側が `x.delay ? … : {}` のように空文字を偽として扱うか、等値比較（`variant === "dark"`）
  になっているかを確かめる。**空配列は真**なので inline 項目は `?.length` で見る
  （`components/Films.tsx` の `metaProgramme`）。**キーの有無で分岐しているコードにも注意**
  （`components/SiteFooter.tsx` の `hasLink` は `"base" in item` だけで判定していたため、
  空文字の `base` が `href=""` のリンクになるところだった）。
- **保存時に文字列は加工しない**（改行コードを除く。計画 §8.4）。唯一の例外は
  `manifest-core.ts` の `PATH_FORMATS` に挙げた欄で、現在は予告編の動画ID欄だけ。
  動画URLを貼るとIDへ変換し、YouTube と解釈できない非空の値は 422 で拒否する。

## 公開前の未確定事項

- **掲載情報はすべて仮置き。** 差し替え対象の全件は `PLACEHOLDERS.md` にある。会期・料金・登壇者・応募要項・連絡先は確定した事実ではない。
- 検索結果に出さないための手当ては **`app/layout.tsx` の `metadata.robots`（`noindex, nofollow, noarchive`）**が担う。`public/robots.txt` は `Allow: /` で**クロールを許可している**（Disallow で止めるとクローラーが noindex を読めなくなるため。理由は robots.txt 本文のコメントに書いてある）。`Sitemap:` 行はコメントアウトしてあり、`public/sitemap.xml` のドメインは `https://example.jp/` のまま。**この節は以前「robots.txt は全面 Disallow」と書いていたが誤りで、2026-08-14 に実ファイルと突き合わせて訂正した。**
- `privacy` / `terms` / `legal` は法務未確認の雛形で、未確定箇所は本文に〔調整中〕として残っている。
- `/public/assets/film/`・`/public/assets/nagigater/`（権利者から預かった原本素材 計4.5GB）と `*.pptx` は `.gitignore` で除外。追跡しているのは Web用に縮小した `public/assets/films/` のみ。

## 変更後の検証

`npm run build` と `npx tsc --noEmit` を通すだけでは足りない。マークアップに触れた場合は `npm start` で本番ビルドを起動し、8ルートすべてを取得して**修正前後で可視テキストと class 集合が変化していない**ことを確認する。変換元との突き合わせが必要なら `/Users/noritakasawada/AI_P/addiction-film-festival` の対応するHTMLを読む。

管理画面まわりを触ったときは、加えて次を通す。

```bash
npm run verify:coverage              # 全リーフが manifest から編集できるか
node scripts/verify-youtube-id.mjs   # 予告編の動画URL→動画ID変換の規則
npm run verify:blob-sha              # 直列化 + blob sha が git hash-object と一致するか
npm run verify:text                  # 公開8ルートの DOM パス比較
```

`verify:text` は環境変数なしで本番ビルドを起動し、同梱の `content/*.json` で検証する。
`next dev` の管理画面は作業ツリーの `content/*.json` を直接書き換えるので、
**試し書きをしたら `git checkout -- content/` で戻してから**実行する。
戻さずに差分が出たときに baseline を更新してはいけない。
