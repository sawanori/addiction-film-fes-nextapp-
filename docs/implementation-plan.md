# Implementation Plan: /admin 管理画面

> **版**: v2（2026-08-13）
> v1 は kimi k3 が起草。codex / gemini による敵対的レビューを経て改訂した。
> どの指摘を採用し、どれを実測で却下したかは `docs/reviews/review-verdict.md` に記録してある。
> v2 で変わった主な点: `middleware.ts` → `proxy.ts`（Next 16 で廃止）、インライン表現を汎用 AST へ拡張、
> seed の正典を TSX AST から実レンダリングHTMLへ変更、Route Group による公開面/管理面の分離、
> 検証を「出現回数」から「DOMパスごとの値」へ格上げ。

## 1. Overview

現行サイトは Next.js 16 App Router の静的 8 ページ（全ページ prerender）で、可視テキスト・DOM 構造・class 名・`title`/`description` が変換元 HTML と完全一致している。本計画は、このサイトに **`/admin` 管理画面 + Turso(DB) + Cloudflare Workers(OpenNext) デプロイ**を追加し、DB に入れた現在値からレンダリングしても**出力が現行と完全一致する**ことを担保しながら、全テキスト情報をブラウザから編集可能にするものである。

実装は一括 DB 化ではなく、**「段階1: JSON 駆動化リファクタ（公開面は静的のまま）→ 段階2: DB 読み出し切替 → 段階3: 管理 UI」**の 3 段階で進め、各段階のゲートに「baseline スナップショットとの diff 0」を置く。画像アップロード（R2）はフェーズ2として本計画のスコープ外とする。

## 2. Goal

- `/admin`（単一パスワード認証）から、以下をすべて編集できること。
  - 全 8 ページ + ヘッダー/フッター共通部の**全可視テキスト 1065 ノード相当**
  - 各ページの `title` / `description`
  - `<img>` の `src`（パス文字列）・`alt`・`loading` 属性、aria-label 類
  - `<br>` / `<strong>` を含むリッチテキスト（Films の `meta`、Timetable の `program`）
  - 繰り返し項目（上映作品・タイムテーブル行・ニュース・FAQ・料金表行など）の**追加・削除・並べ替え**
- 編集は即時公開され、リビジョン履歴からロールバックできること。
- **seed 直後の DB 値でレンダリングした結果が、現行静的版と完全一致**すること（可視テキスト配列・class 出現回数・タグ出現回数・`title`/`description` の比較で diff 0）。
- Cloudflare Workers（`@opennextjs/cloudflare`）+ Turso（HTTP リモート接続）で稼働すること。

## 3. Current State

### 3.1 リポジトリ・依存

- リポジトリ: `/Users/noritakasawada/AI_P/addiction-film-fes-nextapp`
- 依存: `next@16.3.0` / `react@19.2.8` / `react-dom@19.2.8` のみ。DB・認証・デプロイ設定・テストランナーは一切なし。`npx tsc --noEmit` が機能しているため `typescript` は devDependencies に存在すると判断できる（実装時に `package.json` で要確認）。
- import alias: `@/*` → リポジトリルート。

### 3.2 ルートとコンポーネント

- ルート（全て Server Component・静的 prerender）: `/`, `/about`, `/programme`, `/tickets`, `/news`, `/privacy`, `/terms`, `/legal`
- コンポーネント: `SiteHeader`(client), `SiteFooter`(client), `Hero`(client), `Timetable`(client), `Films`(server), `ScrollReveal`(client), `NewsletterForm`(client), `SmartLink`
- `lib/style.ts` の `styleVars()` / `StyleWithVars` でカスタムプロパティを型安全に渡している（`as CSSProperties` の全体アサート禁止）。
- `Films.tsx` は index/programme 共有で、04「一瞬の楽園」のクレジットのみ `variant: "index" | "programme"` で出し分け。`meta` が `<br />` 入りの JSX（`ReactNode`）。
- `Timetable.tsx` は `DAYS` 配列からタブとシートを生成。`program` が `<strong>` 入りの JSX（`ReactNode`）。
- `Hero.tsx` は `SLIDES` 配列（`src`/`alt`/`lazy`）+ 静的テキスト（eyebrow、タイトル 2 行、`dl` 4 項目、ボタン 2 つ）を内包。
- 可視テキスト総数 1065 ノード（`docs/content-inventory.md`）。うちヘッダー/フッター共通 41 種。

### 3.3 デプロイ・DB の前提（検証済み事実）

- デプロイ先: Cloudflare Workers。アダプタ `@opennextjs/cloudflare@1.20.2`（peer: `next ">=15.5.21 <16 || >=16.2.11"` → 16.3.0 は適合、`wrangler "^4.86.0"`、wrangler 最新 4.122.0）。既存アプリ導入は `npx @opennextjs/cloudflare migrate`。
- DB: Turso。`@tursodatabase/serverless@1.4.0`（`/compat` で `@libsql/client` API 互換）または `@libsql/client@0.17.4` の `@libsql/client/web`。Workers からは HTTP リモート接続のみ（embedded replica 不可）。
- Workers ランタイム: Node `fs` の永続書き込み不可、bcrypt 等ネイティブ依存不可。ハッシュ・署名は Web Crypto（`crypto.subtle`）。

### 3.4 既存の検証手段

- コマンド: `npm run build` / `npx tsc --noEmit` / `npm run lint` / `npm start` のみ。
- 回帰検証ツール（現在 scratchpad にあり、本計画では `scripts/` へ移設する前提で参照）:
  - `snapshot.sh`: 本番サーバから 8 ルートを取得
  - `extract.mjs`: HTML から可視テキスト配列・class 出現回数・タグ出現回数・`title`/`description` を抽出して JSON 化
  - 変更前の baseline スナップショットは取得済み → `verification/baseline/` にコミットする。

### 3.5 不変条件（CLAUDE.md 由来・破ったら失格）

1. 可視テキスト・DOM 構造・class 名・`title`/`description` は変換元 8 ページと完全一致。DB 化後もこの一致を維持する。
2. 日本語の文言・数値・日付・作品名・分数を 1 文字も変えない（`嘘つきは〇○のはじまり`、`assets/nagigater` は意図的）。
3. `app/globals.css` は変換元 `styles.css` のバイト単位コピー。**管理画面 CSS をここに 1 行も足さない。**
4. 画像は素の `<img>` のまま（`next/image` 化しない）。
5. `as CSSProperties` で object 全体をアサートしない。

## 4. Scope

フェーズ1（テキスト系）を本計画のスコープとし、以下を含む。

1. 検証ツールの `scripts/` への移設と baseline のリポジトリ管理、および `extract.mjs` の属性抽出拡張（§7 リスク 5 参照）。
2. 既存 TSX からの機械抽出スクリプトによる `content/*.json` 生成、および全ページ・共通部品の JSON 駆動化リファクタ（公開面は静的のまま）。
3. Turso スキーマ（DDL）・マイグレーションスクリプト・seed スクリプト（読み戻し検証付き）。
4. 公開ページの DB 駆動化（`force-dynamic`、障害時は同梱 JSON フォールバック）。
5. 認証（単一パスワード + HMAC-SHA256 署名 Cookie + `proxy.ts` + API 側二重検証 + レート制限）。
6. 管理画面 UI（ドキュメント一覧・編集フォーム・リビジョン履歴・ロールバック）と管理 API。
7. OpenNext / wrangler のデプロイ設定と本番反映手順。

## 5. Non-Scope

- **画像バイナリのアップロード・差し替え（R2）** — フェーズ2として分離。フェーズ1では `src` のパス文字列のみ編集可能。
- 下書き/公開の 2 状態管理（即時公開 + リビジョンロールバックで代替する）。
- 複数ユーザー・権限管理、i18n。
- `NewsletterForm` の実送信バックエンド、お問い合わせフォーム。
- `public/robots.txt` / `public/sitemap.xml` の編集。
- ページの新設、セクション構造の追加・削除（構造はコード側に残る。編集できるのは構造内の値と配列項目の増減まで）。
- ISR / オンデマンド revalidation（理由は §7）。
- 監査ログの外部転送・アラート。

### フェーズ1で「全ての情報を網羅的に編集できる」と言えるか（正直な評価）

**部分的にしか言えない。** フェーズ1完了時点で編集可能になるのは: 全可視テキスト、`title`/`description`、画像の `src` パス文字列・`alt`・`loading`、aria-label、リッチテキスト、繰り返し項目の追加・削除・並べ替え。一方で以下は**残件**となる:

1. **画像ファイル本体の差し替え・新規アップロード**（パスは書き換えられるが実体が無ければ 404 になる。R2 アップロードはフェーズ2）。
2. CSS・デザインの変更（`globals.css` は不変条件で凍結）。
3. `robots.txt` / `sitemap.xml` の内容。
4. セクション単位の構造変更・新規ページ追加（コード変更が必要）。

したがって正確には「**全テキスト情報と画像参照は網羅的に編集可能。画像バイナリはフェーズ2 待ち**」がフェーズ1の到達点である。

## 6. Assumptions

- 編集者は 1 名。同時編集は考慮しない（API の楽観ロックで事故のみ防ぐ）。
- サイトの言語は日本語のみ。管理 UI も日本語。
- トラフィックは月間数千 PV 規模。Turso 無料枠で収まる想定（1 リクエストあたり batch 1 往復・最大 3 ドキュメント読み出し）。
- 変換元 `/Users/noritakasawada/AI_P/addiction-film-festival` は読み取り専用。
- シークレット: ローカルは `.dev.vars` / `.env.local`（共に gitignore）、本番は `wrangler secret put`。
- `snapshot.sh` / `extract.mjs` の引数・出力形式は移設時に確認し、本計画のコマンド例に合わせて必要なら薄いラッパを足す（**要確認**）。
- Next 16 は破壊的変更を含むため、実装着手時に `node_modules/next/dist/docs/` で使用 API（`force-dynamic`、`generateMetadata`、`proxy`、Route Handler）の現行仕様を確認してから書く（AGENTS.md の nextjs-agent-rules に従う）。

## 7. Architecture Impact

### 7.1 構成

```
[訪問者/編集者]
      │ HTTPS
      ▼
Cloudflare Worker（Next.js 16 via @opennextjs/cloudflare）
  ├─ proxy.ts ────── /admin/*, /api/admin/* をセッション検証（login 系は除外）
  │                  ※ Next 16 で middleware.js は廃止され proxy.js に改名された
  ├─ app/(admin)/    … 管理画面（Route Group。公開ヘッダー/フッターを継承しない）
  ├─ /api/admin/*    … 管理 API（API 側でもセッションを二重検証）──┐
  └─ app/(public)/   … 公開 8 ルート。force-dynamic で SSR         │
        │ lib/content/server.ts                                    │
        ├─ Turso（HTTPS）◄────────────── 管理 API も読み書き ───────┘
        └─ 失敗・未設定時は同梱 content/*.json にフォールバック（console ログ出力）
```

**Route Group による分離（v2 で追加）**: 現在の `app/layout.tsx` は `<body>` 直下に
`<SiteHeader /> {children} <SiteFooter /> <ScrollReveal />` を置いている（`app/layout.tsx:28-33`）。
このままでは `app/admin/layout.tsx` を足しても root layout が必ず適用され、
管理画面に公開サイトのヘッダー・フッター・IntersectionObserver・`site` の DB 取得が混入する。
そのため:

- `app/layout.tsx`（root）は `<html lang="ja">`・`<head>` の Google Fonts 3 行・`metadata.robots`・`<body>{children}</body>` のみに縮小する。
- `app/(public)/layout.tsx` に `SiteHeader` / `SiteFooter` / `ScrollReveal` と `site` ドキュメント取得と `force-dynamic` を置く。
- `app/(admin)/layout.tsx` に管理画面シェルと `admin.css` を置く。
- Route Group はURLに現れないため、**公開8ルートのパスは変わらない**（`/`, `/about`, … のまま）。

- 画像は引き続き `public/assets/...` から Workers Static Assets として配信（素の `<img>` 維持）。
- Turso は dev / prod の 2 データベースを用意し、ローカル開発・検証は dev を使う。

### 7.2 配信方式の決定: `force-dynamic`（ISR・ビルド時取得は却下）

**決定: 公開 8 ルートは `export const dynamic = "force-dynamic"` を `app/layout.tsx` に付けて全ページ動的 SSR とし、リクエストごとに Turso から現在値を読む。**

理由:

- **ISR + `revalidateTag`（却下）**: OpenNext on Cloudflare でオンデマンド revalidation を成立させるには R2 incremental cache と Durable Objects（DOShardedTagCache / DOQueueHandler）の追加設定が必須。月間数千 PV のイベントサイトに対してインフラ・設定・故障モードの増加が見合わない。
- **ビルド時取得（却下）**: 編集の即時反映と矛盾し、編集ごとに再ビルド/再デプロイの仕組み（CI 連携）が必要になる。現状 CI は存在しない。
- **`force-dynamic`（採用）**: 追加インフラなし、編集が即時反映、Turso HTTP の往復（数十〜百数十 ms 想定）は本規模で許容可能。ビルド時にページ本体が実行されないため `npm run build` が DB 非依存のまま通る利点もある。

**この決定は A/B 実験で裏付け済み（v2 で追加）**。gemini のレビューは「`force-dynamic` を付けると
`<head>` の preload 等が変化し変換元との一致が根本から崩れる」として静的生成への全面回帰を要求したが、
実測すると成立しなかった。`app/layout.tsx` に `export const dynamic = "force-dynamic"` を付けて再ビルドし
（全8ルートが `ƒ (Dynamic)` になったことをビルド出力で確認）、静的版のスナップショットと比較した結果:

| 比較項目 | 結果 |
|---|---|
| 可視テキスト配列 / class 出現回数 / タグ出現回数 / `title` / `description` | index の `<link>` が 9→8 になる1点のみ差分。他は全ページ一致 |
| `<!-- -->` コメントノード数 | 静的版・動的版ともに 0 |
| Google Fonts の `<link>` 3 行 | 両方に存在 |
| 生バイト差 | index −75、他7ページ +1 |

消えた 1 本は `<link rel="preload" as="image" href="/assets/films/hero-01-secret-sea.jpg">` で、
Next が prerender 時に自動生成するヒーロー画像の preload である。**変換元の静的HTMLには存在しない**ため
CLAUDE.md の不変条件には違反しない（むしろ変換元に近づく）。実験後 `app/layout.tsx` は復元済み。

既知のトレードオフとして、この preload が失われるぶん**ヒーロー画像の LCP が悪化する**。
気になる場合は `app/(public)/layout.tsx` の `<head>` に同等の `<link rel="preload">` を明示的に置けるが、
それは変換元に無いタグを増やす行為なので、**採用する場合は unchanged 判定の対象外として明記すること**。

トレードオフと対策:

- 毎リクエスト Turso 往復が発生 → `client.batch` で必要ドキュメントを 1 往復に集約する（`/`: `site` + `page.index` + `films`、`/programme`: `site` + `page.programme` + `films` + `timetable`、他: `site` + 当該ページ）。
- **bot トラフィックによる Turso 無料枠の消費**（gemini 指摘・保留 P-3）: `public/robots.txt` は全面 Disallow だが従わない bot は来る。`lib/content/server.ts` の `getDocuments` の前段に 60 秒程度の短 TTL キャッシュ（Cache API もしくはモジュールスコープのメモ）を挟める構造にしておき、**実トラフィックを見てから有効化**する。編集の即時反映を損なうため既定は無効。
- Turso 障害時に公開面が落ちる → `getDocument` は例外・0 件・env 未設定時に同梱 `content/*.json`（seed と同一内容）へフォールバックし、`console.error` を出力。可用性 > 鮮度と判断。フォールバックが DB 障害を隠蔽するリスクは §7.4-7 で検出方法を定める。

### 7.3 ReactNode 問題の決定: 構造化インライン JSON + 専用レンダラ

`Films.tsx` の `meta` と `Timetable.tsx` の `program` は `<br />` / `<strong>` を含む JSX（`ReactNode`）であり、DB の値から現在と完全一致する DOM を再生成する必要がある。

**決定: DB には「構造化インライン JSON」を保存し、`lib/content/inline.tsx` の 2 関数で JSX に変換する。`dangerouslySetInnerHTML` は使わない。**

**v1 からの変更（重要）**: v1 は `Lines`（`string[]`）と `StrongText`（`{strong, text}`）の 2 形式だけで足りるとし、
「これ以外のインライン要素は現行データに存在しない」と書いていた。これは**事実に反することが実測で判明した**ため、
汎用インライン AST に改める。実測値:

| 要素 | 件数 | 代表箇所 |
|---|---|---|
| `<br />` | 40 | `app/legal/page.tsx:39` ほか |
| `<strong>` | 22 | `app/legal/page.tsx:25` は**1つの段落の文中に2回**出る |
| `<b>` | 5 | `app/page.tsx:285` 以降 |
| `<em>` | 3 | `app/page.tsx:86`、`app/tickets/page.tsx:108` |

さらに、文中に**属性付きインライン要素**と**リンク**が現れる:

- `app/legal/page.tsx:39` — `<td>〔調整中〕<br /><span className="small muted">※ 請求があった場合は遅滞なく開示します</span></td>`
- `app/legal/page.tsx:75` — `<td>〔調整中〕<br />主催者都合により…は<SmartLink href="/terms#c2">利用規約 第10条</SmartLink>をご確認ください</td>`

形式:

```ts
// lib/content/types.ts
export type InlineNode =
  | string                                                        // テキスト
  | { t: "br" }                                                   // <br />
  | { t: "strong" | "em" | "b"; c: InlineNode[] }                 // 装飾（class なし）
  | { t: "span"; cls?: string; c: InlineNode[] }                  // <span class="small muted"> など
  | { t: "link"; href: string; cls?: string; c: InlineNode[] };   // 文中リンク（SmartLink 経由）

export type Inline = InlineNode[];
```

許可するタグはこの 5 種（`br` / `strong` / `em` / `b` / `span` / `link`）に限定する。
manifest のバリデーションで**列挙外の `t` を拒否**し、`cls` は現行データに出現する class の許可リスト
（`small muted` 等）に限定する。許可リストは抽出時に実データから自動生成し、`lib/content/inline-allow.ts` に置く。

レンダラは JSX を使わず `createElement` で組み立てる。JSX で書くと行間の空白がテキストノードに混入する
事故経路があり（`components/SiteFooter.tsx:108` に「日本語の文中で改行すると JSX が空白を挿入するため1行で書く」
という既存のコメントがある）、レンダラ自身がその経路を再現してしまうため:

```tsx
// lib/content/inline.tsx
import { createElement, Fragment, type ReactNode } from "react";
import SmartLink from "@/components/SmartLink";
import type { Inline, InlineNode } from "@/lib/content/types";

function renderNode(node: InlineNode, key: number): ReactNode {
  if (typeof node === "string") return node;
  if (node.t === "br") return createElement("br", { key });
  if (node.t === "link") {
    return createElement(
      SmartLink,
      { key, href: node.href, ...(node.cls ? { className: node.cls } : {}) },
      ...node.c.map(renderNode)
    );
  }
  const props: { key: number; className?: string } = { key };
  if (node.t === "span" && node.cls) props.className = node.cls;
  return createElement(node.t, props, ...node.c.map(renderNode));
}

export function renderInline(value: Inline): ReactNode {
  return createElement(Fragment, null, ...value.map(renderNode));
}
```

**隣接テキストノードの禁止（v2 で追加）**: React の SSR は隣接するテキストノードの境界に `<!-- -->` を挿入する。
実測では現行8ページの `<!-- -->` は**すべて 0 個**なので、AST に連続する文字列要素があると
その瞬間に差分が出る。抽出時に隣接文字列を必ず 1 本に連結して正規化し、
`<!-- -->` が 0 個のままであることを受け入れ条件に入れる（§14）。
v1 は「`<!-- -->` は受け入れ条件に含めない」としていたが、**逆にして高感度の検出器として使う**。

DOM 完全一致の根拠:

- 現行 `<>出演：…<br />古山…</>` が生成する子ノード列は `[text, br, text]`。AST `["出演：…", {t:"br"}, "古山…"]` の出力も同一。
- 現行 `<><strong>微熱</strong>（30分）</>` は `[strong, text]`。AST `[{t:"strong",c:["微熱"]}, "（30分）"]` も同一。装飾なしの行（例: `受付開始`）は `["受付開始"]` で `[text]` のまま。
- 実測で確認済み: 複数行 JSX で書かれた 04 のクレジットも、出力されるテキストノードに前後の空白は付かない（JSX が行頭・行末の空白と改行を除去するため）。gemini が「JSX の空白テキストノードが失われて DOM 構造が壊れる」と致命的判定した指摘は、この実測により**成立しない**（`docs/reviews/review-verdict.md` R-1）。
- React は JSX テキストを自動エスケープするため、値に `<` `&` が含まれても DOM テキストは入力どおり。

Films 04 の variant 出し分け:

- films ドキュメントの各作品に `meta: Inline`（index 用）と省略可能な `metaProgramme: Inline`（programme 用）を持たせ、`Films` 側は `variant === "programme" && film.metaProgramme ? film.metaProgramme : film.meta` を選ぶ。現行データで `metaProgramme` を持つのは 04 のみ（01/02/03/06 は単一行、05 は 2 行で両ページ共通）。
- `components/Films.tsx:78-99` の現行実装は `variant === "programme" ? (…) : (…)` という**単一の三項演算子**なので、TSX の AST を機械走査しても index 用と programme 用に分離できない。§10.4 で seed の正典を実レンダリングHTMLに変更したことで、`/` と `/programme` の両方をスナップショットすれば 2 値が自然に分離して取れる。

選定理由:

1. **client 境界を越えられる**: `Timetable`・`Hero` は client component で、server から props で渡す値はシリアライズ可能でなければならない。`ReactNode` は渡せないため、構造化データは実質必須。
2. **XSS 上不純物が入り込む経路がゼロ**: 値はすべて `createElement` の children として渡り React がエスケープする。`link` の `href` だけは URL として解釈されるため、**manifest 側で `/` 始まりか `#` 始まりのみ許可**し、`javascript:` 等のスキームを拒否する（現行データの文中リンクは `/terms#c2` のみ）。管理画面が踏まれて `<script>` を保存されても、公開側では文字列として表示されるだけで実行されない（保存型 XSS 不成立。§14 で機械検証する）。
3. **完全一致の検証が容易**: 生成されうる要素が 5 種に限定されるため、DOM パス比較で構造のずれを確実に検出できる。

却下した代替案:

- `dangerouslySetInnerHTML` + サニタイズ: サニタイザ依存の追加と許可リスト管理が必要。許可リスト漏れがそのまま XSS リスクになる。AST 方式なら許可外のタグは**そもそも表現できない**ので、脆弱性の面積が小さい。
- マークダウン風記法（`**` 等）: パーサ実装自体が新たな完全一致リスク源になり、編集者の記法ミスで表示が壊れる。
- ReactNode を DB に保存: シリアライズ不可能で client 境界を越えられない。

### 7.4 完全一致が壊れる具体的経路と検出方法（リスク一覧）

| # | 壊れる経路 | 検出方法 |
|---|---|---|
| 1 | TSX → JSON 転記ミス（手作業混入・抽出スクリプトのバグ） | 段階1ゲート: 8 ルートの extract 比較（可視テキスト全件）で diff 検出。抽出は機械生成で、手修正は原則禁止 |
| 2 | Unicode 正規化・コードポイント変質（macOS のファイル I/O、Turso 往復で `〇○` 等が変わる） | `scripts/db-seed.mjs` の読み戻し code point 比較（§10.4）+ 段階2ゲートの diff |
| 3 | `<br>`/`<strong>` の再現ミス（レンダラのバグ、隣接テキストの `<!-- -->` コメント位置差） | タグ出現回数比較で `<br>`/`<strong>` の数のずれを検出。`<!-- -->` は可視テキスト・class・タグに現れないため**受け入れ条件に含めない**（§14 で明文化） |
| 4 | Films 04 の variant 取り違え（index に programme 版を出す等） | `/` と `/programme` の両方の diff で検出（programme 版はクレジット 6 行で必ず差が出る） |
| 5 | 属性値の欠落・変化（`styleVars` の `--d`、`marginTop` 等のインライン style、`img` の `src`/`alt`/`loading`、aria-label、href） | 現行 `extract.mjs` は属性を見ないため、**移設時に属性抽出（img の src/alt/loading、aria-label、style、href の出現マップ）を拡張する**。拡張完了までは §15 の暫定手動比較 |
| 6 | `force-dynamic` 化による prerender との SSR 出力差（head 内 preload リンク等） | 比較対象を可視テキスト/class/タグ/`title`/`description` に限定しているため原則影響しないが、dynamic SSR と prerender で body マークアップが変わらないことは Next 16 の docs（`node_modules/next/dist/docs/`）で**要確認**。段階2ゲートの実測で最終確認 |
| 7 | DB 障害・env 未設定時のフォールバックが DB 障害を隠蔽 | 段階3の往復編集テスト（§14-7）は DB モードでのみ成功するため実質的に検出できる。本番は `wrangler tail` で `console.error` を確認 |
| 8 | `proxy.ts` の matcher ミス（公開面の誤保護 / 管理面の保護漏れ） | §14-5 の curl ステータス確認。加えて API 側でもセッション二重検証するため、`proxy` が無効でも管理 API は守られる |
| 9 | 管理 API 経由の保存型 XSS | `dangerouslySetInnerHTML` 不使用の設計で不成立。§14-8 で `<script>` 保存→エスケープ確認テスト |
| 10 | `app/globals.css` への誤追記 | §14-4 の `git diff --exit-code` |
| 11 | OpenNext/Workers 固有の API 非互換 | Web Crypto のみ使用・Node `fs`/`crypto` 不使用を方針で担保。preview 環境（`wrangler dev` 相当、コマンド名は migrate 生成物に従う。**要確認**）での 8 ルート diff + `/admin` ログイン手動確認 |
| 12 | 依存の peer 不整合 | `@opennextjs/cloudflare@1.20.2` の peer `next >=16.2.11` に 16.3.0 は適合。`npm install` 時に peer 警告が出ないことを確認 |
| 13 | `resolveJsonModule` 未設定で `content/*.json` の import が型エラー | `npx tsc --noEmit` で検出。`tsconfig.json` を確認し、無ければ `"resolveJsonModule": true` を追加（**要確認**） |

## 8. UI Plan

管理画面は `/admin` 以下の 3 画面。デザインは最小限の機能的なものとし、**CSS は `app/admin/admin.css`（新規）に `.adm` スコープで書き、`app/admin/layout.tsx` で import する。`app/globals.css` には 1 行も足さない**（App Router では nested layout からのグローバル CSS import が可能。この仕様は Next 16 docs で要確認）。公開 8 ページには admin.css は読み込まれず、公開面への影響はゼロ。管理画面側は `globals.css` のクラス（`.btn` 等）を参照しない（衝突回避のため全セレクタを `.adm` 配下に置く）。

### 8.1 `/admin/login`

- パスワード入力 1 項目 + 送信ボタン。認証成功で `next` クエリ（デフォルト `/admin`）へ遷移。
- 失敗時は一律「パスワードが違います」、ロック時は「しばらく待ってください（残り ○ 分）」。

### 8.2 `/admin`（ダッシュボード）

- ドキュメント一覧テーブル: ラベル / key / 最終更新日時 / リビジョン番号 / 編集リンク / 公開ページへのリンク。
- ログアウトボタン。

### 8.3 `/admin/docs/[key]`（ドキュメント編集）

- `lib/content/manifest.ts` のフィールド定義からフォームを自動生成。フィールド型:
  - `text`: 1 行入力。
  - `textarea`: 複数行入力。
  - `inline`: リッチテキスト入力。既定は textarea で 1 行 = `<br>` 区切り（保存時に `\n` を `{t:"br"}` へ変換し、隣接文字列は連結して正規化）。`<strong>`/`<em>`/`<b>`/`<span class>`/文中リンクを含むノードは、AST のノード列を並べて 1 ノードずつ編集する専用エディタで扱う（許可タグ 5 種のみ選択可。§7.3）。
  - `strongText`: 「強調部分（`<strong>`）」と「通常部分」の 2 入力。強調が空なら `strong: null`。
  - `array`: カードの繰り返し。各カードに itemTemplate のフォーム + 削除ボタン。フッタに追加ボタン。各カードに上下移動ボタン。
  - `image-path`: テキスト入力 + 現在値の `<img>` プレビュー（フェーズ2でアップロード UI に置き換える）。
  - `checkbox`: `lazy` / `lead` 等のフラグ。作品・スライドの「詳細設定」折りたたみ内に置く。
  - `meta`: `title` / `description`（文字数カウンタ付き）。
- 保存: 変更のあったフィールドのみ差分 ops（§9）を組み立てて PATCH。未変更時は保存ボタン非活性。保存後にリビジョン番号を更新表示。
- リビジョン履歴: 番号・日時・メモの一覧と「この版に戻す」ボタン（revert API）。
- 「公開ページを開く」リンク（別タブ）。

### 8.4 編集規約（完全一致を守るための UI 仕様）

- 保存時に **trim・正規化・全角半角変換を一切しない**。入力値をそのまま送る。
- 改行コードは `\n` に統一（`\r\n` → `\n` のみ実施。現行値に `\r` は存在しないため完全一致に影響しない）。
- 削除と空文字は区別する（空文字は空表示として保存。配列項目の除去は remove ops）。

## 9. API Plan

すべて `/api/admin/` 配下の Route Handler。Content-Type は JSON。認証は login 以外の全エンドポイントで `lib/admin/auth.ts` のセッション検証を実行（`proxy.ts` と二重化。`ver` の DB 照合はここでのみ行う）。mutation（POST/PATCH）は CSRF 対策として以下の 3 つを全て要求: (1) `Content-Type: application/json`、(2) カスタムヘッダ `x-aff-admin: 1`（カスタムヘッダ要求によりクロスサイトの単純フォーム POST が CORS プリフライトで失敗する）、(3) `Origin` ヘッダが存在する場合は Host と一致。

### 9.1 認証方式（具体）

- **パスワード保管形式**: 環境変数 `ADMIN_PASSWORD_PBKDF2` に `pbkdf2-sha256$<iterations>$<salt_base64>$<hash_base64>` 形式で保持。検証は Web Crypto `crypto.subtle.deriveBits`（PBKDF2 / SHA-256 / 鍵長 32 bytes / salt 16 bytes）で計算し、XOR ループで定数時間比較。平文パスワードはどこにも保存しない。ハッシュ文字列の生成は `scripts/hash-password.mjs`（Node の `crypto.subtle` を使用）で行う。
  - **反復回数は計画で固定しない（v2 で変更）**。v1 は 210,000 回としていたが、Cloudflare Workers にはリクエストあたりの CPU 時間上限があり、plan によっては超過しうる（レビューでは Node 実測 18.5ms との報告）。`opennextjs-cloudflare preview` 上で**ログイン1回の CPU 時間を実測してから決定**する。ハッシュ文字列に反復回数を埋め込む形式にしてあるため、後から変更しても既存ハッシュと共存できる。
- **セッション**: Cookie 名 `aff_admin`。値は `v1.<base64url(payload)>.<base64url(sig)>`。payload は `{"iat":<unix秒>,"exp":<unix秒>,"ver":<session_version>}` の JSON、`sig` は `HMAC-SHA256(ADMIN_SESSION_SECRET, "v1.<base64url(payload)>")`。`ADMIN_SESSION_SECRET` は 32 bytes 乱数の base64（`openssl rand -base64 32` 相当で生成）。
  - **`ver` による server 側失効（v2 で追加）**: v1 は payload が `{iat, exp}` だけで、ログアウトは Cookie を消すだけだった。これでは盗まれた Cookie や別ブラウザの既存セッションが 12 時間有効なまま残り、パスワード変更時の全端末失効もできない。`admin_settings.session_version`（§10.2）と `ver` が一致しないセッションを無効とし、ログアウト全端末・パスワード変更・緊急停止で version を +1 する。通常のログアウトは Cookie 削除のみ（自端末だけ）、「全端末からログアウト」は version +1 と使い分ける。
- **Cookie 属性**: `HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`（12 時間、絶対期限。スライド延長なし・期限切れ後は再ログイン）。`Secure` は本番（`NODE_ENV=production`）のみ付与（localhost の http 検証で Cookie が乗らない事故を避ける）。
- **`proxy.ts`（v2 で変更）**: v1 は `middleware.ts` を作る前提だったが、**Next.js 16 で `middleware.js` の file convention は廃止され `proxy.js` に改名された**（`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md` に deprecation が明記され、同 `proxy.md` が正規仕様）。したがってプロジェクトルートに `proxy.ts` を置き、`export function proxy(request: NextRequest)` と `export const config = { matcher: [...] }` を書く。matcher は `["/admin/:path*", "/api/admin/:path*"]` とし、コード内で `/admin/login` と `/api/admin/login` を除外。Cookie 署名と `exp` を Web Crypto で検証し、失敗時はページ遷移なら `/admin/login?next=...` へ 307、API なら 401 JSON。
  - `proxy` は CDN 側にデプロイされうるため共有モジュールやグローバルに依存しない（Next 16 docs の注意書き）。**`ver` の DB 照合は `proxy` では行わず API ハンドラ側で行う**（`proxy` は署名と `exp` のみ）。
  - **OpenNext on Cloudflare での `proxy` の動作形態は preview で要確認**のため、API ハンドラ側でも必ず同一検証を行う（defense in depth）。
- **レート制限**: Turso の `login_attempts` テーブル（§10.2）を使用。IP ごとに**連続 5 回失敗で 15 分ロック**。成功時にレコード削除。ロック中は 429 + `retryAfter` 秒。IP は `cf-connecting-ip` ヘッダ優先、なければ `x-forwarded-for` の先頭、両方なければ `unknown`（`unknown` は全クライアント共有になる点は許容。ローカル検証用）。

### 9.2 エンドポイント

| メソッド・パス | 認証 | 機能 |
|---|---|---|
| `POST /api/admin/login` | 不要 | body `{password}`。成功: 200 + `Set-Cookie: aff_admin=...`。失敗: 401 `{error:"invalid"}`（メッセージ統一）。ロック中: 429 `{error:"locked", retryAfter}` |
| `POST /api/admin/logout` | 要 | `aff_admin` を即時失効（`Max-Age=0`）して 200 |
| `GET /api/admin/documents` | 要 | `{documents:[{key,label,revision,updatedAt}]}`。label は manifest 由来 |
| `GET /api/admin/documents/[key]` | 要 | `{key,data,revision,updatedAt}` |
| `PATCH /api/admin/documents/[key]` | 要 | body `{baseRevision, ops, note?}`。後述。成功: 200 `{data,revision}`。409: revision 不一致。422: バリデーションエラー（`{errors:[{path,message}]}`） |
| `POST /api/admin/documents/[key]/revert` | 要 | body `{revision}`。指定版の data を現在値とする**新規リビジョン**を作成（履歴の書き換えはしない）。200 `{data,revision}` |

PATCH の ops 形式（manifest で検証してから適用）:

```ts
type Op =
  | { op: "set"; path: string; value: string | boolean }
  | { op: "insert"; path: string; index: number; item: unknown }
  | { op: "remove"; path: string; index: number }
  | { op: "move"; path: string; from: number; to: number };
// path 例: "meta.title", "sections.hero.meta.3.value", "items.3.meta.1"
```

- 適用は全 ops が検証を通った場合のみ（部分的に壊れたドキュメントを保存しない）。
- 文字列値は trim/正規化しない。`lines` 型への変換は API 側で `\n` 分割（`\r\n` は `\n` に統一）。
- 保存処理: `revision` を +1 して `content_documents` を UPDATE（`WHERE revision = baseRevision` の楽観ロック）、`content_revisions` に新 data を INSERT、を `client.batch` のトランザクションで実行。

## 10. Database Plan

### 10.1 方針決定: ドキュメント指向 JSON（正規化しない・ただし 1 行にもしない）

**決定: `content_documents` テーブルに `key` 単位の JSON ドキュメント 11 行で保持する。「全データ 1 行」にも完全正規化にもしない。**

ドキュメント一覧（key / 内容 / 利用箇所）:

| key | 内容 | 利用箇所 |
|---|---|---|
| `site` | ヘッダー/フッター共通テキスト（41 ノード相当: ロゴ行・ナビラベル・パートナー CTA・免責文・コピーライト等）+ リンクの `{base, hash}` 構造（下記） | `app/(public)/layout.tsx`（公開全ページ） |
| `page.index` | `meta`（title/description）+ ヒーロー（eyebrow×2・タイトル 2 行・jp・`dl` 4 項目・ボタン 2 つ・slides 配列）+ 各セクション + 最新ニュース 4 件 + ナビゲーター領域 + ニュースレター領域 | `/` |
| `page.about` | `meta` + 全セクション | `/about` |
| `page.programme` | `meta` + 全セクション（films/timetable は別ドキュメント参照） | `/programme` |
| `page.tickets` | `meta` + 料金表 2 行 + ボックス 3 つ + ノベルティ領域 + FAQ 6 組 | `/tickets` |
| `page.news` | `meta` + 記事 3 件 + アーカイブ 5 件 + プレス領域 | `/news` |
| `page.privacy` | `meta` + 全 14 条 | `/privacy` |
| `page.terms` | `meta` + 全 18 条 | `/terms` |
| `page.legal` | `meta` + 表記項目 | `/legal` |
| `films` | 作品 6 件（`no/time/lead/delay/lazy/img/alt/k/t/en/meta: Lines/metaProgramme?: Lines/d`）+ `films__note` 注記 | `/` と `/programme`（`Films` 経由） |
| `timetable` | `days` 2 日分（`d/j/rows[]{time, program: Inline}`）+ 表ヘッダ「時間」「プログラム」+ スワイプヒント + 矢印 aria-label + 下部注記 | `/programme`（`Timetable` 経由） |

**ヘッダー/フッターのリンクは素の文字列で保存できない（v2 で追加）**。
`components/SiteFooter.tsx:14-15` の `frag()` は
`pathname === base ? hash : ${base}${hash}` で、**自ページへのリンクだけ `#venue`、
他ページからは `/programme#venue`** になる（`SiteHeader.tsx` も同様）。
`site` ドキュメントに `href` を素の文字列で持たせると、あるルートの値しか保存できず、
他ルートで属性一致が壊れる。そのため `site` のリンクは

```ts
type SiteLink = { label: string; base: string; hash?: string };
```

の構造で保存し、`frag()` 相当の分岐は**レンダラ側に残す**（データではなく振る舞いなので、
編集対象は `label` と遷移先の `base`/`hash` まで）。
DOM 比較は §14 の定義どおりルート別に `href` の値まで突き合わせる。

理由:

- **完全正規化の却下**: ページ構造が異種（about の Approach カード、legal の定義リスト、tickets の FAQ 等）で、正規化すると 10+ テーブルとテーブルごとの専用レンダラ・専用フォームが必要になり、「TSX → DB → DOM」の写像の完全一致検証が著しく複雑化する。本サイトの編集単位は「ページ」でありドキュメント粒度と一致する。
- **1 テーブル 1 行の却下**: 全ページを 1 JSON にすると更新・履歴・部分取得の粒度が全体になり、PATCH のパスが巨大化、保存ごとに全ページ分を読み書きして楽観ロック衝突時のやり直しコストが高い。1 ドキュメントの破損が全ページに波及する。
- **ドキュメント指向（採用）**: TSX → JSON → DB → DOM の写像が 1:1 で追え、編集 UI を manifest 駆動で一本化できる。読み出しは主キー + batch で 1 往復。繰り返しエンティティ（作品・行・FAQ）はドキュメント内配列 + manifest の itemTemplate で型を担保する。
- トレードオフ: SQL によるフィールド横断検索・一意制約は放棄し、整合性はアプリ側バリデーション（manifest）で担保する。

### 10.2 DDL

v2 では、レビューで指摘された**制約の不足**（`content_revisions` に一意制約・外部キー・
`json_valid` チェックが無く、競合時に現在値に存在しないリビジョンが履歴に残りうる）を修正し、
**サーバ側でセッションを失効させるための `admin_settings`** を追加する。

```sql
-- schema version 1
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS content_documents (
  key        TEXT PRIMARY KEY,
  data       TEXT NOT NULL CHECK (json_valid(data)),
  revision   INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS content_revisions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_key    TEXT NOT NULL REFERENCES content_documents(key) ON DELETE CASCADE,
  revision   INTEGER NOT NULL,
  data       TEXT NOT NULL CHECK (json_valid(data)),
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (doc_key, revision)
);
CREATE INDEX IF NOT EXISTS idx_revisions_doc
  ON content_revisions (doc_key, revision DESC);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip           TEXT PRIMARY KEY,
  failures     INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- 期限切れ行の掃除に使う（放置するとテーブルが肥大化する）
CREATE INDEX IF NOT EXISTS idx_login_attempts_updated
  ON login_attempts (updated_at);

-- セッションを server 側で失効させるための版数。
-- ログアウト全端末・パスワード変更・緊急停止で +1 する。
CREATE TABLE IF NOT EXISTS admin_settings (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  session_version INTEGER NOT NULL DEFAULT 1
);
INSERT OR IGNORE INTO admin_settings (id, session_version) VALUES (1, 1);
```

**書き込みの規律（v2 で追加）**:

- 書き込み系は必ず `client.batch(stmts, "write")` を使う。libSQL の `batch` は
  トランザクションモード未指定だと `deferred` で始まり、並行書き込み時に write への昇格が失敗しうる。
- 楽観ロックは `UPDATE content_documents SET … WHERE key = ? AND revision = ?` の
  **`rowsAffected` を検査**する。0 行なら同一バッチ内の `content_revisions` への INSERT を行わず、
  ロールバックして 409 を返す。`UNIQUE (doc_key, revision)` はこれを DB 側でも二重に防ぐ。
- `login_attempts` は失敗ごとの UPSERT と、`updated_at` が一定時間より古い行の DELETE を
  同一トランザクションに入れる。

### 10.3 マイグレーションの当て方

- マイグレーションフレームワークは導入しない。`scripts/db-migrate.mjs` が **`PRAGMA user_version`** を読み、未適用のバージョン分だけ順に適用する（現時点で version 1 = §10.2）。各文は `IF NOT EXISTS` 付きで冪等。
- 実行は環境変数 `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` を参照。dev/prod は URL を差し替えて同一スクリプトを流す。
- 将来のスキーマ変更は version を 1 つ足した `ALTER TABLE` 等をスクリプトに追記する運用。

### 10.4 初期データ投入（seed）— 手書き排除の設計

1065 ノードの手転記を排除するため、**機械抽出 → JSON → DB** の 2 段階にする。

**v2 での方針転換（重要）**: v1 は TypeScript コンパイラ API で TSX の AST から文言を取る設計だったが、
実測で 2 つの破綻が確認されたため、**正典を「本番ビルドの実レンダリングHTML」に変更する**。

1. **HTML エンティティ**: `app/page.tsx:38` に `<span className="qcard__t">Films &amp; Talks</span>`、
   `app/terms/page.tsx:16` に `Terms &amp;` が直書きされている。`JsxText.text` は生の `Films &amp; Talks` を返すため、
   これを JSON に保存して `{value}` で描画すると React が再エスケープし、可視テキストが
   `Films &amp; Talks` に変わってしまう（正しい可視テキストは `Films & Talks`）。
2. **三項演算子**: `components/Films.tsx:78-99` の 04 の `meta` は単一の `ConditionalExpression` で、
   AST 走査では index 用と programme 用に分離できない。

実レンダリング HTML を正典にすると、**エンティティは復号済み・三項演算子は評価済み・variant はページ別に展開済み**の
状態で値が取れる。TSX は「どのテキストがどの `documentKey` / `fieldPath` に対応するか」の対応付けにのみ使う。

1. **抽出**: `scripts/extract-content.mjs` が、`npm run build` 済みの `npm start` から取得した
   8 ルートの HTML を DOM としてパースし、ページごとの抽出設定（DOM セレクタ → JSON パスの対応表）に従って
   `content/*.json` を生成する。インライン要素を含むノードは §7.3 の `Inline` AST に変換し、
   **隣接する文字列要素は 1 本に連結して正規化**する。`/` と `/programme` の両方を読むことで
   Films 04 の `meta` / `metaProgramme` が自然に分離する。
2. **決定性の保証**: スクリプトを 2 回連続実行して `git diff -- content/` が空であることを確認する（キー順固定・2 スペース整形）。
3. **正しさの保証**: JSON を信頼するのではなく、**段階1でページを JSON 駆動に書き換えたうえで 8 ルートの extract 比較が diff 0** になることをもって「JSON = 現行値」を実証する。ここで誤字・落丁は必ず検出される。
4. **投入**: `scripts/db-seed.mjs` が `content/*.json` を読み、`content_documents` に INSERT（`revision=1`、同時に `content_revisions` へ版 1 を記録）。**既存キーがある場合はデフォルトでスキップして警告**（運用中の編集を seed で上書きしない）。初期化専用とし、強制上書きは `--force` 明示時のみ。
5. **読み戻し検証**: 投入後に全キーを SELECT し、(a) ソース JSON と deep-equal、(b) 全文字列フィールドのコードポイント配列一致、を確認。NG なら終了コード 1（Unicode 正規化による変質をここで検出する）。

### 10.5 接続・フォールバック

- ドライバ: **`@libsql/client@0.17.4` の `@libsql/client/web`** を採用（fetch ベースのため Workers / ローカル Node 双方で同じ import パスを使える想定。ローカル `next dev` での動作は実装時に**要確認**。問題があれば `@tursodatabase/serverless@1.4.0` の `/compat` に切り替える。切替は `lib/content/server.ts` 内に隔離する）。
- `getDocument(key)` / `getDocuments(keys[])` を提供し、内部で `client.batch` を使用。例外・0 件・env 未設定時は同梱 `content/*.json` にフォールバック（`console.error` 出力）。ローカルで env 未設定なら DB なしでも従来どおり表示できる（検証の A/B 切替にも使う）。

## 11. File-by-File Plan

### 11.1 作成

| ファイル | 目的 | 想定変更 | リスク |
|---|---|---|---|
| `proxy.ts` | `/admin`・`/api/admin` のセッション保護（Next 16 で `middleware.ts` は廃止） | `export function proxy` + `export const config.matcher`、login 除外、307/401 分岐。Web Crypto 署名検証 | medium |
| `lib/admin/auth.ts` | PBKDF2 検証・HMAC セッション署名/検証 | Web Crypto のみ。定数時間比較 | medium |
| `lib/admin/rate-limit.ts` | ログイン失敗カウント・ロック | `login_attempts` への read/write | low |
| `lib/content/types.ts` | 11 ドキュメントの TS 型（`Inline` / `InlineNode` 含む） | 型定義のみ | low |
| `lib/content/inline.tsx` | `renderInline` レンダラ（`createElement` 組み立て） | §7.3。許可タグ 5 種のみ | **high**（完全一致に直結） |
| `lib/content/inline-allow.ts` | `cls` の許可リスト（抽出時に実データから自動生成） | 列挙のみ | low |
| `lib/content/manifest.ts` | ドキュメントごとの編集フィールド定義・path 検証・ops 適用・itemTemplate | UI と API の双方から参照 | **high**（保存データ整合の要） |
| `lib/content/server.ts` | Turso クライアント、`getDocument(s)`、JSON フォールバック | `@libsql/client/web`、batch、例外処理 | medium |
| `content/site.json` / `content/index.json` / `content/about.json` / `content/programme.json` / `content/tickets.json` / `content/news.json` / `content/privacy.json` / `content/terms.json` / `content/legal.json` / `content/films.json` / `content/timetable.json` | 現在値の正典データ（抽出スクリプト生成物。コミットする） | 機械生成のみ。**手修正禁止**（修正する場合は抽出設定側を直して再生成） | **high**（誤りが全ページに波及） |
| `scripts/extract-content.mjs` | TSX AST → `content/*.json` 生成 | TS コンパイラ API、ページ別対応表 | medium |
| `scripts/db-migrate.mjs` | DDL 適用（`PRAGMA user_version` 管理） | §10.2/§10.3 | low |
| `scripts/db-seed.mjs` | JSON → Turso 投入 + 読み戻し code point 検証 | §10.4。デフォルト skip-if-exists、`--force` で上書き | medium |
| `scripts/hash-password.mjs` | `ADMIN_PASSWORD_PBKDF2` 文字列の生成 | Node `crypto.subtle` で PBKDF2 | low |
| `scripts/snapshot.sh` / `scripts/extract.mjs` | 回帰検証ツールの移設 | scratchpad から移設 + `extract.mjs` に属性抽出（img src/alt/loading、aria-label、style、href）を拡張 | low |
| `scripts/verify-text.sh`（仮） | snapshot → extract → baseline 比較の一括ラッパ | 移設ツールの I/F に合わせる（要確認） | low |
| `app/admin/layout.tsx` | 管理画面シェル、`admin.css` import、`.adm` ルート | nested layout からの CSS import（Next 16 docs で要確認） | low |
| `app/admin/admin.css` | 管理画面専用スタイル | 全セレクタ `.adm` スコープ。**globals.css には足さない** | low |
| `app/admin/login/page.tsx` + `app/admin/login/LoginForm.tsx` | ログイン画面 | server ラッパ + client フォーム | low |
| `app/admin/page.tsx` | ダッシュボード | ドキュメント一覧（API 経由せず lib 直読みでも可） | low |
| `app/admin/docs/[key]/page.tsx` | 編集画面（データ取得） | manifest + 現在値を Editor へ | medium |
| `app/admin/docs/[key]/Editor.tsx` | 編集フォーム（client） | manifest 駆動フォーム生成、差分 ops 組立、PATCH、履歴/revert | medium |
| `app/api/admin/login/route.ts` | ログイン | PBKDF2 検証、レート制限、Cookie 発行 | medium |
| `app/api/admin/logout/route.ts` | ログアウト | Cookie 失効 | low |
| `app/api/admin/documents/route.ts` | 一覧 GET | manifest ラベル結合 | low |
| `app/api/admin/documents/[key]/route.ts` | GET / PATCH | ops 検証・適用・リビジョン記録・楽観ロック | **high**（データ整合の要） |
| `app/api/admin/documents/[key]/revert/route.ts` | ロールバック | 履歴 data で新規リビジョン作成 | medium |
| `wrangler.jsonc` / `open-next.config.ts` | OpenNext/Workers 設定 | `npx @opennextjs/cloudflare migrate` が生成（内容は生成物に従う。要確認） | low |
| `.dev.vars`（gitignore 対象） | ローカルシークレット | `TURSO_*` / `ADMIN_*` | low |
| `docs/implementation-plan.md` | 本書 | — | low |

### 11.2 変更

| ファイル | 目的 | 想定変更 | リスク |
|---|---|---|---|
| `app/layout.tsx` | site ドキュメント取得と配信方式の切替 | async 化、`getDocuments(["site"])` → `SiteHeader`/`SiteFooter` へ props 渡し、`export const dynamic = "force-dynamic"` 追加（段階2） | **high**（全ページに影響） |
| `app/page.tsx`（index） | JSON/DB 駆動化 | `page.index` + `films` 取得、`Hero`/`Films`/`NewsletterForm` へ props、`generateMetadata` 化 | **high**（構成要素が最多） |
| `app/programme/page.tsx` | 同上 | `page.programme` + `films` + `timetable` 取得、`Films`/`Timetable` へ props、`generateMetadata` 化 | **high**（共有コンポーネント 2 つ） |
| `app/about/page.tsx` / `app/news/page.tsx` / `app/privacy/page.tsx` / `app/terms/page.tsx` / `app/legal/page.tsx` | 同上 | 各 `page.*` 取得 → セクションへマッピング、`generateMetadata` 化 | medium |
| `app/tickets/page.tsx` | 同上 | `page.tickets` 取得 → 料金表/ボックス/FAQ へマッピング、`generateMetadata` 化 | medium |
| `components/Films.tsx` | データ駆動化 | `films`/`note` を props 化、`meta` を `renderInline` に、variant 選択ロジック（§7.3） | **high** |
| `components/Timetable.tsx` | データ駆動化 | `DAYS`・表ヘッダ等を props 化（シリアライズ可能な `Inline` 構造）、スワイプ/タブの挙動は不変 | **high** |
| `components/Hero.tsx` | データ駆動化 | `SLIDES` と静的テキストを props 化、スライドショー挙動は不変 | medium |
| `components/SiteHeader.tsx` / `components/SiteFooter.tsx` | データ駆動化 | 共通テキストを props 化、開閉・`aria-current` ロジックは不変 | medium |
| `components/NewsletterForm.tsx` | データ駆動化 | ラベル類を props 化（props 化する文字列の確定は `NewsletterForm.tsx` を読んで実施。要確認） | low |
| `package.json` | 依存・スクリプト追加 | `@libsql/client@0.17.4`、`@opennextjs/cloudflare@1.20.2`、`wrangler`（`^4.86.0` 適合版）を追加。`db:migrate`/`db:seed`/`content:extract`/`verify:text` 等 scripts 追加（§13） | medium |
| `tsconfig.json` | JSON import 許可 | `"resolveJsonModule": true` が無ければ追加（要確認） | low |
| `.gitignore` | 秘匿・生成物の除外 | `.dev.vars`、`.wrangler/` 等を追加 | low |
| `next.config.ts` | 原則変更なし | migrate が要求した場合のみ追従（要確認） | low |

### 11.3 変更しない（明記）

| ファイル | 理由 |
|---|---|
| `app/globals.css` | 不変条件 3。バイト一致を §14-4 で検査 |
| `components/SmartLink.tsx` / `components/ScrollReveal.tsx` | テキストを持たない/変更不要 |
| `public/robots.txt` / `public/sitemap.xml` / `public/assets/**` | フェーズ1では触らない |

## 12. Implementation Order

各ステップの完了条件（ゲート）を満たさない限り次に進まない。

### 段階0: インフラ（公開面は無変更）

1. `snapshot.sh` / `extract.mjs` を `scripts/` に移設し、baseline を `verification/baseline/` にコミット。`extract.mjs` に属性抽出を拡張。
2. `npx @opennextjs/cloudflare migrate` を実行し `wrangler.jsonc` / `open-next.config.ts` を生成（公開面の挙動は変えない）。
3. Turso で dev/prod 2 DB を作成。`package.json` に `@libsql/client@0.17.4` を追加。
4. `lib/admin/auth.ts` / `lib/admin/rate-limit.ts` / `proxy.ts` / `/admin/login` / `/admin` の殻 / `app/(admin)/admin.css` を作成。Route Group（`app/(public)` / `app/(admin)`）への分割もここで行う。シークレット生成（`scripts/hash-password.mjs` + `openssl rand -base64 32`）。
5. **ゲート**: `npm run build` / `npx tsc --noEmit` / `npm run lint` が exit 0。`npm start` で 8 ルートの extract 比較が diff 0。`/admin` が 307 で `/admin/login` にリダイレクトされる。

### 段階1: JSON 駆動化（公開面は静的のまま）

6. `scripts/extract-content.mjs` を実装・実行して `content/*.json` を生成。2 回連続実行で `git diff -- content/` が空であることを確認。
7. ページを 1 つずつ JSON 参照に書き換える。順序（依存の少ない順。共有コンポーネント絡みは分割不可のため 1 ステップにまとめる）:
   1. `app/tickets/page.tsx`
   2. `app/legal/page.tsx` → `app/privacy/page.tsx` → `app/terms/page.tsx`（条文系）
   3. `app/news/page.tsx`
   4. `app/about/page.tsx`
   5. **`app/programme/page.tsx` + `app/page.tsx` + `components/Films.tsx` + `components/Timetable.tsx` + `components/Hero.tsx` + `components/NewsletterForm.tsx`**（Films が index/programme 横断のため同時に直す）
   6. `app/layout.tsx` + `components/SiteHeader.tsx` + `components/SiteFooter.tsx`（`site` ドキュメント。全ページ影響のため最後）
8. **各ステップのゲート**: build + `npm start` で **8 ルート全件**の extract 比較が diff 0（他ページの退行も同時に検出する）。

### 段階2: DB 切替

9. `scripts/db-migrate.mjs` / `scripts/db-seed.mjs` を実装し、dev DB に適用・seed・読み戻し検証。
10. `lib/content/server.ts` を実装し、全ページ・layout を `getDocument(s)` 経由に切替。`app/layout.tsx` に `force-dynamic` を追加。
11. **ゲート**: (a) `TURSO_*` 設定ありの `npm start` で 8 ルート diff 0（DB モード）、(b) env 未設定で diff 0（フォールバックモード）、(c) OpenNext の preview（`wrangler dev` 相当。コマンド名は migrate 生成物に従う。要確認）で diff 0。

### 段階3: 管理 UI

12. `lib/content/manifest.ts`、編集画面（`app/admin/docs/[key]/`）、管理 API（documents / revert）を実装。
13. **ゲート**: §14 の受け入れ条件すべて。

### 段階4: 本番反映

14. prod DB に migrate + seed。`wrangler secret put` で 3 シークレット登録（`ADMIN_PASSWORD_PBKDF2` / `ADMIN_SESSION_SECRET` / `TURSO_AUTH_TOKEN`。`TURSO_DATABASE_URL` は `wrangler.jsonc` の vars に）。デプロイは migrate が生成した npm scripts を使う（名称・内容は要確認）。
15. **ゲート**: 本番 URL で 8 ルートの extract 比較が baseline と diff 0 + `/admin` でログイン→1 件編集→公開反映→revert→diff 0 を実測。

### フェーズ2（別計画・ここでは位置づけのみ）

- R2 バケット作成、画像アップロード API（Worker 経由 PUT）、`image-path` フィールドへのアップロード UI 追加、既存 `public/assets/` から R2 への移行判断（パス文字列は content 側の値なので移行はデータ更新で完結する設計にする）。

## 13. Verification Commands

### 既存（そのまま使用）

```bash
npm run build        # 本番ビルド（型チェック込み）
npx tsc --noEmit     # 型チェック単独
npm run lint         # ESLint
npm start            # 本番ビルドの起動（http://localhost:3000）
```

### スクリプト新設後に有効（ファイル作成が前提）

```bash
node scripts/extract-content.mjs     # content/*.json 生成（2 回実行して git diff -- content/ が空であること）
node scripts/hash-password.mjs       # ADMIN_PASSWORD_PBKDF2 文字列の生成
node scripts/db-migrate.mjs          # DDL 適用（要: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN）
node scripts/db-seed.mjs             # seed + 読み戻し code point 検証
bash scripts/snapshot.sh <baseUrl> <outDir>   # 8 ルート取得（引数 I/F は移設時に要確認）
node scripts/extract.mjs <htmlFile>           # 抽出 JSON 化（同上）
```

### package.json に追加が必要

```bash
npm run content:extract   # → node scripts/extract-content.mjs
npm run db:migrate        # → node scripts/db-migrate.mjs
npm run db:seed           # → node scripts/db-seed.mjs
npm run verify:text       # → scripts/verify-text.sh（snapshot→extract→baseline 比較の一括ラッパ。新設）
```

### OpenNext / デプロイ系

```bash
npx @opennextjs/cloudflare migrate        # 既存アプリへの導入（1 回限り）
npx wrangler secret put ADMIN_PASSWORD_PBKDF2
npx wrangler secret put ADMIN_SESSION_SECRET
npx wrangler secret put TURSO_AUTH_TOKEN
# preview / deploy は migrate が package.json に追加する scripts を使う（名称・内容は要確認）
```

### 認証の手動確認（curl）

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin          # 307 期待（実装で確定）
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/admin/documents  # 401 期待
```

## 14. Acceptance Criteria

合否が機械判定できる文で定義する。

**「完全一致」の定義（v2 で厳格化）**。v1 は class とタグを**出現回数の多重集合**で比較し、
`<!-- -->` コメントを条件から除外していた。これはレビューの指摘どおり DOM 構造の一致を保証しない
（`<strong>1日券</strong>` と `<strong>2日券</strong>` を別のセルへ移しても `<strong>` の数は 2 のままで検出できない）。
v2 では次のとおり定義する:

1. **DOM パスごとの値の一致** — `<body>` 配下の各要素を、ルートからのインデックス経路（例 `body>2>0>1`）で識別し、
   タグ名・class 属性・主要属性（`img` の `src`/`alt`/`loading`、`a` の `href`、`style`、`aria-label`、`aria-current`、`id`、`type`、`role`）・
   直下テキストノードの内容と順序を比較する。出現回数ではなく**位置ごとの値**を突き合わせる。
2. **`<head>` の一致** — `title`、`meta[name=description]`、`meta[name=robots]`、`html[lang]`、
   および `<link>` の集合（`rel` / `href`。ただし `/_next/static/chunks/` 配下のハッシュ付きパスは正規化）。
   CLAUDE.md は Google Fonts の `<link>` 3 行と全ページ共通の `robots` を不変条件に含めているため、
   v1 が `title`/`description` しか見ていなかったのを補う。
3. **`<!-- -->` コメントノードが 0 個であること** — 実測で現行 8 ページはすべて 0 個。
   React SSR は隣接テキストノードの境界にこのコメントを挿入するため、インラインレンダラが
   構造を変えた瞬間に増える。v1 は条件から除外していたが、**逆に高感度の検出器として採用する**。

比較対象に含めないもの: SSR HTML のバイト一致、`/_next/static/chunks/` のハッシュ、
`force-dynamic` 化によって失われる Next 自動生成の画像 preload 1 本（§7.2 で実測・変換元にも存在しない）。

1. `npm run build`、`npx tsc --noEmit`、`npm run lint` がすべて終了コード 0。
2. 段階1完了時: `npm start` 起動後、8 ルートについて baseline との extract 比較で上記比較項目の diff が全件空（比較ラッパ `npm run verify:text` が exit 0）。
3. 段階2完了時: `TURSO_*` 設定ありの `npm start` で 2 と同じ比較が exit 0（DB モード）。`TURSO_*` 未設定でも exit 0（フォールバックモード）。
4. `git diff --exit-code -- app/globals.css` が終了コード 0（無変更）。
5. 認証: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin` が 307（または 302）で `Location` が `/admin/login` を含む。`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/admin/documents` が 401。
6. レート制限: 誤パスワードで `POST /api/admin/login` に 5 回連続リクエストすると 5 回目以降が 429 を返す。正しいパスワードでは 200 と共に `Set-Cookie: aff_admin=...; HttpOnly; SameSite=Lax; Path=/` が返る。
7. 往復編集: PATCH API で `page.tickets` の 1 フィールドを変更 → `/tickets` の extract に変更後文字列が出現 → revert API → `/tickets` が baseline と diff 0。
8. XSS 不成立: 任意フィールドに `<script>alert(1)</script>` を保存 → 公開 HTML に `<script>alert(1)</script>` が生のまま出現しないこと（エスケープされること）。確認後 revert して baseline と diff 0。
9. `node scripts/db-seed.mjs` の読み戻し検証（deep-equal + コードポイント一致）が終了コード 0。
10. OpenNext preview（コマンド名要確認）で 2 と同じ比較が exit 0、かつ `/admin` へのログインと 1 件編集の公開反映が手動確認できる。

**v2 で追加する受け入れ条件**（レビュー指摘の反映）:

11. **`<!-- -->` が 0 個**: 8 ルートすべての HTML で `<!-- -->` の出現数が 0（baseline と同じ）。段階1・段階2・preview の各ゲートで検査する。
12. **編集網羅性の機械検証**: `docs/content-inventory.md` の全 1065 ノードに `documentKey` と `fieldPath` を割り当てた対応表を `scripts/verify-coverage.mjs` が生成し、**manifest から逆引きできないノードが 0 件**であること（exit 0）。これが無いと「値をコード定数に残したまま DOM diff 0 を通過し、編集できないのに合格する」抜け道が残る（v1 の欠陥）。ヘッダー/フッター共通 41 種、`NewsletterForm` の placeholder `E-mail`・aria-label・ボタン文言も対象に含める。
13. **`proxy.ts` を使っていること**: リポジトリルートに `middleware.ts` が存在しないこと（`test ! -f middleware.ts`）。Next 16 で廃止された規約を使っていないことの確認。
14. **セッションの server 側失効**: 有効な Cookie を保持したまま `admin_settings.session_version` を +1 すると、以後の `GET /api/admin/documents` が 401 を返す。
15. **楽観ロック**: 同一 `baseRevision` で PATCH を 2 回送ると 2 回目が 409 を返し、`content_revisions` に重複 revision が作られていないこと（`SELECT doc_key, revision, COUNT(*) … HAVING COUNT(*) > 1` が 0 行）。
16. **インライン AST の許可リスト**: `t` が列挙外の値、`cls` が許可リスト外、`link.href` が `/` と `#` 以外で始まる ops を PATCH に送ると 422 が返ること。
17. **Route Group の分離**: `/admin/login` の HTML に公開ヘッダーの `class="site-header"` 相当と `class="footer"` が出現しないこと。逆に公開 8 ルートの HTML に `admin.css` 由来の `.adm` セレクタが出現しないこと。

## 15. Repair Loop

検証で diff が出た場合の修復ループ:

1. **特定**: 比較ラッパの出力から route を特定 → 差分テキスト/タグ/class の内容からドキュメント key とフィールド path を逆引きする（`docs/content-inventory.md` と `lib/content/manifest.ts` を突き合わせる）。
2. **原因分類**:
   - (a) **データ誤り**（`content/*.json` または DB の値が変換元と違う）→ `content/*.json` を直接手修正せず、抽出設定（`scripts/extract-content.mjs` の対応表）を直して再生成し、再 seed（`--force` は初期化時のみ）。変換元 HTML（読み取り専用）を正解として参照する。
   - (b) **レンダラ/マッピング誤り**（`lib/content/inline.tsx`、ページの JSX マッピング、variant 選択）→ コード側を修正。
   - (c) **検証ツールの誤検出**（extract 拡張のバグ等）→ ツール側を修正し、baseline から再抽出して再比較。
3. **再検証**: 当該段階のゲート（§12）を最初からやり直す。diff 0 になるまで次段階に進まない。
4. **公開後の事故**: データ起因なら `POST /api/admin/documents/[key]/revert` で即時ロールバック。コード起因なら `git revert` で前段階に戻す（DB データはコードより独立しているため無影響。フォールバック JSON が同梱されている限り公開面は表示を維持する）。
5. **暫定手順（extract の属性拡張完了まで属性差分を検出する必要がある場合）**: 対象 route の HTML を `curl` で保存し、`git diff --no-index` で属性を含めて目視比較する。
