# /admin 管理画面：進捗記録

最終更新: 2026-08-14 / ブランチ `main` / 最新コミット `cbf8198`

計画の全体像は `docs/implementation-plan.md`、タスク定義は `docs/task-list.json`、
受け入れ条件は `docs/acceptance-checks.json`、レビューの採否は `docs/reviews/review-verdict.md` にある。
この文書は「いま何が終わっていて、次に何をすればよいか」だけを書く。

---

## 1. 現在地

**公開8ページ全ページ + 共有ヘッダー/フッターのコンテンツ駆動化が完了**（task_005〜008）。
Turso の dev/prod DB は作成・スキーマ適用・2ドキュメント（tickets/legal）の投入まで完了
（残り9ドキュメントは未投入。task_010着手前に投入が要る。内訳は §5）。
**task_003（OpenNext / wrangler 導入）も完了し、Cloudflare Workers 上（OpenNext preview / workerd）でも
公開8ルートが baseline と完全一致することを実測済み。**
認証・管理UI・本番デプロイは未着手。公開サイトの見た目と文言は**1文字も変わっていない**。

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
| task_004 認証（proxy.ts + PBKDF2 + 署名Cookie） | 未着手 | — |
| task_010 公開ページのDB読み出し切替 | 未着手（要: terms/privacy/news/about/index/programme/site の投入） | — |
| task_011 manifest + 編集網羅性の検証 | 未着手 | — |
| task_012 管理API | 未着手 | — |
| task_013 管理画面UI | 未着手 | — |
| task_014 本番反映 | 未着手（要 `wrangler login`） | — |

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

## 2. 検証の現状（毎コミットで確認しているもの）

```
npm run verify:text                                   → 完全一致: 8ルート / 要素1948個 / テキストノード1057個 / コメントノード0個
BASE_URL=http://localhost:8787 npm run verify:text    → 完全一致（OpenNext preview / workerd）
npx tsc --noEmit      → 終了コード 0
npm run lint          → 2 errors / 4 warnings（着手前と同じ。下記参照）
npm run build         → 終了コード 0
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
| ファイル規約 | `middleware.ts` ではなく **`proxy.ts`** | Next 16 で `middleware.js` は廃止・改名（`node_modules/next/dist/docs/` で確認） |
| リッチテキスト | 許可タグ5種（`br`/`strong`/`em`/`b`/`span`/`link`）の **Inline AST** | `<em>`3件・`<b>`5件・文中 `<span class="small muted">`・文中リンクが実在。`<br>`+`<strong>` の2形式では足りない |
| レンダラ | JSX ではなく **`createElement`** で組む | JSX の行間改行がテキストノードに空白として混入する経路を避ける |
| seed の正典 | TSX の AST ではなく **実レンダリングHTML** | `app/(public)/page.tsx:38` に `&amp;` が直書きされており AST では二重エスケープになる。Films 04 の三項演算子も AST では分離できない |
| 配信方式 | **`force-dynamic`**（ISR・ビルド時取得は却下） | A/B実験で差分は index の画像preload 1本のみと実測。変換元HTMLに無いタグなので不変条件違反ではない |
| 公開/管理の分離 | **Route Group**（`app/(public)` / `app/(admin)`） | root layout が `/admin` にも公開ヘッダーを注入するため |
| 比較の定義 | 出現回数ではなく **DOMパスごとの値** | 出現回数比較は要素の入れ替えを検出できない |
| DBスキーマのバージョン管理 | `PRAGMA user_version` ではなく **`schema_migrations` テーブル** | 実測で判明: Turso の HTTP プロトコル（Hrana）は `PRAGMA user_version = N` の書き込みを拒否する（読み取りは可） |

## 5. 次にやること

コンテンツ駆動化（task_005〜008）と task_003（OpenNext / wrangler 導入）が完了した。次の候補は次の3つ:

- **task_004**: 認証基盤（`proxy.ts` + PBKDF2 + 署名Cookie + レート制限）。task_003 完了により着手可能になった
- **task_009残り**: `content/` の未投入9件（`about` / `films` / `index` / `news` / `privacy` / `programme` /
  `site` / `terms` / `timetable`）を Turso へ投入する。**従来「7件」と書いていたのは誤りで、
  `films` と `timetable` が漏れていた。** task_010の前提
- **task_010**: 公開ページの DB 読み出し切替。task_009残りの完了が前提

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
