# 敵対的レビューの裁定

kimi k3 が書いた `docs/implementation-plan.md`（v1）に対する codex / gemini のレビューを、
**このリポジトリでの実測**に突き合わせて採否を決めた記録。
レビュアーの主張をそのまま採用せず、確認できたものだけを計画へ反映した。

検証に使った手段:

- `node_modules/next/dist/docs/` の実ファイル（Next 16 の正規ドキュメント）
- リポジトリ全文への `grep`
- `npm run build` + `npm start` で取得した**本番HTMLの実測スナップショット**と、そこから
  可視テキスト配列 / class 出現回数 / タグ出現回数 / `title` / `description` を抽出した fingerprint
- `force-dynamic` を一時的に付けて再ビルドし、静的版と差分を取る A/B 実験（実験後に復元済み・`git diff` 0 件）

---

## 1. 確認できた指摘（計画を修正する）

### V-1 `middleware.ts` は Next 16 で廃止。正しくは `proxy.ts`（codex E-1）

**確認方法**: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md` の
本文が「The `middleware.js` file convention has been **deprecated** in Next.js 16 and renamed to `proxy.js`」と明記。
同ディレクトリに `proxy.md` が存在し、`proxy.ts` をプロジェクトルートに置き
`export function proxy(request: NextRequest)` と `export const config = { matcher: [...] }` を使うと書かれている。
移行 codemod は `npx @next/codemod@canary middleware-to-proxy .`。

**判定**: 採用。計画 v1 の `middleware.ts` 前提（§7.1 / §9.1 / §11.1）をすべて `proxy.ts` に書き換える。

### V-2 インライン要素が `<br>` / `<strong>` の2種では足りない（codex F-1）

計画 v1 は「これ以外のインライン要素は現行データに存在しない」と書いていたが、これは**事実に反する**。

**確認方法**: `grep -ro` による実数カウント。

| 要素 | 件数 | 実例 |
|---|---|---|
| `<br />` | 40 | `app/legal/page.tsx:39` ほか |
| `<strong>` | 22 | `app/legal/page.tsx:25` は**文中に2回**出る |
| `<b>` | 5 | `app/page.tsx:285` 以降 |
| `<em>` | 3 | `app/page.tsx:86`、`app/tickets/page.tsx:108` |

さらに、文中に**属性付きインライン要素**と**リンク**が入る:

- `app/legal/page.tsx:39` — `<td>〔調整中〕<br /><span className="small muted">※ 請求があった場合は遅滞なく開示します</span></td>`
- `app/legal/page.tsx:75` — `<td>〔調整中〕<br />主催者都合により…は<SmartLink href="/terms#c2">利用規約 第10条</SmartLink>をご確認ください</td>`

`Lines`（`string[]`）と `StrongText`（`{strong, text}`）ではこれらを表現できない。

**判定**: 採用。汎用インライン AST（§7.3 を全面改訂）へ変更する。

### V-3 TSX の AST から文言を取ると `&amp;` で壊れる（codex F-2）

**確認方法**: ソースに HTML エンティティが直書きされている箇所は2つ。

- `app/page.tsx:38` — `<span className="qcard__t">Films &amp; Talks</span>`
- `app/terms/page.tsx:16` — `Terms &amp;`

本番HTMLの実測では `qcard__t">Films &amp; Talks<` として出力され、**可視テキストは `Films & Talks`**。
TypeScript コンパイラ API の `JsxText.text` は生の `Films &amp; Talks` を返すため、
これを JSON に保存して `{value}` で描画すると React が再エスケープして
`Films &amp;amp; Talks` になり、可視テキストが `Films &amp; Talks` に変わる。

**判定**: 採用。**seed の正典を TSX の AST ではなく「本番HTMLの実レンダリング結果」に変更する**（§10.4 を改訂）。
HTML を DOM としてパースすれば、エンティティは復号済み・三項演算子は評価済み・variant はページ別に展開済みの
状態で取れる。TSX AST は「どのテキストがどのフィールドか」の対応付け補助にとどめる。

### V-4 Films 04 の三項演算子は単純な AST 走査で分離できない（codex F-2 後半 / gemini）

**確認方法**: `components/Films.tsx:78-99` の `meta` は
`variant === "programme" ? (<>…6行…</>) : (<>…2行…</>)` という単一の `ConditionalExpression`。

**判定**: 採用。V-3 の「HTMLを正典にする」方針で自動的に解決する
（`/` と `/programme` の両方をスナップショットすれば、index 用と programme 用が別々に取れる）。

### V-5 ヘッダー/フッターの `href` はページごとに変わる（codex F-5）

**確認方法**: `components/SiteFooter.tsx:14-15` の
`const frag = (base, hash) => pathname === base ? hash : \`${base}${hash}\``。
自ページへのリンクだけ `#venue`、他ページからは `/programme#venue` になる。`SiteHeader.tsx` も同様。

**判定**: 採用。`site` ドキュメントに `href` を素の文字列で保存すると、あるルートの値しか持てない。
`{ base, hash }` の構造で保存し、`frag()` 相当の分岐はレンダラ側に残す（§10.1 のドキュメント定義を改訂）。

### V-6 ルートレイアウトが `/admin` にも公開ヘッダー/フッターを付ける（codex M-2）

**確認方法**: `app/layout.tsx:28-33` の `<body>` 直下が
`<SiteHeader /> {children} <SiteFooter /> <ScrollReveal />`。
`app/admin/layout.tsx` を足しても root layout は必ず適用されるため、
管理画面に公開サイトのヘッダー・フッター・IntersectionObserver・`site` の DB 取得が混入する。

**判定**: 採用。Route Group で `app/(public)/` と `app/(admin)/` に分離し、
root layout は `<html><body>{children}</body></html>` と `<head>` のフォント3行だけにする（§8 / §11 を改訂）。
gemini の「管理画面CSSは Route Group で遮断せよ」も同じ結論なので同時に解決する。

### V-7 受け入れ条件が `robots` と Google Fonts を見ていない（codex O-1）

**確認方法**: `app/layout.tsx:7-10` に `robots: { index: false, follow: false, noarchive: true }`、
`:16-26` に `preconnect` 2本 + Google Fonts stylesheet 1本。CLAUDE.md はこれらを不変条件に含めている。
計画 v1 の §14 は `title` / `description` しか検査していない。

**判定**: 採用。fingerprint に `<head>` の link 集合と `meta[name=robots]`、`html[lang]` を追加する。

### V-8 「出現回数の一致」は DOM 構造の一致を保証しない（codex F-4）

**確認方法**: 現行の抽出ツールは class とタグを**出現回数の多重集合**で比較している（私が書いた実装）。
`<strong>1日券</strong>` と `<strong>2日券</strong>` を別セルへ移しても `<strong>` の数は2のままで検出できない。

**判定**: 採用。比較対象を「DOM パスごとの値」に格上げする（§14 と検証ツールを改訂）。
あわせて、実測で `<!-- -->` コメントが**現在8ページすべて0個**であることを確認したので、
「`<!-- -->` が0個のままであること」を受け入れ条件に加える
（React は隣接テキストノードの境界にこのコメントを挿入するため、
インラインレンダラが構造を変えた場合の高感度な検出器になる）。
計画 v1 が「`<!-- -->` は条件に含めない」としていた判断は**逆**にする。

### V-9 リビジョン履歴が競合時に汚れる／DB 制約が不足（codex F-3・M-5）

`UPDATE ... WHERE revision = baseRevision` が0行でもエラーにならず、同じ batch 内の
`content_revisions` への INSERT が通ってしまう。`content_revisions` に
`UNIQUE(doc_key, revision)`・外部キー・`CHECK(json_valid(data))` がない。`client.batch` の
トランザクションモードが未指定（libSQL の既定は deferred）。

**判定**: 採用。DDL に制約を追加し、書き込みは `client.batch(stmts, "write")` に統一、
`rowsAffected` を見て0なら 409 を返す（§9.2 / §10.2 を改訂）。

### V-10 セッションを server 側で失効できない（codex M-3）

payload が `{iat, exp}` だけで、ログアウトは Cookie 削除のみ。盗まれた Cookie は12時間有効なまま。

**判定**: 採用。payload に `ver`（session version）を入れ、DB の `admin_settings.session_version` と
突き合わせる。ログアウト全端末・パスワード変更時に version を +1 して即時失効させる。

### V-11 PBKDF2 210,000回は Workers の CPU 制限に触れうる（codex M-4）

codex は Node の WebCrypto で 18.5ms を実測したと報告。Cloudflare Workers の
リクエストあたり CPU 時間は plan により異なる。

**判定**: 条件付き採用。回数を計画で固定せず、
**`opennextjs-cloudflare preview` 上で実測してから決める**手順に変更する。
`login_attempts` に期限切れ行の削除方針がない点も採用（同一トランザクションで cleanup）。

---

## 2. 確認できなかった指摘（採用しない）

### R-1 「JSXの空白テキストノードが失われて DOM 構造が壊れる」（gemini・致命的と主張）

**反証**: 本番HTMLの実測。`Films.tsx` の04クレジットは複数行 JSX で書かれているが、
出力されたテキストノードは前後に空白を持たない:

```
"出演：入江海斗、ヴー・トゥ・ザン"
"古山憲太郎、川上麻衣子、橘ゆかり、村松和輝、辻井拓、佐藤たかみち、納見俊三千、グエン・ズイ・ティン"
…
"2020年｜日本｜日本語・ベトナム語｜27分"
```

JSX は行頭・行末の空白と改行を除去するため、`Lines` レンダラが生成する `[text, br, text, …]` は
現行と同一になる。指摘は成立しない。

なお `SiteFooter.tsx:108` のコメントが言う「日本語の文中で改行すると空白が入る」は
**1つのテキストノードの内部で改行した場合**の話で、要素境界での改行とは別問題。
この事故経路自体は実在するので、レンダラ側の規約として §7.3 に明記する（codex O-3 の指摘は採用）。

### R-2 「`force-dynamic` で head の preload 等が変化し一致が根本から崩れる」（gemini・致命的と主張）

**反証**: A/B 実験で実測した。`app/layout.tsx` に `export const dynamic = "force-dynamic"` を付けて
再ビルドし（全8ルートが `ƒ (Dynamic)` になったことを確認）、静的版と比較した結果:

- 可視テキスト配列・class 出現回数・タグ出現回数・`title` / `description`: **index の `<link>` が9→8になる1点のみ差分**
- `<!-- -->` コメント数: 両方とも0
- Google Fonts の3行: 両方に存在
- 生バイト差: index が −75、他7ページは +1

消えた1本を特定したところ、
`<link rel="preload" as="image" href="/assets/films/hero-01-secret-sea.jpg">` だった。
これは Next が prerender 時に自動生成するヒーロー画像の preload であり、
**変換元の静的HTMLには存在しない**。したがって CLAUDE.md の不変条件（変換元との一致）には違反せず、
むしろ変換元に近づく。「一致が根本から崩れる」という主張は成立しない。

ただし LCP のヒントが失われるのは事実なので、§7.2 に既知のトレードオフとして記録する。

### R-3 「動的SSRを破棄して静的生成へ全面改訂せよ」（gemini・総評）

**却下理由**: R-2 のとおり、主張の根拠である「DOM一致の崩壊」が実測で否定された。
加えて静的生成に戻すと「編集が即時公開される」という要件（§2）を満たせず、
編集のたびに再ビルド・再デプロイする CI が必要になる。現状 CI は存在しない。
**要件を落とす提案なので採用しない。**

### R-4 「`npm install` で peer 警告やバージョン自動変更が起きるので `--legacy-peer-deps` を使え」（gemini・軽微）

**却下理由**: `@opennextjs/cloudflare@1.20.2` の peer は `next: ">=15.5.21 <16 || >=16.2.11"` で、
本リポジトリの `next@16.3.0` は適合する（npm registry で実測済み）。
不整合が無いのに `--legacy-peer-deps` を既定手順にすると、**本当の不整合を隠す**ため有害。
peer 警告が実際に出た場合にのみ対処する。

---

## 3. 保留（実装時に実測して決める）

| # | 論点 | 誰の指摘 | 決め方 |
|---|---|---|---|
| P-1 | Next 16 の `cacheComponents` を有効にするか、`connection()` を使うか | codex E-2 | `next.config.ts` に `cacheComponents` を入れない前提を明記したうえで、`force-dynamic` が期待どおり効くことを preview で実測（既に `npm start` では実測済み） |
| P-2 | PBKDF2 の反復回数 | codex M-4 | `opennextjs-cloudflare preview` でログイン1回のCPU時間を実測して決定 |
| P-3 | Turso の無料枠が bot トラフィックで枯渇しないか | gemini | `robots.txt` は全面 Disallow だが従わない bot は来る。`getDocuments` の前段に短TTL（60秒程度）のエッジキャッシュを置く案を §7.2 に追記し、実トラフィックを見てから有効化する |
| P-4 | `opennextjs-cloudflare preview` を独立ゲートにする | codex E-3 | 採用方針。`npm start` は Next 差分の検証、preview は Workers ランタイム差分の検証と役割を分ける |

---

## 4. 結論

計画 v1 の**骨格（段階移行・各ゲートで diff 0・ドキュメント指向スキーマ・即時公開＋リビジョン）は維持**する。
以下を v2 で改訂する:

1. `middleware.ts` → `proxy.ts`（V-1）
2. インラインの表現を汎用 AST に拡張（V-2）
3. seed の正典を TSX AST から**実レンダリングHTML**へ変更（V-3・V-4）
4. ヘッダー/フッターの href を構造化（V-5）
5. Route Group で公開面と管理面を分離（V-6）
6. 検証を「出現回数」から「DOMパスごとの値」へ格上げし、`<head>` と `<!-- -->` 0個を条件に追加（V-7・V-8）
7. DB 制約・トランザクションモード・楽観ロックの取り扱いを厳格化（V-9）
8. セッションを server 側で失効可能に（V-10）
9. PBKDF2 の回数は preview 実測で決定、レート制限テーブルに cleanup を追加（V-11）
