# /admin 管理画面：進捗記録

最終更新: 2026-08-13 / ブランチ `main` / 最新コミット `e2466cc`

計画の全体像は `docs/implementation-plan.md`、タスク定義は `docs/task-list.json`、
受け入れ条件は `docs/acceptance-checks.json`、レビューの採否は `docs/reviews/review-verdict.md` にある。
この文書は「いま何が終わっていて、次に何をすればよいか」だけを書く。

---

## 1. 現在地

公開8ページのうち **task_006対象の6ページ（tickets / legal / terms / privacy / news / about）が
コンテンツ駆動化済み**。残る index / programme（task_007）と SiteHeader/SiteFooter（task_008）は未着手。
Turso の dev/prod DB は作成・スキーマ適用・2ドキュメント（tickets/legal）の投入まで完了（terms以降は未投入）。
認証・管理UI・Cloudflareデプロイは未着手。公開サイトの見た目と文言は**1文字も変わっていない**。

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
| task_003 OpenNext / wrangler 導入 | 未着手（要 `wrangler login`） | — |
| task_004 認証（proxy.ts + PBKDF2 + 署名Cookie） | 未着手 | — |
| task_007 index / programme + 共有コンポーネント | 未着手 | — |
| task_008 SiteHeader / SiteFooter | 未着手 | — |
| task_010 公開ページのDB読み出し切替 | 未着手 | — |
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

## 2. 検証の現状（毎コミットで確認しているもの）

```
npm run verify:text   → 完全一致: 8ルート / 要素1948個 / テキストノード1057個 / コメントノード0個
npx tsc --noEmit      → 終了コード 0
npm run lint          → 2 errors / 4 warnings（着手前と同じ。下記参照）
npm run build         → 終了コード 0
```

`npm run lint` は**着手前から終了コード1**である。エラー2件はいずれも
`components/SiteHeader.tsx`（本作業で未変更）にあり、うち1件は
`Addiction Int'l Film Festival` のアポストロフィで CLAUDE.md が文言変更を禁じている箇所。
そのため受け入れ条件は「lint が0」ではなく**「指摘が既存から増えていない」**とした
（`docs/implementation-plan.md` §14-1）。

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

## 5. 次にやること（この順で）

1. ~~`app/(public)/privacy/page.tsx`~~ — 完了（`e6b7908`）
2. ~~`app/(public)/terms/page.tsx`~~ — 完了（`e6b7908`）
3. ~~`app/(public)/news/page.tsx`~~ — 完了（`e6b7908`）
4. ~~`app/(public)/about/page.tsx`~~ — 完了（`e2466cc`）
5. `app/(public)/page.tsx` + `app/(public)/programme/page.tsx` + `Films` / `Timetable` / `Hero` / `NewsletterForm`
   （Films が index と programme をまたぐため**分割不可。1ステップでやる**）← 次はここ
6. `SiteHeader` / `SiteFooter`（`site` ドキュメント。全ページ影響のため最後）

各ページを直すたびに `npm run verify:text` を**8ルート全件**で回す。
diff が出たら次に進まず直す。

進め方は tickets / legal と同じ:

- `lib/content/types.ts` にそのページのドキュメント型を足す
- `content/<page>.json` に現在の値を書く
- `lib/content/documents.ts` に読み込み口を足す
- `app/(public)/<page>/page.tsx` を JSON 参照に書き換える

## 6. 外部アカウントが要る作業（私の側では進められない）

**Turso** — 2026-08-13 に利用者が `turso auth login` を実行しログイン済み（アカウント `sawanori`、
starter プラン、rows read 上限 500M/月）。以降は私が CLI で自動化した:
`addiction-film-fes-dev` / `addiction-film-fes-prod`（東京リージョン）を作成し、
スキーマ適用、tickets/legal の投入と読み戻し検証まで完了。接続情報は
`.dev.vars`（dev用）と `.dev.vars.prod-reference`（prod用の控え）に保存済み（gitignore・chmod 600）。

**Cloudflare** — `wrangler` は未導入。`npx wrangler login` がブラウザ認証のため利用者本人の操作が要る。
これが済むと OpenNext 導入（task_003）と本番デプロイ（task_014）に進める。

**管理画面のパスワード** — 利用者が決める。平文は保存せず、
`scripts/hash-password.mjs`（未実装）で PBKDF2 ハッシュにしてから環境変数に入れる。

## 7. 未確認の前提

計画の一部は利用者への確認が取れていない。違っていれば計画から直す必要がある。

- **認証は編集者1名・単一パスワード**を前提にしている（複数ユーザー・権限管理は Non-Scope）
- **画像バイナリのアップロード（R2）はフェーズ2**として分離している。
  フェーズ1で編集できるのは画像の**パス文字列・alt・loading** まで。
  したがってフェーズ1完了時点では「全ての情報を網羅的に編集できる」は
  **テキストと画像参照については真、画像ファイル本体については偽**（`docs/implementation-plan.md` §5）

## 8. この作業で使ったモデル

- 計画の起草: kimi k3（`moonshot-ai/kimi-k3`）。1回目は読ませるファイルが多すぎて約40分でタイムアウトし
  何も書けずに落ちたため、機械抽出した目録（`docs/content-inventory.md`）を先に渡して読み込み量を減らし再実行した
- 敵対的レビュー: codex（`docs/reviews/codex-review.md`）と gemini（`docs/reviews/gemini-review.md`）。
  gemini は MCP 経由が backend 未導入で失敗したため CLI を直接実行した
- 採否の裁定と実装: Claude（`docs/reviews/review-verdict.md`）
