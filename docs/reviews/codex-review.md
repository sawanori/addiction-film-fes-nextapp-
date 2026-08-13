# 敵対的レビュー（codex）

## 致命的（このまま実装すると壊れる）

### F-1 リッチテキストを `<br>`/`<strong>` だけに限定しているため、現行 DOM を再生成できない
- 該当: `docs/implementation-plan.md:147-154`, `docs/implementation-plan.md:197-198`, `app/page.tsx:86`, `app/tickets/page.tsx:108`, `app/page.tsx:285-302`, `app/legal/page.tsx:25`, `app/programme/page.tsx:54`
- 何が起きるか: 計画の `Lines` / `StrongText` だけでは `<em>`、`<b>`、`span.small.muted`、文中リンクを表現できない。DB 化時にタグを落とせば DOM 構造と class 出現が壊れ、コード側に残せば「全可視テキストを編集可能」の要件が未達になる。
- 根拠: 計画は「これ以外のインライン要素は現行データに存在しない」としているが、実コードには `<em>` が `app/page.tsx:86` と `app/tickets/page.tsx:108` にあり、`<b>` が `app/page.tsx:285` 以降にあり、`<span className="small muted">／Films</span>` が `app/programme/page.tsx:54` にある。`app/legal/page.tsx:25` は `<strong>` が文頭だけでなく文中にも 2 回出る。
- 修正案: `text` / `br` / `strong` / `em` / `b` / `span` / `link` を持つ汎用 inline AST を定義し、許可 class と href 種別まで含めてレンダリングする。少なくとも `docs/content-inventory.md` に現れる分割テキストノード全件と、実 TSX の inline 要素全件を対応表で潰すこと。

### F-2 TSX AST 抽出は `&amp;` と条件式で seed を誤る
- 該当: `docs/implementation-plan.md:364-370`, `app/page.tsx:38`, `docs/content-inventory.md:159`, `components/Films.tsx:78-99`
- 何が起きるか: `app/page.tsx:38` の `Films &amp; Talks` を TypeScript compiler API で読むと raw text は `Films &amp; Talks` のままになる。本セッションの実測でも `JsxText.text` は `Films &amp; Talks` だった。これを JSON に保存して `{value}` で描画すると表示テキストが `Films &amp; Talks` になり、現行の可視テキスト `Films & Talks` と一致しない。さらに `Films.tsx:78-99` の `variant === "programme" ? ... : ...` は 1 つの `ConditionalExpression` なので、単純な AST 走査では index 用と programme 用の 2 値に分離できない。
- 根拠: `docs/content-inventory.md:159` は可視テキストを `Films & Talks` と記録している。`components/Films.tsx:78-99` は 04 作品の `meta` を三項演算子でページ別に分岐している。
- 修正案: TSX AST を正典にしない。まず現行 `npm start` の HTML から DOM パーサで seed JSON を生成し、TSX AST は補助情報に留める。TSX AST を使うなら entity decode、三項演算子評価、ページ別 variant 展開を仕様化し、抽出結果の各 field path を baseline DOM path と照合する。

### F-3 楽観ロックの `client.batch` 設計は競合時に revision 履歴を汚染する
- 該当: `docs/implementation-plan.md:295`, `docs/implementation-plan.md:337-346`
- 何が起きるか: 2 人が同じ `baseRevision` で保存した場合、後勝ち側の `UPDATE ... WHERE revision = baseRevision` は 0 行更新になるが SQL エラーではない。そのまま同じ batch 内の `content_revisions INSERT` が実行されると、現在値に存在しない revision が履歴に残る。DDL には `(doc_key, revision)` の unique 制約もないため重複 revision も入る。
- 根拠: 計画は `content_documents` の `UPDATE` と `content_revisions` の `INSERT` を `client.batch` のトランザクションで実行するとだけ書いている。`content_revisions` は `id` だけが主キーで、`doc_key` への外部キー、`UNIQUE(doc_key, revision)`、`CHECK(json_valid(data))` がない。
- 修正案: `client.transaction("write")` または `client.batch([...], "write")` を使い、`UPDATE ... RETURNING revision` の結果または `rowsAffected` を見て 0 件なら rollback して 409 にする。`content_revisions` には `UNIQUE(doc_key, revision)`、`FOREIGN KEY(doc_key) REFERENCES content_documents(key)`、`CHECK(json_valid(data))` を追加する。

### F-4 「DOM 完全一致」の検証条件が DOM 構造一致を検証していない
- 該当: `CLAUDE.md:25-31`, `docs/implementation-plan.md:18`, `docs/implementation-plan.md:531-544`, `app/tickets/page.tsx:45-53`, `app/legal/page.tsx:75`
- 何が起きるか: `class 出現回数` と `タグ出現回数` が同じでも DOM の親子関係やテキストノード境界は壊せる。例えば tickets の `<strong>1日券</strong>` と `<strong>2日券</strong>` を別セルへ移しても `<strong>` の数は 2 のまま。legal の文中 `SmartLink` をテキスト化して別の `<a>` を追加してもタグ数だけならすり抜ける。
- 根拠: `CLAUDE.md:27` は「可視テキスト・DOM構造・class名・title/description は変換元の8ページと完全一致」としている。一方、計画の §14 は可視テキスト配列、class 出現回数、タグ出現回数、限られた属性 map だけを完全一致と再定義している。
- 修正案: HTML を parse5 等で正規化し、body 配下の element path、tag、class、主要属性、text node の順序と境界を route ごとに比較する。少なくとも「出現回数」ではなく「DOM path ごとの値」を baseline にする。

### F-5 `site` ドキュメントだけではヘッダー/フッターのページ別 href を seed できない
- 該当: `docs/implementation-plan.md:307`, `docs/implementation-plan.md:424`, `components/SiteHeader.tsx:19-22`, `components/SiteFooter.tsx:14-15`
- 何が起きるか: Header/Footer の href は現在パスで変化する。例えば `/about` では `#partner`、他ページでは `/about#partner` になる。footer も `frag("/programme", "#venue")` のように自ページだけ `#...` にする。単一の `site` JSON に href 文字列を保存する設計だと、ある route の値しか seed できず、他 route の属性一致が壊れる。
- 根拠: `SiteHeader.tsx:19-22` は `pathname === "/about"` で href を分岐し、`SiteFooter.tsx:14-15` は `pathname === base ? hash : \`${base}${hash}\`` を使っている。計画の `site` ドキュメント定義は「共通テキスト」中心で、このルールをデータ型として持っていない。
- 修正案: href は raw 文字列ではなく `{ base, hash, selfHash: true }` のような構造で保存し、既存の `frag()` 相当を renderer に残す。baseline 比較は route 別 DOM path の href 値まで見る。

## 重大（動くが要件を満たさない/後で高くつく）

### M-1 Phase 1 完了時点で「全可視テキスト編集可能」を機械的に証明できない
- 該当: `docs/implementation-plan.md:11-18`, `docs/implementation-plan.md:84-93`, `docs/implementation-plan.md:240-249`, `components/NewsletterForm.tsx:15-16`
- 何が起きるか: 既存 DOM と diff 0 でも、値をコード定数に残していれば表示は一致する。つまり、編集 UI の field path が 1065 ノードを網羅していなくても受け入れ条件を通過できる。`NewsletterForm` だけでも placeholder `E-mail`、aria-label `メールアドレス`、button `Subscribe →` があるが、計画は `NewsletterForm.tsx` を「要確認」としている。
- 根拠: `docs/content-inventory.md:3-4` は 1065 ノードを示すが、計画 §14 に「inventory の全ノードが manifest field に対応する」検査がない。
- 修正案: `docs/content-inventory.md` の各ノードに `documentKey` と `fieldPath` を割り当て、manifest から逆引きできないノードが 0 件であることを受け入れ条件に入れる。

### M-2 管理画面は root layout から public header/footer を外せない
- 該当: `app/layout.tsx:28-32`, `docs/implementation-plan.md:397-402`, `docs/implementation-plan.md:416`
- 何が起きるか: `app/admin/layout.tsx` を追加しても、`app/layout.tsx` の `<SiteHeader />` と `<SiteFooter />` は admin 配下にも必ず入る。管理画面専用 shell のつもりでも、公開サイトの header/footer、`ScrollReveal`、site DB fetch が `/admin/login` に混入する。
- 根拠: 現在の root layout は body 内に `SiteHeader`、`children`、`SiteFooter`、`ScrollReveal` を直列で置いている。計画は root layout に site ドキュメント取得を足す予定だが、admin を route group で分離する記述がない。
- 修正案: `app/(public)/...` と `app/(admin)/admin/...` に route group を切り、root layout は `<html><body>{children}</body></html>` だけにする。公開側 layout にだけ `SiteHeader` / `SiteFooter` / `ScrollReveal` を置く。

### M-3 認証の「ログアウト」とセッション失効が実質的にクライアント Cookie 削除だけ
- 該当: `docs/implementation-plan.md:266-268`, `docs/implementation-plan.md:276`
- 何が起きるか: Cookie payload は `iat` / `exp` だけで `jti` や session version がない。`POST /api/admin/logout` は `Max-Age=0` を返すだけなので、盗まれた Cookie や別ブラウザの既存セッションは 12 時間有効なまま残る。パスワード変更時の全セッション失効もできない。
- 根拠: 計画の session payload は `{"iat":...,"exp":...}` のみ。server-side denylist や `session_version` の設計がない。
- 修正案: `admin_sessions` または `session_version` を DB に持ち、payload に `jti` / `ver` を入れる。logout、パスワード再発行、緊急停止で server 側検証を失敗させられるようにする。

### M-4 PBKDF2 と rate-limit DB 書き込みが Workers の DoS 経路になる
- 該当: `docs/implementation-plan.md:265`, `docs/implementation-plan.md:269`, `docs/implementation-plan.md:348-353`
- 何が起きるか: `PBKDF2 / 210,000 回` は本セッションの Node WebCrypto 実測で 18.5ms だった。Cloudflare Workers Free の HTTP request CPU limit は 10ms なので、Free plan ではログイン試行だけで CPU 超過になり得る。さらに失敗ごとに Turso の `login_attempts` へ書き込む設計で、行の TTL や cleanup がないため、分散 IP からの失敗で DB 書き込みとテーブル肥大化を起こせる。
- 根拠: Cloudflare Workers limits は Free の CPU time を 10ms、Paid の default を 30s としている。DDL の `login_attempts` は `ip` 主キーと時刻だけで削除方針がない。
- 修正案: 本番 Workers plan と `limits.cpu_ms` を計画に固定する。PBKDF2 回数は Workers preview で p95 を実測して決める。rate-limit は atomic UPSERT と期限切れ削除を同一 transaction に入れ、必要なら Cloudflare 側 rate limiting / Turnstile / WAF を併用する。

### M-5 `client.batch` の transaction mode が未指定
- 該当: `docs/implementation-plan.md:295`, `docs/implementation-plan.md:375`
- 何が起きるか: libSQL の `batch` は transaction mode 未指定だと `deferred` で始まり、書き込み時に write transaction へ昇格する。並行 write があると昇格失敗を処理する必要が出る。Workers の同時実行下では PATCH、revert、login_attempts がすべてこの影響を受ける。
- 根拠: 計画は `client.batch` を使うとだけ書き、`"write"` mode を指定していない。
- 修正案: 書き込み系は `client.batch(statements, "write")` または `client.transaction("write")` に統一し、busy / conflict を 409 または retry に分類する。

## 軽微

### L-1 nested layout の admin.css は「公開ページに読み込まれない」とは言い切れない
- 該当: `docs/implementation-plan.md:226`, `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md:294`
- 何が起きるか: Next docs は app 配下の layout/page/component から global CSS import 可能としつつ、route 遷移時に stylesheet が除去されず conflict になり得ると明記している。`admin.css` を `.adm` に完全スコープできていれば視覚影響は抑えられるが、「公開 8 ページには admin.css は読み込まれず、影響ゼロ」という計画の表現は強すぎる。
- 根拠: Next docs の global CSS 注意書きは、stylesheets が navigation で remove されない可能性を述べている。
- 修正案: `admin.css` は CSS Modules にするか、route group 分離後も `.adm` 直下 selector だけであることを lint する。受け入れ条件に admin 経由で public へ client navigation した後の CSS 影響確認を入れる。

## 計画書の事実誤認・検証できない記述

### E-1 Next.js 16 では `middleware.ts` は deprecated で、正規の file convention は `proxy.ts`
- 該当: `docs/implementation-plan.md:114`, `docs/implementation-plan.md:268`, `docs/implementation-plan.md:383`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md:11-13`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:11-23`
- 何が起きるか: 計画は Next 16 対応を掲げながら `middleware.ts` 作成を前提にしている。16 の docs では `middleware.js` convention は deprecated で `proxy.js|ts` に renamed 済み。
- 修正案: `proxy.ts` / `export function proxy(request: NextRequest)` / `export const config = { matcher: [...] }` に計画を書き換える。OpenNext 側では Node Middleware 未対応の注意も Cloudflare docs と照合する。

### E-2 `force-dynamic` を Next 16 の主方針にする根拠が古いモデル寄り
- 該当: `docs/implementation-plan.md:126-135`, `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md:262-264`, `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md:6-15`
- 何が起きるか: `export const dynamic = "force-dynamic"` は Cache Components 無効の previous model では使えるが、Next 16 docs は request-time rendering を明示する API として `connection()` を推奨している。計画は `cacheComponents` を無効に固定するのか、16 の新 caching model に乗るのかを決めていない。
- 修正案: `next.config.ts` に `cacheComponents` を入れない前提を明記するか、DB read の直前で `await connection()` を使う設計に更新する。OpenNext preview で build output の route symbol と response cache header を確認する。

### E-3 `npm start` の検証は Workers runtime の検証ではない
- 該当: `docs/implementation-plan.md:467`, `docs/implementation-plan.md:483-522`
- 何が起きるか: `npm start` は Next の production server であり、Cloudflare Workers の runtime、binding、nodejs_compat、static assets、OpenNext cache 初期化を通らない。計画は preview も入れているが、受け入れ条件の中心が `npm start` のままなので本番差分の原因切り分けが遅れる。
- 根拠: OpenNext docs は、開発は `next dev`、Workers runtime の local preview は `opennextjs-cloudflare build` 後に `opennextjs-cloudflare preview` と説明している。
- 修正案: `npm start` は Next 差分検証、`opennextjs-cloudflare preview` は Workers 差分検証として別ゲートにする。DB binding と `.dev.vars` の読み込み差分も preview 側で確認する。

## 見落とされている論点

### O-1 Google Fonts link と robots metadata が受け入れ条件から抜けている
- 該当: `CLAUDE.md:31`, `app/layout.tsx:7-10`, `app/layout.tsx:15-26`, `docs/implementation-plan.md:531-544`
- 何が起きるか: root metadata の `robots: { index: false, follow: false, noarchive: true }` と Google Fonts の `<link>` 3 本は CLAUDE.md の不変条件に含まれるが、受け入れ条件は `title` / `description` しか見ていない。DB 化や layout async 化で head が変わっても検出できない。
- 修正案: head 比較に `meta[name=robots]`、preconnect 2 本、stylesheet href、`html[lang]` を DOM path で追加する。

### O-2 受け入れ条件が「機械判定可能」と言いながら手動・曖昧条件を含む
- 該当: `docs/implementation-plan.md:531-544`
- 何が起きるか: §14-10 は「ログインと 1 件編集の公開反映が手動確認」と書いており機械判定ではない。§14-5 の curl 例は `-w "%{http_code}"` だけなので `Location` が `/admin/login` を含むか判定できない。§14-7 は `page.tickets` の 1 フィールドしか往復編集せず、配列追加・削除・並べ替え、rich inline、variant、site 共通部を検証しない。
- 修正案: `verify:admin` を作り、Cookie jar、CSRF header、PATCH/revert、Location header、全 document key の代表 field、array move/insert/remove、rich inline を機械的に叩く。

### O-3 JSX whitespace の事故防止が運用規約になっていない
- 該当: `components/SiteFooter.tsx:107-109`, `docs/implementation-plan.md:253-258`
- 何が起きるか: footer は「日本語の文中で改行すると JSX が空白を挿入するため1行で書く」と明記している。これは現行コードで既に確認済みの事故経路だが、計画は trim しないとは書く一方で、DB renderer 側の JSX whitespace 禁止規約を持っていない。
- 根拠: `SiteFooter.tsx:108` のコメント自体が、このリポジトリ固有の事故経路を示している。
- 修正案: inline renderer は配列から `React.createElement(Fragment, ...)` で組み立て、JSX の行間 whitespace に依存しない。baseline には text node 境界と文字列を含める。

承認不可。
