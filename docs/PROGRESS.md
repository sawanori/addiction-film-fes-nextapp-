# /admin 管理画面：進捗記録

最終更新: 2026-08-14 / ブランチ `main` / **task_001〜014 すべて完了。本番稼働中**

計画の全体像は `docs/implementation-plan.md`、タスク定義は `docs/task-list.json`、
受け入れ条件は `docs/acceptance-checks.json`、レビューの採否は `docs/reviews/review-verdict.md` にある。
この文書は「いま何が終わっていて、次に何をすればよいか」だけを書く。

---

## 1. 現在地

**公開8ページ全ページ + 共有ヘッダー/フッターのコンテンツ駆動化が完了**（task_005〜008）。
Turso の dev/prod DB は作成・スキーマ適用・**全11ドキュメントの投入まで完了**（dev / prod 両方）。
**task_003（OpenNext / wrangler 導入）も完了し、Cloudflare Workers 上（OpenNext preview / workerd）でも
公開8ルートが baseline と完全一致することを実測済み**（task_004a の `proxy.ts` で一度ビルドが
通らなくなったが、task_004c で解消した。経緯は §9）。
**計画の全タスクが完了し、Cloudflare Workers 上で本番稼働している。**
公開URL: https://addiction-film-fes-nextapp.snp-inc-info.workers.dev （`noindex` のため検索結果には出ない）
公開サイトの見た目と文言は**1文字も変わっていない**（`npm run verify:text` が毎コミットで完全一致）。

| タスク | 状態 | コミット |
|---|---|---|
| 実装計画（起草→敵対レビュー→裁定→v2） | 完了 | `61c054e` |
| task_001 回帰検証ハーネス | 完了 | `7d2beb7` |
| task_002 Route Group で公開面/管理面を分離 | 完了 | `b2b9516` |
| task_005/006 tickets をコンテンツ駆動化 | 完了 | `66d9cc2` |
| task_006 legal をコンテンツ駆動化 | 完了 | `e7904ca` |
| task_009 Turso スキーマ + seed | 完了（tickets/legal投入済み） | `6f4fec0` |
| task_006 privacy/terms/news をコンテンツ駆動化 | 完了（kimi/codex/geminiへ並行委譲） | `e6b7908` |
| task_006 about をコンテンツ駆動化（task_006完了） | 完了（kimiへ委譲） | `e2466cc` |
| task_007 index/programme + 共有コンポーネント4つ | 完了（kimi実装+codexレビュー） | `edda002` |
| task_008 SiteHeader / SiteFooter（公開面コンテンツ駆動化 完了） | 完了（codex実装+kimiレビュー） | `cce4f57` |
| task_003 OpenNext / wrangler 導入 | 完了 | `cbf8198` |
| task_004a 認証コア（`lib/admin/auth.ts` + `proxy.ts`） | 完了 | `2bff7d9` |
| task_004b ログイン画面 / login・logout API / レート制限 | 完了（`next start` 上で検証済み） | `146d72c` |
| task_004c `proxy.ts` 廃止と認証の app 層移設（§9） | 完了。`opennextjs-cloudflare build` が終了コード0に戻った | `c1fd860` |
| task_009残り `content/` 全11件を Turso へ投入（dev / prod 両方） | 完了（読み戻し検証OK） | `c1fd860` / `f778298` |
| task_010 公開ページのDB読み出し切替 | 完了（`next start` / workerd 双方で完全一致） | `063c6db` |
| task_011 manifest + 編集網羅性の検証 | 完了（リーフ1078件すべて対応） | `bfc0657` |
| task_012 管理API | 完了 | `32c5318` |
| task_013 管理画面UI | 完了 | `ddb32ee` |
| task_014 本番反映 | **完了。https://addiction-film-fes-nextapp.snp-inc-info.workers.dev で稼働中**（§10） | `f778298` の構成でデプロイ |

### task_006完了にあたっての付記（2026-08-13追記）

privacy/terms/news/about の4ページは、この回から kimi/codex/gemini への委譲方式に切り替えて
実装した（Claudeは実装せずオーケストレーションのみ）。3ツールとも成果物の質はおおむね良好だったが、
以下の問題が起き、いずれもマージ前に検出・修正した:

- **geminiが2回とも対象外ファイルに手を出した**（`dangerouslySetInnerHTML`でXSS対策方針に反する実装、
  `app/layout.tsx`・`components/SiteHeader.tsx`への無断変更）。また `--yolo` がこの環境ではシェルコマンド
  実行の確認をバイパスできず、geminiの「ビルド成功」等の自己申告は検証されていない状態だった
- **kimiのworktreeを`cleanup:true`で早期に消し、未追跡ファイル（`content/privacy.json`）の中身を
  一度消失させた**（再委譲で復旧）。以後は「未追跡ファイルの中身をコピーしてからcleanup」の順を徹底
- **codexのworktreeでnode_modulesシンボリックリンクの中身が消え、システム全体のディスクが
  一時120MB空きまで逼迫した**（`rm -rf node_modules/`のトレイリングスラッシュがリンク先を空にしたとみられる）。
  `~/Library/Caches`等の削除で復旧（約10GB回収）

いずれも最終的な受け入れ判定（build/tsc/lint/verify:text）はメインリポジトリで独立して実行し、
各ツールの自己申告に依存していない。

### task_003完了にあたっての付記（2026-08-14追記）

`npx @opennextjs/cloudflare migrate` で導入した。生成物は次のとおり:
`wrangler.jsonc`（`compatibility_date` 2026-08-14 / `compatibility_flags` は `nodejs_compat` と
`global_fetch_strictly_public` / `main` は `.open-next/worker.js` / assets バインディングあり）、
`open-next.config.ts`（`r2IncrementalCache` を有効化）、`public/_headers`（`/_next/static/*` の
`Cache-Control`）。`next.config.ts` に `initOpenNextCloudflareForDev()` が追加され、`package.json` に
`preview` / `deploy` / `upload` / `cf-typegen` が追加された。

品質チェック（Opus / codex / gemini-3.5-flash の3者レビュー）で blocker が1件見つかり、同じコミットで
修正した。**ESLint 9 のフラット設定は `.gitignore` を参照しないため、生成される `.open-next/`（91ファイル）と
`.wrangler/`（2ファイル）を走査し、lint の指摘が 6件から 14873件（366 errors / 14507 warnings）へ増えていた。**
`eslint.config.mjs` の `globalIgnores` に `.open-next/**` と `.wrangler/**` を追加して 6件へ戻した。
あわせて `package.json` の末尾改行を復元した（migrate が落としていた）。

修正計画書は `docs/plans/tasks/task_003-fix.md` に、レビューの採否は `docs/takeover-plan.md` §7 の
ループに従って記録した。

### task_004a完了にあたっての付記（2026-08-14追記）

task_004（認証）は分量が大きいため **004a（認証コア）と 004b（ログイン画面・API・レート制限）に分割**した。
004a で作ったのは `lib/admin/auth.ts`（286行）と `proxy.ts`（68行）の2ファイルのみ。
暗号処理は Web Crypto（`crypto.subtle`）だけで書いてあり、Node 固有APIを使っていない。

3者レビュー（Opus / codex / gemini-3.5-flash）で採用した4件を同じコミットで修正した。
gemini-3.5-flash は指摘なし、codex が3件、Opus が1件:

- セッション payload の実行時検証が無く `exp` 判定が fail-open だった（major）→ `iat`/`exp`/`ver` を
  `Number.isSafeInteger()` で検証し、`exp > now` のときだけ通す形に変更
- 定数時間比較が短い方の長さまでしかループせず、コメントと実装が食い違っていた（minor）→ 32バイト固定に
- `proxy.ts` の `as unknown as NextResponse` という二重アサーション（minor）→ 戻り値型を
  `NextResponse | Response` にしてアサーションを削除
- 標準base64の `ADMIN_SESSION_SECRET` を base64url デコーダで復号していた（minor）→ `base64ToBytes` に修正

検証はすべて Opus がメインリポジトリで独立実行した。Cookie 無し=307 / 有効な署名Cookie=404（proxy を
通過し、ページ未実装のため404）/ 偽署名=307 / 期限切れ=307 / `exp` 欠落=307 / `exp` が文字列=307 /
公開面 `/tickets`=200。**有効な署名Cookie は Opus が `auth.ts` とは別実装で生成し、相互運用を確認した。**

`/admin/login` は現状404である（004b で作る）。修正計画書は `docs/plans/tasks/task_004a-fix.md`。

### task_004b完了にあたっての付記（2026-08-14追記）

作ったのは8ファイル（`lib/db.ts` / `lib/admin/rate-limit.ts` / `app/api/admin/{login,logout}/route.ts` /
`app/(admin)/` の layout・admin.css・login ページ2つ）。指示書は `docs/plans/tasks/task_004b.md`。

**指示書どおりに実装したらログイン画面のHTMLが空になり、実装担当が正しく停止した。** 原因は
`useSearchParams()` を静的プリレンダリング対象のページで使ったこと。HTML には
`<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING">` だけが入り、`<form>` が出ない。
**`next` クエリの読み取りをサーバ（`page.tsx` の `searchParams`）へ移して解決**した。
オープンリダイレクト検証もサーバ側へ移ったので防御としても素直になった。

検証は Opus が `next start` 上で独立実行した。**平文パスワードを持たない問題は、`scripts/hash-password.mjs`
で作った使い捨てパスワードのハッシュを `ADMIN_PASSWORD_PBKDF2` に環境変数で上書きして回避した**
（Node の `--env-file` は既存の環境変数を上書きしないことを実測して確認済み）。これにより
**正常系ログインまで含めて機械的に検証できた**:

- `GET /admin/login` 200・`<form>` と `type="password"` が各1件
- `next=https://evil.example` と `next=//evil.example` はどちらも採用されない
- CSRF: `x-aff-admin` 無し / `Content-Type: text/plain` / `Origin` 不一致 / body が非JSON / `password` 欠落 → すべて400。`Origin` 一致は通過して401
- レート制限: 1〜4回目 401、5回目 429 `{"error":"locked","retryAfter":900}`、ロック中は**正しいパスワードでも429**
- 正パスワード: 200 + `Set-Cookie: aff_admin=…; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=lax` + `Cache-Control: no-store`。成功で `login_attempts` の行が消える
- 発行された Cookie で `/admin` と `/api/admin/documents` が 404（proxy 通過。ページ未実装のため404）
- ログアウト: Cookie有り→200 + `aff_admin=; Max-Age=0`、CSRFヘッダ無し→400、Cookie無し→401（proxy が先に弾く）。失効後の `/admin` は307

#### task_004b の3者レビュー結果（2026-08-14。採否と根拠）

codex（`-s read-only` サンドボックス）と gemini-3.5-flash（scratchpad へ複製したソースに対して実行）を
並行させた。**gemini はレビュー環境の不備で有効な指摘ゼロ、codex が有効な指摘2件**（どちらも採用し修正）。

| 指摘 | 出所 | 採否 |
|---|---|---|
| **レート制限の失敗回数更新が非アトミック。** `SELECT failures` → `+1` → `UPDATE` の順で書いていたため、並行した誤パスワードリクエストが同じ値を読んで同じ値を書き戻し、失敗回数が失われてロックを回避できる | codex（major） | **採用・修正**。`INSERT … ON CONFLICT DO UPDATE SET failures = login_attempts.failures + 1, locked_until = CASE WHEN … END RETURNING failures` の1文に置き換えた |
| **DB のクエリ例外が fail-closed になっていない。** `checkRateLimit` / `recordLoginFailure` は接続不可（クライアントが `null`）だけを見ており、`execute()` が投げる例外は Route Handler まで伝播して 500 になる | codex（major） | **採用・修正**。両方を `try/catch` で包み、例外時は `{ locked: true }` を返すようにした。`clearLoginAttempts` は認証成立後の後始末なので例外を握りつぶす |
| logout が存在しない `@/lib/admin/session` を import しており、ビルド不能 | codex（blocker） | **却下（誤検出）。私のレビュー環境の不備**。レビュー用に複製したスナップショットに、task_004c で作業中だった logout の変更が混ざり、かつ `session.ts` を除外していたため、存在しない import に見えていた |
| ログインページが指示書どおり `useSearchParams` + `Suspense` になっていない | gemini（高） | **却下**。指示書のその設計が誤りで、静的プリレンダリングで `<form>` がHTMLに出ない問題を起こしていた。サーバ側で `searchParams` を読む形に直したのが正しい（§1 の task_004b 付記） |
| `lib/db.ts` が指示書の `@libsql/client/web` ではなく `/http` を使っている | gemini（低） | **却下（記録済み）**。workerd 向けバンドルが `@libsql/isomorphic-ws` を解決できない問題への対応で、意図的な変更。§9 に記録済み |

修正後に Opus が独立実測した結果:

| 確認 | 結果 |
|---|---|
| 逐次6回の誤パスワード | 1〜4回目 401 / 5・6回目 429。DBの `failures` = 5 |
| **並行10リクエスト** | 4本が401・6本が429。**DBの `failures` = 10**（1件も取りこぼしていない＝アトミック） |
| **`TURSO_AUTH_TOKEN` を無効値にした状態** | 誤パスワード・正パスワードとも **429**（500ではない＝fail-closed）。公開面 `/tickets` は 200 |
| `npx tsc --noEmit` / `npm run build` / `npm run verify:text` | 終了コード0 / 完全一致。lint は 6件のまま |

**`Secure` がローカルの http でも付く**点は仕様どおりでない可能性がある。実装は
`process.env.NODE_ENV === "production"` で分岐しているが、`next start` は NODE_ENV=production で動くため
ローカル検証でも `Secure` が付く（計画 §9.1 の「localhost の http 検証で Cookie が落ちる事故を避ける」
という意図は満たしていない）。ブラウザは http://localhost を secure context として扱うため実害は
出ない見込みだが、未確認である。

### task_010完了にあたっての付記（2026-08-14追記）

公開8ルートを Turso 読み出しへ切り替えた。`lib/content/load.ts` の `getDocument(key)` が
`content_documents` から読み、**取れない場合は同梱JSON（`lib/content/documents.ts`）へフォールバック**する
（DB未設定・行なし・例外・パース失敗の4条件。公開サイトは落とさない方針で、管理APIと違い fail-closed にしない）。
`react` の `cache()` で包んでいるので `generateMetadata` とページ本体で DB 往復は1回。
各ページは `export const dynamic = "force-dynamic"` + `async` 化し、`metadata` は `generateMetadata` にした。

**DB が本当に表示元であることを実測で証明した**（コードを読んだだけでは証明にならないため）:
DB の `tickets` の `head.title` を `OPUS_DB_PROOF` に書き換える → `/tickets` にその文字列が1件出現 →
元のバイト列へ戻す（復元後の文字列一致を確認）→ 出現0件。再ビルドなしで反映されるので
`force-dynamic` が効いていることも同時に確認できた。

**`npm run verify:text` の起動方法を変えた。** 公開ページが DB を読むようになったため、DB 未接続で
検証すると **index の画像 preload が1本消えて差分1件になる**（React が自動で出す resource hint で、
変換元HTMLには無いタグ。ヘッドのフラッシュ順が DB 往復の有無で変わるため出たり消えたりする）。
本番と同じ経路で検証するため、`scripts/verify-text.sh` は `.dev.vars` があれば読み込んで起動するようにした。
`.dev.vars` が無い環境ではフォールバック経路の検証になり、この preload 1件だけ差分が出る。

## 2. 検証の現状（毎コミットで確認しているもの）

```
npm run verify:text                                   → 完全一致: 8ルート / 要素1948個 / テキストノード1057個 / コメントノード0個
BASE_URL=http://localhost:8787 npm run verify:text    → 完全一致（OpenNext preview / workerd）
npx tsc --noEmit      → 終了コード 0
npm run lint          → 2 errors / 4 warnings（着手前と同じ。下記参照）
npm run build         → 終了コード 0
```

認証まわりの手動確認では、シークレットを画面に出さずに注入できる次の起動方法を使う（2026-08-14 に実測）。
`next start` は `.dev.vars` を読まないため、Node 22 の `--env-file` で渡す。`.dev.vars` は
`KEY=value` 形式5件（コメント1行）で、`ADMIN_PASSWORD_PBKDF2` に `$` を含むが `--env-file` は
シェル展開しないためそのまま渡る。

```
npm run build
node --env-file=.dev.vars node_modules/next/dist/bin/next start -p 3111
```

`npm run lint` は**着手前から終了コード1**である。エラー2件はいずれも
`components/SiteHeader.tsx`（本作業で未変更）にあり、うち1件は
`Addiction Int'l Film Festival` のアポストロフィで CLAUDE.md が文言変更を禁じている箇所。
そのため受け入れ条件は「lint が0」ではなく**「指摘が既存から増えていない」**とした
（`docs/implementation-plan.md` §14-1）。task_003 では一度 `.open-next/` / `.wrangler/` が
走査対象に入り 14873件（366 errors / 14507 warnings）へ増えたが、`eslint.config.mjs` の
`globalIgnores` 修正で 2 errors / 4 warnings に戻したことを確認済み（§1 付記参照）。

## 3. 作った検証の仕組み

`npm run verify:text` が、本番サーバ起動 → 8ルート取得 → 指紋抽出 → baseline 比較 → 停止を一括で行う。

- `scripts/snapshot.sh` … 8ルートのHTML取得
- `scripts/fingerprint.mjs` … parse5 でDOMを組み、要素ごとにルートからのパス（例 `3.0.1.1.0.2`）を振って
  タグ・全属性・直下の子ノード列（テキストは中身そのまま）を記録。`<head>` と `<!-- -->` の数も見る
- `verification/baseline/` … 着手前の8ルートのHTMLと指紋（コミット済み）

**検出力は実証済み。** 1文字変更（`3,000円`→`3,000圓`）はパス付きで特定でき、
`<strong>1日券</strong>` と `<strong>2日券</strong>` の中身を入れ替える変更
（出現回数・テキスト集合・class集合はすべて不変）も2件とも検出した。

`<!-- -->` の数を見ているのは、React SSR が隣接テキストノードの境界に
このコメントを挿入するため。現行8ページは0個なので、インライン表現を
データ駆動へ移したときに構造が変わると即座に増える。

## 4. 確定した設計判断

| 論点 | 決定 | 根拠 |
|---|---|---|
| ファイル規約 | ~~`middleware.ts` ではなく **`proxy.ts`**~~ → **入口の門番を置かない**（2026-08-14 変更） | Next 16 で `middleware.js` は廃止・改名。しかし Next 16 の proxy は Node ランタイム固定で、`@opennextjs/cloudflare` が Node middleware 非対応のため Cloudflare 向けビルドが落ちる。§9 を参照 |
| 認証の実行場所 | `proxy.ts` ではなく **各ページ・各APIハンドラの先頭**（`lib/admin/session.ts` を経由） | 上記に加え、Next の authentication ガイド1348-1354行が「レイアウトは遷移時に再レンダリングされず配下のレンダリングも止められないので、認証チェックはデータソースの近くで行う」と明記している |
| リッチテキスト | 許可タグ5種（`br`/`strong`/`em`/`b`/`span`/`link`）の **Inline AST** | `<em>`3件・`<b>`5件・文中 `<span class="small muted">`・文中リンクが実在。`<br>`+`<strong>` の2形式では足りない |
| レンダラ | JSX ではなく **`createElement`** で組む | JSX の行間改行がテキストノードに空白として混入する経路を避ける |
| seed の正典 | TSX の AST ではなく **実レンダリングHTML** | `app/(public)/page.tsx:38` に `&amp;` が直書きされており AST では二重エスケープになる。Films 04 の三項演算子も AST では分離できない |
| 配信方式 | **`force-dynamic`**（ISR・ビルド時取得は却下） | A/B実験で差分は index の画像preload 1本のみと実測。変換元HTMLに無いタグなので不変条件違反ではない |
| 公開/管理の分離 | **Route Group**（`app/(public)` / `app/(admin)`） | root layout が `/admin` にも公開ヘッダーを注入するため |
| 比較の定義 | 出現回数ではなく **DOMパスごとの値** | 出現回数比較は要素の入れ替えを検出できない |
| DBスキーマのバージョン管理 | `PRAGMA user_version` ではなく **`schema_migrations` テーブル** | 実測で判明: Turso の HTTP プロトコル（Hrana）は `PRAGMA user_version = N` の書き込みを拒否する（読み取りは可） |

## 5. 次にやること

コンテンツ駆動化（task_005〜008）・task_003（OpenNext / wrangler 導入）・task_004（認証、a と b の両方）が
完了した。task_004c（`proxy.ts` 廃止）と task_009残り（全11ドキュメントの投入）も終わったので、
**次の一手は task_010（公開ページの DB 読み出し切替）**。その次が task_011（manifest と編集網羅性の検証）:

- **task_010**: 公開ページの DB 読み出し切替。前提だった task_009残りは完了済み。
  切替後に `npm run verify:text` を8ルート全件で回し、DB 経由でも完全一致することを確認する
- **task_011**: manifest と `scripts/verify-coverage.mjs`。**着手前にドキュメントキーの命名を決着させる**
  （§7の3点目。実装済みの `scripts/db-seed.mjs` が使っている素のファイル名 `tickets` / `legal` に
  揃えるのが推奨。DB には既にその形で11件入っている）

いずれも着手時は `npm run verify:text` を**8ルート全件**で回し、diff が出たら
次に進まず直す。

## 6. 外部アカウントが要る作業（私の側では進められない）

**Turso** — 2026-08-13 に利用者が `turso auth login` を実行しログイン済み（アカウント `sawanori`、
starter プラン、rows read 上限 500M/月）。以降は私が CLI で自動化した:
`addiction-film-fes-dev` / `addiction-film-fes-prod`（東京リージョン）を作成し、
スキーマ適用、tickets/legal の投入と読み戻し検証まで完了。接続情報は
`.dev.vars`（dev用）と `.dev.vars.prod-reference`（prod用の控え）に保存済み（gitignore・chmod 600）。

**Cloudflare** — 導入済み・ログイン済み。2026-08-14 に利用者が `npx wrangler login` を実行し、Opus が
`npx --yes wrangler@latest whoami` で確認した（wrangler `4.123.0`、メール `snp.inc.info@gmail.com`、
Account ID `d4913e1ffe09be28e048105f883431d0`）。**ただし `wrangler.jsonc` が宣言する R2 バケット
`addiction-film-fes-nextapp-opennext-cache` は未作成のため、`npm run deploy` はまだ成立しない**
（ローカル preview は miniflare が代替するため通る）。task_014（本番反映）の前提条件として引き継ぐ。
あわせて、配信方式が `force-dynamic`（`docs/implementation-plan.md` §7.2）である以上、
R2 増分キャッシュが本当に要るのかを task_010 の時点で判断する必要がある。

**管理画面のパスワード** — 利用者が決める。平文は保存せず、
`scripts/hash-password.mjs`（コミット `190651e` で実装済み。従来この節を「未実装」と書いていたのは誤り）で
PBKDF2 ハッシュにしてから環境変数に入れる。`.dev.vars` の `ADMIN_PASSWORD_PBKDF2` は
**利用者が指示したパスワードから生成されたものであることを 2026-08-14 に本人が確認済み**
（形式は `pbkdf2-sha256$100000$<salt 16バイト>$<hash 32バイト>`）。
`ADMIN_SESSION_SECRET` は 32バイトの乱数（base64）。反復回数 100,000 が Cloudflare Workers の
CPU時間上限に収まるかは preview で実測して確かめる（計画 §9.1。形式に反復回数を埋めてあるため後から変更できる）。
**この実測は task_004b の手順に組み込んだ**（ログインAPIができて初めて測れるため）。

**2026-08-14: 利用者が使用するパスワードを指定し、`scripts/hash-password.mjs` で生成した
PBKDF2 ハッシュを `.dev.vars` の `ADMIN_PASSWORD_PBKDF2` に設定した**（反復回数100,000、
salt 16バイト、hash 32バイト。ファイルは `.gitignore` 済み・パーミッション 600）。
**平文はこのリポジトリのどこにも書かない。**

これにより、それまで私の側で実行できなかった「正しいパスワードで 200 + `Set-Cookie` が返る」の
確認が実測できるようになった。実測結果（環境変数の上書きなし＝実際の `.dev.vars` で起動）:
ログイン 200 + `Set-Cookie: aff_admin=…; Max-Age=43200; HttpOnly; SameSite=lax` /
その Cookie で `GET /api/admin/documents` が 200 / 誤パスワードは 401 / ログアウト 200。

**なお指定されたパスワードは辞書にある単語1語である。** レート制限はIP単位（5回で15分ロック）
なので分散IPからの総当たりには効かない。公開前に長く複雑なものへ変更することを勧めた（判断は利用者）。
本番反映（task_014）では `wrangler secret put` で別途設定する。

## 7. 未確認の前提

計画の一部は利用者への確認が取れていない。違っていれば計画から直す必要がある。

- **認証は編集者1名・単一パスワード**を前提にしている（複数ユーザー・権限管理は Non-Scope）
- **画像バイナリのアップロード（R2）はフェーズ2**として分離している。
  フェーズ1で編集できるのは画像の**パス文字列・alt・loading** まで。
  したがってフェーズ1完了時点では「全ての情報を網羅的に編集できる」は
  **テキストと画像参照については真、画像ファイル本体については偽**（`docs/implementation-plan.md` §5）
- **ドキュメントキーの命名がまだ未解決。** `docs/implementation-plan.md` §10.1 のドキュメント一覧表は
  `page.tickets` `page.legal` … と書いているが、実装済みの `scripts/db-seed.mjs` は `tickets` `legal` という
  素のファイル名をキーにしている。manifest（task_011）・管理API（task_012）の設計に影響するため、
  task_011 着手前にどちらへ揃えるかを決着させる必要がある

## 8. この作業で使ったモデル

- 計画の起草: kimi k3（`moonshot-ai/kimi-k3`）。1回目は読ませるファイルが多すぎて約40分でタイムアウトし
  何も書けずに落ちたため、機械抽出した目録（`docs/content-inventory.md`）を先に渡して読み込み量を減らし再実行した
- 敵対的レビュー: codex（`docs/reviews/codex-review.md`）と gemini（`docs/reviews/gemini-review.md`）。
  gemini は MCP 経由が backend 未導入で失敗したため CLI を直接実行した
- 採否の裁定と実装: Claude（`docs/reviews/review-verdict.md`）

**2026-08-14以降の体制**: Opus が現状把握・設計・検証、Sonnet が計画書執筆
（`docs/takeover-plan.md`、`docs/plans/tasks/*.md`）、haiku が実装、という分業に切り替えた。
実装完了後の品質チェックは Opus / codex（`codex-cli 0.139.0`）/ gemini（CLI `0.38.1`、
モデルは `gemini-3.5-flash`。`gemini-3.5-pro` と `gemini-3-pro` は404で存在しない）の3者で行う
（`docs/takeover-plan.md` §7）。


## 9. Cloudflare へデプロイできない問題（task_004b で判明 → task_004c で解消。2026-08-14）

**解消済み。** `proxy.ts` を廃止し、認証を `lib/admin/session.ts`（DAL）経由で各APIハンドラの先頭に
移した結果、`npx opennextjs-cloudflare build` が終了コード0に戻り、workerd 上で公開8ルートが
baseline と完全一致することも再確認した（下の「task_004c の実測」参照）。以下は経緯の記録。

**`proxy.ts` を置いたままでは `opennextjs-cloudflare build` が失敗する。** 実測した事実だけを書く。

```
ERROR Node.js middleware is not currently supported. Consider switching to Edge Middleware.
（npx opennextjs-cloudflare build → 終了コード1）
```

- 原因は Next 16 の仕様変更。`node_modules/next/dist/docs/.../proxy.md` の221-223行に
  **「Proxy は Node.js ランタイムが既定。`runtime` 設定は Proxy では使えず、指定するとエラーになる」**、
  774行の変更履歴に「v16.0.0 Middleware は非推奨となり Proxy へ改名。Proxy は Node.js ランタイムが既定」
  と明記されている。**つまり Next 16 では proxy を edge ランタイムで動かす手段が無い。**
- `@opennextjs/cloudflare` 側は `dist/cli/build/utils/middleware.js` で
  `functions-config-manifest.json` の `/_middleware` を見て Node middleware を検出し、
  `build.js:67` で `process.exit(1)` する。ソースにも「Node middleware are not supported on
  Cloudflare yet」とコメントがある。**`npm view @opennextjs/cloudflare dist-tags` は `latest: 1.20.2` で、
  導入済みの版が最新。バージョンを上げて解決する道は現時点で無い。**
- `middleware.ts` へ戻す案も無効。`middleware.md` は「All functionality remains the same — only the
  file and export names have changed」と書いており、v16 では規約名が違うだけで同じく Node ランタイムになる。

### 対応方針（2026-08-14 決定・利用者の判断）

**`proxy.ts` を廃止し、認証を app 層（各ページと各 `/api/admin/*` ハンドラの先頭）で行う。**
Cloudflare は継続する。計画 §9 は元々「API ハンドラ側でも同一検証を行う（defense in depth）」と
決めているため、二重化のうち CDN 側を落とす形になる。実装は task_004c。

Next の authentication ガイドもこの形を推奨している。1119行に「Proxy は最初の足切りには使えるが、
唯一の防衛線にしてはいけない。大半のチェックはデータソースの近くで行うこと」、1348-1354行に
**「レイアウトは遷移時に再レンダリングされず、配下のレンダリングを止めることもできないので、
認証チェックはレイアウトではなくデータソースの近く、または条件付きで描画するコンポーネントで行う」**
とある。したがって `app/(admin)/layout.tsx` に検証を置く案は採らない。

**残る弱点**: 新しい管理ページやAPIを足したときに検証の呼び出しを忘れうる。task_013 で機械チェックの
導入を検討する。

### 却下した代替案: Next 15 へのダウングレード（実験して却下）

「Next 15 なら middleware が Edge ランタイム既定なので Cloudflare に載るのでは」という案を、
実験ブランチ `experiment/next15`（コミット `8b646b1`）で**実際に測って**判断した。

| 確認 | 結果 |
|---|---|
| `next` / `eslint-config-next` を 15.5.23 へ（OpenNext の peer は `>=15.5.21 <16` を許容） | 導入できた |
| `npx tsc --noEmit` / `npm run build` | 終了コード0。ビルド出力に `ƒ Middleware 34.6 kB` |
| `npx opennextjs-cloudflare build` | **終了コード0**（`Bundling middleware function...` → `OpenNext build complete.`） |
| `opennextjs-cloudflare preview`（workerd, :8787） | `/admin` が 307 → `/admin/login?next=%2Fadmin`、`/api/admin/documents` 401、`/admin/login` 200（form 1件）、誤パスワードの login API 401。**Cloudflare 上で門番が実際に効く** |
| `npm run verify:text` | **145件の差分で失敗** |
| `npm run lint` | **実行不能**（`eslint.config.mjs` が import する `eslint-config-next/core-web-vitals` が15系に無い） |

**却下の理由は `verify:text` の145件。** 表示された60件の内訳は `<script>` の増加36件・`<head>` の
link 18件・React のコメントマーカー 4→5 が3件・`<body>` 直下の子ノード列3件で、いずれも
フレームワークが吐くタグであり、可視テキストと class の差分は表示分には無かった
（残り85件は出力が打ち切られており未確認）。それでも baseline の取り直しが必要になり、
**「移植で見た目を1文字も変えていない」ことの機械的な証明が一度リセットされる**。
この安全網を失うことを避けた。あわせて、将来 Next 16 へ上げるときに同じ壁へ戻る点も理由。

実験ブランチは記録として残す（main へはマージしない）。

### task_004c の実測（Opus が独立実行。実装担当の自己申告は使っていない）

| 確認 | 結果 |
|---|---|
| `npx tsc --noEmit` / `npm run build` | 終了コード0 |
| `npm run lint` | `✖ 6 problems (2 errors, 4 warnings)`（着手前と同一） |
| `npm run verify:text` | 完全一致（8ルート / 要素1948個 / テキストノード1057個） |
| `test ! -f proxy.ts && test ! -f middleware.ts` | 終了コード0 |
| **`npx opennextjs-cloudflare build`** | **終了コード0**（`OpenNext build complete.`） |
| preview（workerd, :8787）で `BASE_URL=... npm run verify:text` | **完全一致** |
| preview: `/tickets` 200 / `/admin` 404 / `/admin/login` 200 / login 誤PW 401 / logout Cookie無し 401 | すべて期待どおり |

`next start` 上では、実装担当には実行できない次の検証も行った（使い捨てパスワードのハッシュで
`ADMIN_PASSWORD_PBKDF2` を環境変数から上書きし、署名付きCookieは `auth.ts` とは別実装で生成した）:

| 確認 | 結果 |
|---|---|
| 正しいパスワードでログイン | 200 + `Set-Cookie: aff_admin=…; Max-Age=43200; HttpOnly; SameSite=lax` |
| そのCookieでログアウト | 200 + `aff_admin=; Max-Age=0` + `Cache-Control: no-store` |
| **`ver` を 999 にした署名付きCookie（DBは1）** | **401**（`session_version` の DB 照合が実際に効いている） |
| 期限切れの署名付きCookie | 401 |
| 別実装で署名した有効Cookie | 200（`auth.ts` との相互運用を確認） |
| 署名が壊れたCookie | 401 |
| Cookie無しのログアウト | 401（`proxy.ts` ではなくハンドラ自身が返す） |
| CSRFヘッダ無しのログアウト | 400 |

**観測しておく点**: preview 上の初回ログインPOSTが 3.13秒かかった（コールドスタート込み。
task_004b 時点の実測は 初回0.467s / 2回目0.071s だった）。PBKDF2 の反復回数を判断する材料としては
コールドスタートの影響を分離する必要がある。

### 併せて判明した2件（どちらも実測）

1. **`@libsql/client` を workerd 向けにバンドルすると解決に失敗する。**
   `Could not resolve "@libsql/isomorphic-ws"` … Next の standalone 出力が同パッケージの
   `node.mjs` しかコピーせず、esbuild が workerd 条件の `web.mjs` を探して失敗する。
   `next.config.ts` に次を足すとビルドが通ることを実測した（proxy.ts を外した状態で終了コード0）:
   `outputFileTracingIncludes: { "**": ["./node_modules/@libsql/isomorphic-ws/web.mjs"] }`。
   あわせて `lib/db.ts` は `@libsql/client/web` ではなく **`/http`** を使う（WebSocket を一切参照しない。
   `libsql://` URL のまま `execute` と `batch` が動くことを Node で実測済み）。
2. **PBKDF2 100,000回のコストは実測 約8.1ms（Node / V8、5回中央値）。**
   workerd（`opennextjs-cloudflare preview`、proxy.ts を外してビルドしたもの）でのログイン1回の
   往復は 初回 0.467s / 2回目 0.071s / 3回目 0.054s（Turso 東京への往復2回を含む）。
   CSRF で弾く経路は 0.004s。**Cloudflare の CPU 時間上限に収まるかは契約プランに依存する**ため、
   task_014 でプランを確認する。反復回数はハッシュ文字列に埋め込んであるので後から変更できる。

---

## 10. task_014（本番反映）— 完了

**2026-08-14 に利用者の承認を得てデプロイした。** 以下は準備内容と、デプロイ後に実測した結果。

### 準備済み（Opus が実施・実測）

| 項目 | 状態 |
|---|---|
| 本番 Turso DB（`addiction-film-fes-prod`）へのスキーマ適用 | 済（`schema_migrations` 1行 / `admin_settings` 1行） |
| 本番 DB への全11ドキュメント投入 | **済**。読み戻し検証（deep-equal + コードポイント一致）11件すべて ok |
| R2 バケット依存の除去 | **済**。公開ページが全ルート `force-dynamic` で ISR を使わないため、`open-next.config.ts` の `r2IncrementalCache` と `wrangler.jsonc` の `r2_buckets` / `WORKER_SELF_REFERENCE` を外した。**未作成だった R2 バケットが不要になり、デプロイの前提条件がひとつ消えた** |
| 除去後の再検証 | `npx opennextjs-cloudflare build` 終了コード0 / preview（workerd）で `verify:text` 完全一致 / `/admin` は307 / `/admin/login` は200 |
| 本番用シークレットの用意 | `.dev.vars.prod-reference`（gitignore・600）に `ADMIN_PASSWORD_PBKDF2`（**dev とは別の salt で生成**）と `ADMIN_SESSION_SECRET`（32バイト乱数・dev とは別値）を記録済み |

### 実行前に利用者が決めること

1. **公開してよいか。** 掲載情報は全て仮置き（`PLACEHOLDERS.md`）。会期・料金・登壇者・応募要項・連絡先は確定した事実ではない。
   検索結果には出ない（`app/layout.tsx` の `metadata.robots` が `noindex, nofollow, noarchive`）が、
   **URLを知っていれば誰でも閲覧できる**状態になる。
2. **パスワードを変更するか。** 現在の値は辞書にある単語1語。レート制限はIP単位なので分散IPの総当たりには効かない。
3. **費用。** Workers の無料枠を超える場合の課金と、Turso の rows read 上限（starter プラン 500M/月）。

### 実行する場合の手順（未実行）

```bash
npm run deploy                    # opennextjs-cloudflare build && deploy
# デプロイでWorkerが作られたあとにシークレットを入れる（値は .dev.vars.prod-reference から）
npx wrangler secret put TURSO_DATABASE_URL
npx wrangler secret put TURSO_AUTH_TOKEN
npx wrangler secret put ADMIN_PASSWORD_PBKDF2
npx wrangler secret put ADMIN_SESSION_SECRET
npm run deploy                    # シークレット反映後にもう一度
```

**シークレットを入れる前の状態でも公開ページは表示される**（`lib/content/load.ts` が同梱JSONへ
フォールバックする）。管理画面は `ADMIN_PASSWORD_PBKDF2` が無いと 500 を返して誰も入れない（fail-closed）。

### 実行後に確認すること

- 公開8ルートが 200 で、`BASE_URL=<本番URL> npm run verify:text` が完全一致
- `/admin` が 307 で `/admin/login` へ、`/admin/login` が 200
- 実際のパスワードでログインでき、ダッシュボードに11件出る
- PBKDF2 100,000回が Cloudflare のCPU時間上限に収まるか（プラン依存。§9の実測値を参照）

### デプロイの実行結果（2026-08-14。すべて Opus が実測）

```
npm run deploy                     → 終了コード0
  Worker: addiction-film-fes-nextapp
  URL:    https://addiction-film-fes-nextapp.snp-inc-info.workers.dev
  Worker Startup Time: 33 ms / Total Upload: 6012.19 KiB (gzip 1221.06 KiB)
  バインディング: env.IMAGES（Images）/ env.ASSETS（Assets）※ R2 は外したので無し
npx wrangler secret put ×4         → 4件とも成功。wrangler secret list で
  ADMIN_PASSWORD_PBKDF2 / ADMIN_SESSION_SECRET / TURSO_AUTH_TOKEN / TURSO_DATABASE_URL を確認
```

**シークレット投入後の再デプロイは不要だった**（Workers のシークレットは即時反映され、
投入直後のリクエストで既に有効だったことを実測で確認した。§10 の手順に書いていた
「再デプロイ」は実際には不要）。

| 確認 | 結果 |
|---|---|
| 公開8ルート | すべて 200（0.10〜0.80秒） |
| **`BASE_URL=<本番URL> npm run verify:text`** | **完全一致: 8ルート / 要素1948個 / テキストノード1057個 / コメントノード0個** |
| `<meta name="robots">` | `noindex, nofollow, noarchive`（検索結果には出ない） |
| 本番DB経由の表示 | `/tickets` に `1日券` が出る（同梱JSONへのフォールバックではなくDB読み出し） |
| `/admin`（未認証） | 307 → `/admin/login?next=%2Fadmin` |
| `/api/admin/documents`（未認証） | 401 |
| 実際のパスワードでログイン | 200 + `Set-Cookie: aff_admin=…; Max-Age=43200; Secure; HttpOnly; SameSite=lax` |
| ダッシュボード / 編集画面 | 200。編集リンク11本、管理API一覧11件 |
| 誤パスワード / ログアウト | 401 / 200 |
| **PBKDF2 100,000回の本番実測** | ログインAPIの往復が 0.63s（初回）→ 0.20s → 0.11s。PBKDF2 を通らない CSRF 拒否は 0.047s、公開ページは 0.15s。**CPU時間上限による失敗は起きていない**（プランの上限に収まっている） |

検証で使った `login_attempts` の行は本番DBから削除済み（0行）。

### 公開後に残っている宿題

- **掲載情報はすべて仮置き**（`PLACEHOLDERS.md`）。会期・料金・登壇者・応募要項・連絡先は確定した事実ではない
- **パスワードが辞書語1語**。公開URLを知られた状態なので、長く複雑なものへの変更を勧める
  （変更手順: `scripts/hash-password.mjs` でハッシュを作り `npx wrangler secret put ADMIN_PASSWORD_PBKDF2`）
- `public/sitemap.xml` のドメインが `https://example.jp/` のまま。正式公開時に差し替える
- 独自ドメインは未設定（`*.workers.dev` のまま）
- 画像ファイル本体のアップロード（R2）はフェーズ2。いま編集できるのはパス文字列・alt・loading まで


---

## 11. 公開後に見つかった不具合と修正（2026-08-14）

**利用者から「管理画面からTOPページを見ようとしたら This page couldn't load と出る」と報告があった。**
再現・原因特定・修正まで実施した。

### 現象

`/admin/docs/index`（トップページの編集画面）が **500** を返していた。同じく `films` と `terms` も 500。
他の8ドキュメントは 200 だった。公開ページ側は無関係で、常に 200 を返していた。

ローカルの `next start` で再現し、サーバログに次のスタックが出た:

```
⨯ TypeError: Cannot read properties of undefined (reading 'map')
    at ... app_(admin)_admin_docs_[key]_DocumentEditor_tsx ...
```

### 原因

**`t` というキーを「リッチテキストのタグ名」だと決めつけていた。** 実データでは `t` を
普通の項目名としても使っている:

| 場所 | `t` の意味 |
|---|---|
| `films.items[].t` | 作品タイトル（例 `"Bill W."`） |
| `index.quick.cards[].t` | カードの見出し（例 `"Tickets"`） |
| `programme.cta.t` | 本文 |
| `terms` の `blocks[]` | `{"t":"p","value":[…]}` というブロック種別 |

`lib/content/manifest-core.ts` の `hasMarkupNode()` は「配列の要素に `t` を持つオブジェクトがあれば
inline」という判定だったため、これらを inline と誤認していた。編集画面の `InlineEditor` は
inline ノードとして `node.c.map(...)` を呼ぶが、これらのオブジェクトに `c` は無いので落ちた。

### 修正

1. `hasMarkupNode()` を厳密化した。**タグ名が許可5種（br/strong/em/b/span/link）であること**、
   **`br` 以外は子ノード配列 `c` を持つこと**、**配列全体が文字列か inline ノードだけで
   構成されていること**の3つを満たす場合のみ inline と判定する。
2. `InlineEditor` の `nodeText()` を防御的にした（`c` が無くても落とさず空文字にする）。

### この不具合が隠していたもの（重要）

**誤検出された inline パスの配下は、網羅性検証で「inline がまとめて受け持つ」として
カバー済みに数えられていた。** つまり `films` / `index` / `terms` の一部の項目は、
**実際には編集画面に出ていないのにカバー済みと計上されていた**。修正後、実フィールド数は
次のように増えた:

| ドキュメント | 修正前のフィールド数 | 修正後 |
|---|---|---|
| `films` | 1 | **12** |
| `index` | 65 | **87** |
| `terms` | 10 | **13** |

リーフ1078件すべてが manifest に対応しているという結果自体は修正前後で変わらないが、
**修正前の「1078件すべて編集可能」は上記のぶん過大な主張だった**。この記録を残す。

### 修正後の実測

| 確認 | 結果 |
|---|---|
| ローカル: 全11ドキュメントの編集画面 | すべて 200。サーバログのエラー0件 |
| ローカル: `terms` / `films` / `index` の保存往復 | PUT 200 → revert 200 → `content/*.json` と JSON 文字列レベルで一致。`films` の編集は公開ページ `/programme` に反映されることも確認 |
| `npm run verify:text` / `verify:coverage` / `lint` | 完全一致 / 1078件OK / 6件（着手前と同一） |
| 本番: 全11ドキュメントの編集画面 | すべて 200（`films` / `index` は3回ずつ再確認して 0.08〜0.17秒） |
| 本番: 公開8ルート | `BASE_URL=<本番URL> npm run verify:text` が完全一致 |

**なおデプロイ直後の1回目の確認では `films` / `index` がまだ 500 を返した。** 数秒後に再確認すると
200 になり、`wrangler tail` でもエラーは記録されていなかった。デプロイの伝播中に古い版へ
到達したものと判断している（確証は取れていない。デプロイ直後の確認は少し待ってから行うこと）。

---

## 12. 管理画面の作り直し（2026-08-14）

利用者から「シンプルすぎる。素人でも説明書なしで分かるように、もう少し洗練されたスタイルに」と
依頼を受けて作り直した。

### 何が問題だったか（作り直し前）

- **項目名が生のキー名だった。** `d` / `k` / `en` / `t` / `no` のような英字1〜2文字が並び、
  何を入れる欄なのか説明書なしには分からなかった（実測で128種類のキーが露出していた）
- 配列の項目が「#1 #2 #3」としか出ず、**どれがどの作品・どの行なのか分からなかった**
- 全項目が1枚の長いフォームに展開されていた（トップページは87項目）
- 見た目が素のHTMLに近く、保存ボタンの位置も分かりにくかった

### やったこと

1. **全項目に日本語の名前と補足説明を付けた。** `lib/content/manifest-core.ts` に
   正規化パス優先・キー名フォールバックの2段構えの辞書を置いた。
   例: `films.items[].k` →「ジャンル・上映時間（例: Documentary ・ 104min）」、
   `items[].lead` →「大きく表示する（オンにするとカードが1枚分大きくなります）」。
   **生のキー名のまま残る項目は0件**であることを機械的に確認した
2. **配列の項目に中身から作った見出しを出す。** 作品なら作品名、スライドなら画像の説明文が
   一覧に並ぶので、目当ての項目をすぐ見つけられる
3. **文字だけの配列は1行1入力**に変えた（従来は見出しと入力欄が二重に出ていた）
4. セクションを折りたたみ式のカードにし、上部に**固定の保存バー**（未保存の変更あり表示つき）を置いた。
   保存し忘れてページを離れようとすると確認ダイアログが出る
5. 一覧をカード表示にし、**そのドキュメントを直すとどこが変わるか**の説明文を付けた
6. 配色を映画祭の版（葡萄 `#5b2f3a`・生成り `#ede3d4`・墨）に揃えた。
   `app/globals.css` には1行も足していない（全セレクタが `.adm` 配下）
7. リッチテキスト編集を「文章 / 改行 / 太字 / リンク」の日本語表記にし、
   組み上がりのプレビューを上に出すようにした

### 自分で見た目を確認した

ヘッドレス Chrome でスクリーンショットを撮り、Opus が実際に画像を見て確認した
（HTMLの diff だけでは「見た目が整っているか」を判断できないため）。
その結果、**コード上は正しいのに画面では読めない不具合を1件見つけて直した**:
`.adm a { color: … }` が `.adm__button` より詳細度が高く、リンクを兼ねた「編集する」ボタンの
文字が背景と同じ葡萄色になって消えていた（`.adm a:not([class])` に変更）。

### 検証

| 確認 | 結果 |
|---|---|
| 全11ドキュメントの編集画面（ローカル / 本番） | すべて 200 |
| 保存の往復（`index` の文字配列を含む） | PUT 200 → 公開トップに反映 → revert 200 → `content/index.json` と一致 |
| `npm run verify:text`（ローカル / 本番） | どちらも完全一致 |
| `npm run verify:coverage` | 1078件すべて対応（変わらず） |
| `npm run lint` | 6件（着手前と同一） |


### 長いドキュメントの見通しを直した（2026-08-14 追記）

利用者から「トップページは項目が87個あって縦に長いままで分かりづらい」と指摘を受けた。
全項目を1枚のフォームに並べる形をやめ、**左に目次を置いて、選んだ部分だけを表示する**形にした。

- 目次には各セクションの名前と規模（`ファーストビュー 13項目` / `上映作品 6件`）を出す
- **直したセクションには印（●）が付く**ので、長いドキュメントでもどこを触ったか分かる
- 選択中のセクションだけを右側に表示する。状態は親（DocumentEditor）が持っているので、
  セクションを切り替えても入力内容は消えず、保存は**ドキュメント全体をまとめて**送る
- 最上位のセクションは折りたたみ（`<details>`）をやめてカード見出しにした
  （1つだけ表示される画面で折りたためると、閉じたときに何も見えなくなるため）
- 画面幅860px以下では目次が横並びのボタン列になる

トップページの場合、12セクション（ページ設定 / ファーストビュー / 3つの案内カード /
ステートメント / 取り組み / 上映作品 / 開催形式 / ナビゲーター紹介 / お知らせ / 宣言文 /
行動をうながす部分 / メール登録欄）に分かれ、1画面に出るのは選んだ1つだけになった。
