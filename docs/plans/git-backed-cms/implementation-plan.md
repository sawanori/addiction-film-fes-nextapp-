# Implementation Plan: 保存先を Turso から GitHub リポジトリへ移す（Git を DB にする CMS 化）

> **配置について**: このリポジトリの `docs/implementation-plan.md` / `docs/task-list.json` /
> `docs/acceptance-checks.json` は **/admin 管理画面構築（v2）の正典**で、コード注釈から
> 「計画 §5」「§8.4」「§9.1」「§9.2」として参照されている（`lib/content/manifest-core.ts`、
> `lib/admin/ops.ts`、`app/api/admin/login/route.ts` ほか）。上書きすると参照が壊れるため、
> 後続案件は `docs/plans/trailer-admin/` と同じ流儀で**別名・別ディレクトリ**に置く。
> 本計画一式は `docs/plans/git-backed-cms/` に置く。

> **版**: v2（2026-09-03）
> v1（Opus 執筆）を Fable 5.1 が敵対的にレビューし、指摘の採否を §16 に記録したうえで
> 全面改訂した。前提コミット: `63ac3f5`。
>
> **v1 からの主な変更**（いずれも本セッションの実測に基づく）:
> 1. **baseline の再生成をやめた。** v1 は「Git 化すると `/` の画像 preload が1件消える差分が
>    恒久的に出るので baseline を作り直す」と断定していたが、`force-dynamic` を外して
>    静的生成した出力は**現在の baseline と完全一致**した（§3.5）。
> 2. **Vercel Hobby は「アカウント所有者のコミット」しかデプロイを起動しない**という制約を
>    設計と手順に入れた（§7.6）。v1 の A6「先方が PAT を持たなければ制作側が発行して渡す」は
>    この制約で破綻するため撤回した。
> 3. **JSON の整形が可逆でない**（11ファイル中9ファイル）ことが分かったので、移行の最初に
>    整形を正規化するコミットを入れる（§7.13）。
> 4. 「版」の表示を **commit の SHA だけ**に統一した。v1 は編集画面に blob の sha、履歴表に
>    commit の sha を出しており、同じ「版」の列で値が食い違っていた（§8.2）。
> 5. 保存先の選択規則を直した。v1 の規則では **Cloudflare Workers 上でローカルFS実装に落ちる**
>    （書けたように見えて消える）ため、本番ビルドでは明示指定が無い限りFS実装を選ばない（§7.1）。
> 6. 型チェックが落ちる中間コミット（v1 task_005）を無くし、保存層と API を1タスクにまとめた。
> 7. 未確認だった Vercel の数値（A3・A4）を一次資料で確定した（§7.4・§7.8）。
> 8. 「本番反映」タスクの実行環境を定義した。先方の Vercel は制作側が操作しないため、
>    **制作側アカウントに検証用プロジェクトを作って全経路を実測**し、先方への引き継ぎは
>    手順書で行う（§12 task_012）。

---

## 1. Overview

掲載内容の保存先を **Turso（libsql）から GitHub リポジトリ自体**へ移す。管理画面で保存すると
`content/<key>.json` が GitHub Contents API 経由でコミットされ、そのコミットを Vercel が拾って
本番デプロイする。データベースも外部ダッシュボードもサーバも不要になり、必要なのは
**環境変数だけ**になる。

あわせて管理画面の URL を `/admin` から **`/addiction-admin`** へ、管理 API を
`/api/admin/*` から **`/api/addiction-admin/*`** へ移す。

この移行が成立する根拠は、**公開8ページが既に `content/*.json` だけで正常表示できること**が
実測済みである点にある。現在は「DB が主役・同梱 JSON がフォールバック」だが、この関係を
**反転させて同梱 JSON を主役に格上げする**のが本計画の骨格である。

引き換えに失うものが3つある。**(a) 反映の即時性**（再ビルド待ち）、**(b) DB による共有
レート制限**、**(c) `session_version` による全端末ログアウト**。それぞれ §7.3 / §7.4 / §7.5 で
代替を決める。(a) は利用者の承諾が要る（§18）。

---

## 2. Goal

**利用者の目標**: サイトの文章を管理画面から直せる状態を維持したまま、**外部サービスの
アカウントを1つも持たずに**運用できるようにする。先方に渡すものを「GitHub リポジトリ +
環境変数」だけに減らし、Turso のダッシュボードを触る必要をなくす。

**プロジェクトの目標**: 掲載内容の変更履歴を Git に集約し、コードと本文が同じ履歴の上に乗る
状態にする。あわせて、管理画面の入口 URL を推測しにくい名前へ変える。

**非目標**: 反映速度を今より速くすること。本計画は**反映が遅くなる方向のトレードオフを
意図的に選ぶ**（§7.3）。速くする方式は §17-5 に残す。

---

## 3. Current State

以下はすべて本セッションで**実測して確認した事実**である。実測していない箇所は
「未確認」と明記する。

### 3.1 書き換え対象のコード（合計 417 行）

| ファイル | 行数 | 現在の役割 |
|---|---|---|
| `lib/admin/documents.ts` | 151 | 楽観ロック付き read/write/listRevisions/readRevision/listDocuments。すべて `content_documents` / `content_revisions` への SQL |
| `lib/admin/rate-limit.ts` | 112 | `login_attempts` テーブルで 5回/15分。**DB が null なら fail-closed でロック扱い** |
| `lib/admin/session.ts` | 87 | Cookie 検証のあと `admin_settings.session_version` を DB 照合。**DB が null なら fail-closed で null** |
| `lib/content/load.ts` | 45 | 公開ページの読み出し。DB → 失敗したら同梱 JSON へフォールバック |
| `lib/db.ts` | 22 | `@libsql/client/http` の唯一の入口。環境変数が無ければ `null` を返す |

**重要**: `rate-limit.ts` と `session.ts` は **fail-closed**。`lib/db.ts` を消しただけでは
「ログインが常に 429」「セッションが常に 401」になる。実装順序で担保する（§12）。

### 3.2 そのまま流用できるもの

- 管理画面 UI: `DocumentEditor.tsx`(315) / `FieldEditor.tsx`(365) / `InlineEditor.tsx`(149) の
  約829行。**リビジョン番号を表示・送信している箇所だけ**が影響を受ける。
  `FieldEditor.tsx` と `InlineEditor.tsx` は `/admin` 参照も revision 参照も持たない（grep 実測）。
- 項目定義の自動導出・入力検証: `lib/content/manifest-core.ts` / `lib/content/manifest.ts` /
  `lib/admin/ops.ts` の約1,003行。**DB に一切依存しない。** 無変更。
- `lib/admin/auth.ts`(286): PBKDF2 検証と HMAC 署名 Cookie。**DB 非依存。** 無変更。
- `lib/admin/request.ts`(57): CSRF 3条件。無変更。
- `scripts/verify-coverage.mjs`(93): `content/*.json` と manifest の突き合わせ。**DB 依存ゼロ。**

### 3.3 API 契約（現行）

| エンドポイント | リクエスト | 応答 |
|---|---|---|
| `GET /api/admin/documents` | — | `{documents:[{key,label,revision,updatedAt}]}` |
| `GET /api/admin/documents/[key]` | — | `{key,data,revision,updatedAt,manifest,revisions[]}` |
| `PUT /api/admin/documents/[key]` | `{baseRevision,data,note}` | `{data,revision}` / 409 `{revision}` / 422 `{errors}` / 503 |
| `PATCH /api/admin/documents/[key]` | `{baseRevision,ops,note}` | 同上 |
| `POST /api/admin/documents/[key]/revert` | `{revision}` | `{data,revision}` |

**実測**: `DocumentEditor.tsx` はエラー時に **HTTP ステータスコードだけ**を見ており
（409 / 422 / それ以外）、応答の `error` 文字列を比較していない。エラー名の変更は UI に影響しない。

**実測**: `app/api/admin/documents/route.ts` は `lib/admin/documents.ts` の `listDocuments()` を
**呼ばず、同じ SQL を直接書いている**（重複）。移行時に片方を直し忘れる危険がある。

### 3.4 公開ページのレンダリング方式

**実測**: 公開8ページ**すべて**に `export const dynamic = "force-dynamic"` がある。
理由は「毎リクエスト DB を読むから」（`docs/implementation-plan.md` §7.2、
`open-next.config.ts` 冒頭コメント）。DB が消えれば**この前提自体が無くなる**。

### 3.5 静的化しても公開出力は変わらない（v1 の断定を実測で覆した）

`scripts/verify-text.sh:43-58` のコメントは「DB 接続情報が無いと同梱 JSON へフォールバックし、
その経路では `/` の画像 preload が1本消えて baseline と1件差分になる」と言う。
v1 はこれを根拠に「Git 化すると恒久的に1件差分が出るので baseline を作り直す」とした。

本セッションで2通り実測した（`npm run build` → 環境変数なしで `next start` → `verify:text`）。

| 条件 | 結果 |
|---|---|
| `force-dynamic` のまま、同梱 JSON 経路 | 差分1件: `[index] head.link 消失: preload /assets/films/hero-01-secret-sea.jpg`。他7ルートは一致 |
| **`force-dynamic` を8ページから外し、同梱 JSON 経路（静的生成）** | **完全一致: 8ルート / 要素1,891個 / テキストノード1,020個 / コメントノード0個**。ビルド出力で8ルートが `○ (Static)` |

つまり preload が消えるのは「動的レンダリング + 即時に解決する同梱 JSON」の組み合わせに限る。
本計画は公開8ページを**静的生成**にするので、**baseline は一切変更しない**。`verify:text` は
すべてのタスクで「現在の baseline と完全一致」を要求し、`--update` は本計画では実行しない。

（実験は作業ツリー上で `force-dynamic` の8行を消して行い、直後に `git checkout` で戻した。
`git status` が `?? docs/plans/git-backed-cms/` のみに戻っていることを確認済み。）

### 3.6 GitHub 側（実測 + 一次資料）

- リポジトリ `sawanori/addiction-film-fes-nextapp-` は **public**、`default_branch` は `main`。
  `.github/workflows/` は存在しない。
- `GET /repos/{o}/{r}/contents/content/films.json?ref=main` は `content`(base64) と `sha`(blob) を
  1往復で返す（`gh api` で実測。`sha: bd0c12e2…`, `size: 6596`）。
- `content/` の11ファイルは 1,867〜10,859 バイト。Contents API の「1MB 以下なら全機能」に対して
  2桁の余裕がある。
- **書き込み側**（GitHub REST ドキュメント「Create or update file contents」で確認）:
  更新時は `sha` が**必須**、不一致は **409 Conflict**、`sha` 欠落などは **422**。
  同一リポジトリへの**並行リクエストは衝突しうる**（ドキュメントに明記）。PUT の実行自体は
  リポジトリを変更するため本セッションでは行っておらず、**task_004 で検証用ブランチに対して実測**する。
- このマシンの `gh` は `GITHUB_TOKEN`（classic, `repo` スコープ）で `sawanori` として認証済み
  （`gh auth status` で実測）。task_004 の実測にはこれを `GITHUB_CONTENT_TOKEN` として
  **検証用ブランチに限って**使える。

### 3.7 JSON の整形は可逆でない（実測）

`content/*.json` 11件について `JSON.stringify(JSON.parse(raw), null, 2) + "\n" === raw` を試すと、
一致するのは **`films.json` と `index.json` の2件だけ**。残る9件は短い文字列配列を1行で書く
手書きの整形（例: `"columns": ["券種", "内容", "料金", "発売"]`）で、`JSON.stringify` は
これを複数行に展開する。**管理画面の初回保存で、意味の変わらない整形差分が数百行出る**。
→ §7.13 で先に整形を正規化する。

### 3.8 Vercel 側（一次資料で確認）

| 項目 | 事実 | 出所 |
|---|---|---|
| Hobby の作成デプロイ数 | **1日 100 / 1時間 100 / 5分 60**。Pro は 6,000/日 | `vercel.com/docs/limits` |
| ビルド時間の上限 | 45分/デプロイ（全プラン） | 同上 |
| push ごとのデプロイ | **すべての push をデプロイする**。同一ブランチでビルド中に次の push が来ると、古い方は完了後に**最新だけをデプロイし残りをキャンセル**（`github.autoJobCancelation` の既定） | `vercel.com/docs/git/vercel-for-github` |
| **デプロイを起動できるコミット** | **「Hobby ではアカウント所有者だけがデプロイを起動でき、所有者でない contributor はデプロイできない」**。加えて「Git クライアントの email が Git プロバイダで検証済みの email と一致する必要がある」 | `vercel.com/kb/guide/why-aren-t-commits-triggering-deployments-on-vercel` |
| WAF レート制限 | **Hobby でも使える**: 1プロジェクト1ルール、固定窓、窓は10秒〜**10分**、キーは IP / JA4、100万リクエスト/月込み。Hobby のカスタムルールは合計3つまで | `vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting` |
| Data Cache | Hobby でも有効。`fetch` と `unstable_cache` が対象。`revalidateTag` は**全リージョンへ 300ms 以内に伝播**。項目 2MB まで | `vercel.com/docs/caching/runtime-cache/data-cache` |
| 制作側の Vercel | チーム `sawanori's projects` は **Hobby**。一覧（上限50件）に本リポジトリへ紐づくプロジェクトは**無い** | Vercel MCP `list_teams` / `list_projects` |

### 3.9 Next 16.3.0 のキャッシュ API（`node_modules/next/dist/docs/` で確認）

- `next.config.ts` に `cacheComponents` は無い → 従来モデル。`fetch` の `force-cache` +
  `next.tags`、`unstable_cache(fn, keys, {tags})`、`revalidateTag(tag, profile)` が使える。
- `force-dynamic` は「レイアウト・ページ内の全 `fetch()` を `{cache:'no-store', revalidate:0}` に
  する」のと等価（`unstable_cache` への影響は**未確認**）。
- `revalidateTag` の第2引数は必須（1引数形は非推奨）。`'max'` は stale-while-revalidate、
  即時失効は `{ expire: 0 }`。`updateTag` は Server Actions 専用。

### 3.10 `/admin` の全参照（grep 実測）

- `addiction-admin` はリポジトリ全体で **0件**。
- `middleware.ts` / `proxy.ts` は**存在しない**（正典 §9.1 の記述は当時の設計で、`docs/PROGRESS.md` で
  削除済み）。マッチャの更新は不要。
- 移動するディレクトリ: `app/(admin)/admin/` → `app/(admin)/addiction-admin/`、
  `app/api/admin/` → `app/api/addiction-admin/`。`app/(admin)/admin.css` と
  `app/(admin)/layout.tsx` は `(admin)/` 直下なので動かさない。ルートグループ名は URL に出ない。
- 挙動に関わる参照は10箇所（§11.2 の表）。**危険1**: `login/page.tsx` の
  `PageProps<"/admin/login">`（Next 16 の typed routes。直し忘れると `tsc` が落ちる）。
  **危険2**: 素朴な `sed` は `@/lib/admin/` の import 指定子18箇所と `docs/plans/trailer-admin/` を壊す。
- Cookie 名 `aff_admin` と CSRF ヘッダ `x-aff-admin` は URL ではないので変えない。
- ドキュメント側の `/admin`: `README.md` / `CLAUDE.md` / `docs/deploy-vercel.md` / `.env.example`。
  `docs/PROGRESS.md` / `docs/implementation-plan.md` は履歴として残す。

### 3.11 Turso 撤去の全対象（grep 実測）

コード・設定: `lib/db.ts`(全削除) / `lib/content/load.ts` / `lib/admin/documents.ts` /
`lib/admin/rate-limit.ts` / `lib/admin/session.ts` / `app/api/admin/login/route.ts` /
`app/api/admin/documents/route.ts` / `next.config.ts`(`outputFileTracingIncludes` は libsql 専用) /
`package.json`(`db:migrate` / `db:seed` / `@libsql/client`) / `package-lock.json` /
`scripts/db-migrate.mjs` / `scripts/db-seed.mjs` / `scripts/load-dev-vars.mjs`(利用者は上記2つだけ) /
`scripts/verify-text.sh`(43-58行) / `.env.example`。

テーブルは5つ（`content_documents` / `content_revisions` / `login_attempts` / `admin_settings` /
`schema_migrations`）。Vercel には未設定、Cloudflare には `wrangler secret` で入っている。

### 3.12 本番データが `content/*.json` と一致しているかは未確認

`docs/deploy-vercel.md` §5 が「`content/*.json` は正典データであって現行サイトの最新状態とは
限らない」と明記している。2026-08-27 に両 DB へ `db-seed.mjs --force` を当てた記録があるが、
その後の管理画面編集は DB にしか無い。**移行の最初のタスクは、本番 DB を書き出して
`content/*.json` と突き合わせること**（§10.2）。

---

## 4. Scope

- **A. 保存層の差し替え**: `ContentStore` インターフェースと2実装（GitHub / ローカルFS）を新設し、
  `lib/admin/documents.ts` をその上に載せ替える。楽観ロックは `revision:number` →
  **blob の `sha:string`**。
- **B. 公開ページの読み出し**: `lib/content/load.ts` を同梱 JSON 専用にし、8ページから
  `force-dynamic` を外して静的生成にする（§3.5 で出力不変を実測済み）。
- **C. レート制限の代替**（§7.4）。
- **D. セッションの代替**（§7.5）。
- **E. 履歴と復元**: GitHub の commits API で履歴を出し、任意コミット時点の内容へ戻す（§7.7）。
- **F. URL の変更**: `/admin` → `/addiction-admin`、`/api/admin/*` → `/api/addiction-admin/*`。
- **G. Turso の撤去**（§3.11）。
- **H. JSON 整形の正規化**（§7.13）と、検証系の追随（`verify-text.sh` の DB 依存除去）。
- **I. ドキュメント**: `.env.example` / `README.md` / `CLAUDE.md` / `docs/deploy-vercel.md`。
- **J. 検証用 Vercel プロジェクトでの全経路実測**と、先方向け引き継ぎ手順の確定（§12 task_012）。

## 5. Non-Scope

- **画像・動画のアップロード機能**（要件「画像は変更しなくてよい」）。
- **Cloudflare Workers 版の撤去**（当面残す。扱いは §7.9）。
- **公開ページが実行時に GitHub から読む方式（§7.3 案B）の実装**。採らない結論にした。
- **プレビュー環境から本番を保存できるようにすること**。むしろ塞ぐ（§7.6）。
- **複数人の同時編集・ロック UI**。現行と同じく「後から保存した人が 409 で弾かれる」まで。
- **管理画面の見た目の変更**。`admin.css` は無変更。文言と「版」の表示形式だけ §8 のとおり直す。
- **公開8ページの可視テキスト・DOM 構造・class 集合・`title`/`description` の変更**（不変条件）。
- **Vercel の有料プランへの移行**。
- **先方の Vercel の操作**。制作側は代行しない（`docs/deploy-vercel.md` §0）。

## 6. Assumptions

- **A1**: 本番 Turso の `content_documents` は 11 キーそろっており、`content/*.json` と一致している。
  **未確認**。task_001 で実測し、食い違えば DB 側を正として `content/*.json` へ取り込む。
- **A2**: `PUT /repos/{o}/{r}/contents/{path}` は `sha` 不一致で 409 を返す。
  GitHub 公式ドキュメントに明記されているが、**本セッションでは未実測**。task_004 で検証用ブランチに
  対して実測する。
- **A3**（v1 の未確認事項）: **確定した**。Hobby は 1日100デプロイ（§3.8）。1保存=1ビルドでも
  会期前の集中更新（数十回/日）で上限に当たらない。
- **A4**（v1 の未確認事項）: **確定した**。WAF レート制限は Hobby で1ルール使える（§3.8）。
- **A5**: Vercel での1回のビルド〜反映は 1〜2分。**未確認**。task_012 で実測して文言を確定する。
- **A6（v1 から改訂）**: `GITHUB_CONTENT_TOKEN` は **Vercel プロジェクトの所有者（Hobby）または
  チームメンバー（Pro）自身の GitHub アカウント**で発行する。制作側が発行したトークンを先方の
  Vercel で使うと、コミットの author が Vercel 側の所有者と一致せず**デプロイが起動しない**
  （§3.8 の KB）。先方が GitHub アカウントを持たない場合は、**先方名義のアカウントを作る**ところ
  から手順に含める（制作側のトークンで代用しない）。
- **A7**: 更新頻度は「会期前に集中して数十回、平常時は月に数回」。**未確認**だが A3 の上限に対して
  十分小さい。
- **A8**: 反映まで 1〜2分かかることを利用者が受け入れる。**未確認**。§18 で承諾を取ってから
  実装に入る。
- **A9**: リポジトリが Transfer / Fork されても、`GITHUB_CONTENT_REPO` を書き換えれば追随できる。
  owner/repo をコードに書かない。

---

## 7. Architecture Impact

| 層 | 影響 |
|---|---|
| フロントエンド（公開） | **DOM 出力は不変（実測済み）。** レンダリング方式が「毎リクエスト動的」→「ビルド時に静的生成」に変わる。`force-dynamic` を8ファイルから削除 |
| フロントエンド（管理） | `revision:number` → `sha:string`（ロック用・非表示）と `commit`（表示用）。文言を「すぐ反映」→「1〜2分で反映」に変更 |
| API | パスが `/api/admin/*` → `/api/addiction-admin/*`。`baseRevision`/`revision` → `baseSha`/`sha`。応答に `commit` を追加。ステータスコードの意味は不変 |
| 認証 | セッション検証から DB 往復が消え、Cookie の HMAC 検証だけになる。`lib/admin/auth.ts` は無変更 |
| ストレージ | **Turso 全廃。** 保存先は GitHub リポジトリの `content/*.json`。`next dev` ではファイルシステム |
| インフラ | Vercel のみ。DB 無し。実行リージョン `hnd1` 固定の根拠（DB が近い）は消えるが、設定は触らない |
| ビルド | **1保存 = 1コミット = 1本番デプロイ**。連続保存は Vercel の自動キャンセルで最後の1本に収束（§3.8） |

### 7.1 保存層の設計（`ContentStore`）

新設する3ファイル。

```
lib/content/store.ts         インターフェース定義 + 実装の選択 + git blob sha の計算 + 直列化
lib/content/store-github.ts  GitHub Contents / Commits API 実装
lib/content/store-fs.ts      ローカルファイルシステム実装
```

```ts
/** sha は git の blob SHA-1。楽観ロック専用で、画面には出さない。 */
export type StoredDocument = { key: string; data: unknown; sha: string };
export type HistoryEntry = { commit: string; note: string | null; createdAt: string };
export type WriteOutcome =
  | { ok: true; sha: string; commit: string | null; createdAt: string; unchanged: boolean }
  | { ok: false; reason: "conflict" | "not_found" | "forbidden" | "store"; sha?: string };

export interface ContentStore {
  read(key: string): Promise<StoredDocument | null | "store_error">;
  write(key: string, baseSha: string, data: unknown, note: string | null): Promise<WriteOutcome>;
  /** ダッシュボード用。updatedAt はそのファイルを最後に触ったコミットの日時（無ければ null） */
  list(): Promise<Array<{ key: string; updatedAt: string | null }> | "store_error">;
  history(key: string, limit: number): Promise<HistoryEntry[] | "store_error">;
  readAt(key: string, commit: string): Promise<{ data: unknown } | null | "store_error">;
}
```

**実装の選択規則**（`getContentStore()`。v1 から改訂）:

| 条件（上から順に判定） | 選ぶ実装 |
|---|---|
| `CONTENT_STORE=fs` | `LocalFsStore`（`npm start` をローカルで動かして管理画面を試すときだけ明示する） |
| `CONTENT_STORE=github`、または `NODE_ENV !== "development"` で `GITHUB_CONTENT_TOKEN` と `GITHUB_CONTENT_REPO` が両方ある | `GitHubStore` |
| `NODE_ENV === "development"`（`next dev`） | `LocalFsStore` |
| それ以外 | `null` → 管理画面は 500 `server_misconfigured` |

v1 の規則「`VERCEL` が無ければ FS」は、**Cloudflare Workers 上で `LocalFsStore` に落ちる**
（`VERCEL` が無く、`node:fs` へ書けたように見えて消える）ため採らない。本番ビルドでは
**明示指定が無い限り FS 実装を選ばない**。

**外部呼び出しの共通規則**（`GitHubStore`）:

- すべての `fetch` に `cache: "no-store"` と `signal: AbortSignal.timeout(10_000)` を付ける。
  タイムアウト・ネットワーク例外・5xx は `"store_error"`（API は 503）。GitHub が止まったときに
  管理画面のリクエストが Vercel の関数上限までぶら下がるのを防ぐ。
- ヘッダは `Authorization: Bearer <token>`、`Accept: application/vnd.github+json`、
  `X-GitHub-Api-Version: 2022-11-28`。
- `GITHUB_CONTENT_REPO` は `owner/repo` 形式を検証してから URL に埋める。

### 7.2 楽観ロックを `sha` に置き換える

現行は `revision` 番号の `WHERE revision = ?`。Git 化後は **blob の SHA-1** を使う。

- `GitHubStore`: Contents API の GET が返す `sha` をそのまま使い、PUT に `sha` を渡す。
  不一致なら GitHub が 409 を返す（A2）。
- **409 を受けたときの規則**（v1 から追加）: 最新を読み直し、
  (a) 読み直した blob sha が `baseSha` と**同じ**なら、それは同一リポジトリへの並行リクエストによる
  ref の衝突（§3.6）なので **PUT を1回だけ再試行**する。
  (b) **違う**なら、ほかで先に保存されたということなので `{ok:false, reason:"conflict", sha:最新値}` を
  返す（現行の 409 応答が `{revision}` を返すのと同じ意味）。
- `LocalFsStore`: **git の blob SHA-1 を自前で計算する**。`sha1("blob " + バイト長 + "\0" + 内容)`。
  計算は **Web Crypto（`crypto.subtle.digest("SHA-1", …)`）**で行う（`lib/admin/auth.ts` と同じ
  流儀で、Node / workerd の両方で動く。v1 の `node:crypto` は採らない）。
  バイト長は UTF-8 のバイト数（文字数ではない）。
  → 回帰テスト `scripts/verify-blob-sha.mjs` を新設し、`content/*.json` 11件すべてで
  「直列化（§7.13）→ `gitBlobSha()`」が `git hash-object <file>` と一致することを確認する。
  これで直列化の正規性と sha 計算の正しさを同時に検証できる。

**「変更なし」の扱い**: 送られてきた `data` を直列化した結果が現在のファイルと**バイト単位で
同一**なら、コミットしない。応答は 200 で `{ sha: baseSha, commit: null, unchanged: true }`。
理由は「無意味なビルドを1本増やさない」。

### 7.3 反映が即時でなくなる問題（論点1）

現行の管理画面は「保存すると公開サイトにすぐ反映されます」と3箇所で表示している
（`admin/page.tsx:81`、`DocumentEditor.tsx:123,185`）。Turso を毎リクエスト読んでいたから
成り立っていた。Git 化すると成り立たない。

2案を比較する。v1 の表は案Bの前提に誤りがあった（読み出し元を `raw.githubusercontent.com` と
していたが、raw は CDN でキャッシュされ鮮度を制御できない。案Bで読むなら Contents API）。
一次資料で確認した事実に置き換えて比較し直す。

| | **案A: ビルド反映**（推奨） | **案B: 実行時取得 + `revalidateTag`** |
|---|---|---|
| 公開ページの読み出し元 | 同梱 `content/*.json`（`import`、ビルド時に静的生成） | `unstable_cache` で包んだ GitHub Contents API（Vercel Data Cache に載る） |
| 反映までの時間 | **1〜2分**（Vercel の再ビルド待ち。A5 未確認） | **数秒**（保存時に `revalidateTag(tag, {expire:0})`。Data Cache は全リージョンへ 300ms で伝播。§3.8） |
| 必要な変更 | `load.ts` を同梱 JSON 専用にする（数行）+ `force-dynamic` 除去 | `load.ts` の fetch 化 + タグ + フォールバック + `force-dynamic` 除去 + 保存 API での無効化 |
| GitHub 障害時 | 公開ページは無傷（ビルド済み） | キャッシュが残る間は無傷。追い出されると同梱 JSON（最後のビルド時点）へ落ち、**古い内容を出しながら気づけない** |
| Cloudflare 版 | `deploy:cf` 時点のスナップショット（説明しやすい） | `open-next.config.ts` は incremental cache を**意図的に外している**ため `unstable_cache` が効かず、**毎リクエスト GitHub API を叩く**（bot で 5,000/h を食い潰す）。Cloudflare 側だけ別経路が要る |
| ビルドの発生 | 保存ごとに1本 | 保存ごとに1本（`ignoreCommand` で content のみの変更を止められるが、止めると同梱 JSON が古くなりフォールバックの質が下がる） |
| Vercel の関数呼び出し | ゼロ（静的配信） | 再生成時のみ |
| 検証面積 | 小さい（出力不変は実測済み） | 大きい（キャッシュ・無効化・フォールバックの3経路） |

**採るのは案A。** 理由:

1. 要件が「サーバーを設置しない・環境変数だけで動く」であり、**経路が1本で説明できること**が
   構成の価値そのものである。
2. 案Bは Vercel 上では成立する（一次資料で確認済み）が、Cloudflare 版と並行運用する現状では
   経路が2つに割れる。障害時に「古い内容を出しながら気づけない」失敗モードを持ち込む。
3. 反映 1〜2分は、映画祭の告知サイトの文言修正という用途では実害が小さい。**ただしこれは
   利用者の判断事項**（A8、§18）。会期中の緊急修正で数秒が要るなら、案A を土台にしたうえで
   案B を後から重ねられる（§17-5。案A の `force-dynamic` 除去と GitHub 保存は案B の前提でもある）。

### 7.4 ログイン試行の回数制限（論点2）

現行: `login_attempts` テーブルで IP ごとに 5回失敗 / 15分ロック。DB が無ければ fail-closed。

**主たる守り（設定・コード不要）: Vercel WAF のレート制限ルール。** Hobby でも1ルール使える（§3.8）。

| 設定項目 | 値 |
|---|---|
| 条件 | Request Path が `/api/addiction-admin/login` に等しい、かつ Method が `POST` |
| キー | IP |
| 窓 / 上限 | **10分 / 10回**（Hobby の窓の上限は10分なので、現行の15分は選べない） |
| 動作 | Rate Limit（既定の 429） |

`docs/deploy-vercel.md` に画面手順として書く（ダッシュボード → Firewall → Configure → New Rule →
Save → Review Changes → Publish）。**カウンタはリージョン単位**（ドキュメントに明記）で、
複数リージョンから来る分散攻撃は上限を超えうるが、単一 IP の総当たりには十分効く。

**補助（コード）: プロセス内メモリのカウンタ**（`Map<ip, {failures, lockedUntil}>`。5回/15分）。
関数インスタンスが生きている間だけ有効で、複数インスタンスでは共有されない。それでも残す
理由は、`LoginForm.tsx` の「しばらく待ってください（残りN分）」の挙動を無変更で維持でき、
WAF ルールを先方が入れ忘れても素朴な連続試行は止まるから。**fail-closed はやめる**
（判定できないからロック、は全利用者を締め出すだけになる）。Map は上限1000件で古いものから捨てる。
IP は `x-forwarded-for` の先頭（Vercel が設定する）→ `cf-connecting-ip` → `"unknown"`。

**補助（設計上の性質）**: PBKDF2 100,000 回反復の計算コスト、`/admin` からの URL 変更
（決め打ちで叩く自動化の大半を素通りさせる。秘匿による防御なので主たる守りとは数えない）。

**却下: GitHub に試行記録を書く。** (a) 未認証リクエストごとにコミット＝ビルドが暴発、
(b) こちらのトークンを使った増幅攻撃になる、(c) API 上限（5,000/h）を未認証トラフィックで
食い潰す、(d) 履歴がログで汚れる。

**却下: WAF だけにしてメモリ実装を消す。** 先方の手作業（ルール登録）に全面依存する構成に
なる。メモリ実装は50行程度で `LoginForm` を無変更に保てる。

**残るリスクの明示**: 上記をすべて足しても、共有ストアがある現行より弱い場面（複数リージョンからの
分散試行）は残る。最終的な守りは **`ADMIN_PASSWORD_PBKDF2` の元になるパスワードの強さ**。
`docs/deploy-vercel.md` に「20文字以上のランダムな文字列を使い、使い回さない」と明記する。

### 7.5 セッション（論点7）

現行は `admin_settings.session_version` を毎回 DB 照合し、+1 すれば全端末がログアウトする。

**採用**: DB 照合を撤去する。Cookie の payload には `ver` を**残す**（`lib/admin/auth.ts` の
`SessionPayload` 型と `isValidSessionPayload` を触らないため）。発行時は固定値 `1`、
検証側は値を照合しない。

全端末ログアウトの手段は **`ADMIN_SESSION_SECRET` の差し替え1本**に統一する。鍵が変われば
発行済み Cookie の HMAC 検証が全部落ちる。`.env.example` に既にその旨が書いてある。
副次的に、`getAdminSession()` から I/O が消え、認証チェックがネットワーク往復ゼロになる。

**トレードオフ**: Vercel の環境変数を変えると再デプロイが要る（1〜2分）。「今すぐ全端末を
切りたい」場面では現行より遅い。パスワード変更時に一緒に行う運用として文書化する。

### 7.6 GitHub トークンの権限・発行者・置き場所（論点3）

**トークンの種類**: fine-grained personal access token。

| 設定項目 | 値 |
|---|---|
| **発行者** | **Vercel プロジェクトの所有者本人の GitHub アカウント**（Hobby）。Pro ならチームメンバー。§3.8 の KB のとおり、それ以外のアカウントが author のコミットは**デプロイを起動しない** |
| Resource owner | リポジトリの所有者（Transfer 後は先方） |
| Repository access | **Only select repositories** → 対象リポジトリ1つだけ |
| Repository permissions | **Contents: Read and write** のみ（Metadata: Read は自動で付く） |
| その他 | **すべて No access** |
| 有効期限 | 設定する（fine-grained は最長1年）。切れると保存が 401 → 503 になる。期限を `docs/deploy-vercel.md` に記録し、更新手順を書く |

**author / committer は指定しない**（トークン所有者になる）。名前や email を上書きすると
Vercel の「検証済み email と一致」条件を外す恐れがある。

Contents: Read and write だけなら、漏れても**このリポジトリのファイルを書き換えられる**だけで、
他リポジトリ・組織設定・Actions には触れない（`.github/workflows/` が無いことも根拠）。

**Preview 環境の問題**: Vercel の Preview にトークンを入れると、プルリクエストごとのプレビュー URL の
`/addiction-admin` から `main` の本文を書き換えられる。`GITHUB_CONTENT_BRANCH` を変えても
**トークン自体が `main` を書ける**ので対策にならない。塞ぎ方を3枚重ねる。

1. **手順**: `GITHUB_CONTENT_TOKEN` を **Production スコープだけ**に登録する。Preview の管理画面は
   保存先が無いので 500。公開ページは同梱 JSON で動く。
2. **コード**: `GitHubStore.write` は `process.env.VERCEL_ENV === "preview"` なら
   `{ok:false, reason:"forbidden"}` を返し、API は 403 を返す。手順(1)の設定ミスへの保険。
3. **手順**: Preview に Deployment Protection（Vercel Authentication）を有効化し、
   `ADMIN_PASSWORD_PBKDF2` を Preview では本番と別の値にする（現行 `docs/deploy-vercel.md` §2 と同じ）。

### 7.7 履歴と復元（論点5）

2案を比較し、**案①（履歴 UI あり）を採る**。最終判断は §18。

| | **案①: 履歴 UI あり**（推奨） | 案②: 履歴なし |
|---|---|---|
| 履歴の表示 | `GET /repos/{o}/{r}/commits?path=content/<key>.json&sha=<branch>&per_page=20` | GitHub の画面へのリンクを出すだけ |
| 復元 | 任意コミット時点の内容を読み、**新しいコミットとして書き戻す**（現行 revert と同じ意味論） | 管理画面からはできない |
| UI の変更量 | 表の構造は現行のまま。列の中身を §8.3 のとおり変える | 履歴表とボタンを削除 |
| 見積もり | **7人日** | **6人日** |

案①を採る理由: 現行 UI が既にあり、置き換えは型と表示の変更に収まる。「間違えても前の内容に
戻せる」は非技術者が管理画面を触るうえでの心理的な担保で、外すと管理画面の価値が目減りする。

**コミットメッセージの形式**:

```
content(films): 管理画面から更新

<管理画面のメモ欄に入力された文字列>
```

1行目は定型、2行目以降が `note`。履歴表示では2行目以降を `note` として取り出す。
`note` は制御文字を除去し **500 文字で切る**（コミットメッセージは §8.4 の「文字列を加工しない」
規約の対象外。対象は保存されるデータ。この区別をコードのコメントに残す）。

### 7.8 Vercel 側のコスト・制限（論点9）

- **1保存 = 1コミット = 1本番デプロイ**。Hobby の上限は 1日100 / 1時間100 / 5分60（§3.8）。
  会期前に1日数十回保存しても届かない。上限に当たると**その日はそれ以上デプロイされない**
  （保存＝コミットは成功するので、翌日のビルドで反映される）。この挙動を文書化する。
- **連続保存**: 既定の自動キャンセルで最後の1本に収束する（§3.8）。`vercel.json` は触らない。
- **無駄なビルドを増やさない**: §7.2 の「内容が同一ならコミットしない」。
- `ignoreCommand` は使わない（案A ではビルドが必要）。

### 7.9 Cloudflare Workers 版との関係（論点10）

Git 保存に切り替えると、**Cloudflare 側は自動で再ビルドされない**（`npm run deploy:cf` は手動）。
Cloudflare 版は「最後に `deploy:cf` を打った時点の `content/*.json` のスナップショット」になる。

**採る扱い**: 「Cloudflare 版は同梱 JSON の手動デプロイのみ。掲載内容の反映には
`npm run deploy:cf` の再実行が要る」と割り切り、`CLAUDE.md` と `docs/deploy-vercel.md` §7 に明記する。
管理画面は Cloudflare 版でも動く（`GitHubStore` を選ぶ。§7.1 の規則で FS には落ちない）が、
**保存すると GitHub に書かれ、Vercel だけが自動で追随する**という非対称を文書化する。

### 7.10 環境変数（論点3・8）

| 変数名 | 扱い | 内容 |
|---|---|---|
| `GITHUB_CONTENT_TOKEN` | **新規** | fine-grained PAT（§7.6）。**Production スコープのみ** |
| `GITHUB_CONTENT_REPO` | **新規** | `owner/repo` 形式。Transfer / Fork に追随できるよう環境変数にする |
| `GITHUB_CONTENT_BRANCH` | **新規・省略可** | 省略時 `main`。ローカルから GitHub 書き込みを試すときは検証用ブランチを指す |
| `CONTENT_STORE` | **新規・省略可** | `fs` / `github`。実装の選択を明示するとき（§7.1）。通常は未設定 |
| `ADMIN_PASSWORD_PBKDF2` | 維持 | 変更なし |
| `ADMIN_SESSION_SECRET` | 維持 | 全端末ログアウトの唯一の手段に格上げ（§7.5） |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | **削除** | — |

**素の `GITHUB_TOKEN` を使わない理由**: このマシンには既に `GITHUB_TOKEN` が設定されており
（§3.6）、素の名前を読むと**ローカル開発で開発者個人のトークンを黙って拾う**。
GitHub Actions の予約的な名前でもある。

### 7.11 管理画面が読む「現在の内容」（論点4）

**同梱 JSON を読んではいけない。** 保存直後〜再ビルド完了までの間、ビルドに含まれる JSON は古い。
管理画面がそれを読むと「保存したのに反映されていないように見える」だけでなく、**古い内容を
土台に上書きする**。

**採る設計**: 管理画面（ページ・API とも）は**常に GitHub Contents API から `?ref=<branch>` で読む**
（`cache: "no-store"`）。1回の GET で `content` と `sha` が揃う。GitHub が読めないときは
**fail-closed で 503 `store_unavailable`**。同梱 JSON へのフォールバックは**しない**。

**ダッシュボード（一覧）**（v1 から改訂）: ドキュメントごとに
`GET /repos/{o}/{r}/commits?path=content/<key>.json&sha=<branch>&per_page=1` を **11本並列**で呼び、
各ドキュメントの「最終更新」を出す。v1 の「content フォルダ全体の最終更新（全キー共通）」は
現行より情報が減る UX 後退で、11並列は認証済み上限（5,000/h、同時100）に対して十分小さい。
「版」列は出さない（§8.2）。

### 7.12 ローカル開発（論点8）

`LocalFsStore` は `content/<key>.json` を `node:fs` で直接読み書きする。

- `sha` は §7.2 の blob SHA-1 を自前計算。**GitHub 実装と同じ値**になる。
- `history()` は空配列、`readAt()` は `null`（ローカルでは履歴表が空・復元は 404）。
  `git log` を子プロセスで叩く案は採らない（Next のサーバに子プロセスを持ち込まない）。
- `write` は `commit: null`、`createdAt` は現在時刻。
- 保存すると作業ツリーの `content/*.json` が書き換わる。**試し書きを戻す手順は
  `git checkout -- content/`**（現行の `node scripts/db-seed.mjs --force` の後継。CLAUDE.md を書き換える）。

### 7.13 JSON の直列化と整形の正規化（v1 から追加）

直列化は **`JSON.stringify(data, null, 2) + "\n"`** に固定する（`lib/content/store.ts` の
`serializeDocument()`。GitHub 実装・FS 実装・正規化スクリプトがすべてこれを使う）。

§3.7 のとおり現状の11ファイルはこの形と一致しない。放置すると管理画面の初回保存で
**意味の変わらない整形差分が数百行**出て、履歴の価値が下がる。そこで **task_001 で11ファイルを
この形に書き直してコミットする**。書き直しの前後で、

- `JSON.parse` した値が deep-equal であること、
- 全文字列のコードポイント配列が一致すること（`嘘つきは〇○のはじまり` のような表記ゆれを
  持つ値があるため。`scripts/db-seed.mjs:87-114` の `verifyOne` と同じ方式）、
- `npm run verify:text` が完全一致すること（同梱 JSON の値が変わっていないことの最終確認）、

を満たすことを完了条件にする。

---

## 8. UI Plan

見た目（`admin.css` 890行）は無変更。変えるのは**文言と、版の表示形式**だけ。

### 8.1 「すぐ反映されます」を全部直す（3箇所）

| 場所 | 現在 | 変更後 |
|---|---|---|
| `admin/page.tsx:81` | 「保存すると公開サイトにすぐ反映されます。保存のたびに履歴が残るので、間違えても前の内容に戻せます。」 | 「保存すると、**1〜2分ほどで**公開サイトに反映されます。保存のたびに履歴が残るので、間違えても前の内容に戻せます。」 |
| `DocumentEditor.tsx:123` | 「保存しました。公開ページにすぐ反映されています（版 N）」 | 「保存しました。**1〜2分ほどで公開ページに反映されます**」 |
| `DocumentEditor.tsx:185` | 「保存すると公開ページにすぐ反映されます」 | 「保存すると**1〜2分ほどで**公開ページに反映されます」 |

「1〜2分」は A5（未確認）に依存する。task_012 で実測してから確定する。

### 8.2 版の表示（v1 から改訂: commit の SHA だけを出す）

- 編集画面の見出し: 現在の「版 3」を「**最終保存 2026-09-03 14:05（abc1234）**」にする。
  日時と7桁は **`history[0]`（最新コミット）**から取る。履歴が空（ローカル）なら
  「最終保存 —（履歴なし）」。
- 一覧（ダッシュボード）: 「版」は出さない。「最終更新」はドキュメントごとの最終コミット日時（§7.11）。
- **blob の `sha` は画面に一切出さない**（`baseSha` として送るだけ）。v1 は編集画面に blob sha、
  履歴表に commit sha を出しており、同じ「版」でも値が一致しなかった。

### 8.3 履歴表

| 列 | 現在 | 変更後 |
|---|---|---|
| 版 | `3` | `abc1234`（コミット SHA 先頭7桁。`title` 属性に40桁） |
| メモ | `content_revisions.note` | コミットメッセージの2行目以降 |
| 日時 | `content_revisions.created_at` | `commit.committer.date` |
| 操作 | 「この版に戻す」 | 同じ（送る値がコミット SHA 文字列になる）。先頭行（現在の版）は「現在」表示で無効 |

表示件数は **20件**（`per_page=20`）。20件を超える履歴は GitHub の画面で見てもらう旨を1行添える
（リンク先は `https://github.com/<repo>/commits/<branch>/content/<key>.json`。`GITHUB_CONTENT_REPO` から組む）。

保存成功時に履歴の先頭へ楽観的に行を足す既存の実装は残す。行の `commit` は PUT 応答の `commit` を使う
（`unchanged` のときは足さない）。

### 8.4 保存できないときの表示

- **403（Preview 環境）**: 「プレビュー環境では保存できません。本番の管理画面から操作してください。」
- **503**: 「データベースに接続できませんでした」→「**保存先（GitHub）に接続できませんでした。
  時間をおいて再読み込みしてください。**」（`admin/page.tsx` と `docs/[key]/page.tsx` の2箇所）
- **404（ローカルでの復元）**: 「この環境では復元できません」。

### 8.5 レスポンシブ

変更なし。

---

## 9. API Plan

パスを `/api/admin/*` → `/api/addiction-admin/*` へ移し、リビジョンの型を変える。
**HTTP ステータスコードの意味は現行のまま**（`DocumentEditor.tsx` がステータスコードだけを見ているため）。
すべてのルートで `export const dynamic = "force-dynamic"` は残す。

### 9.1 `GET /api/addiction-admin/documents`

| 項目 | 内容 |
|---|---|
| 認証 | `requireAdminApi()`（変更なし） |
| 応答 200 | `{ documents: [{ key, label, updatedAt: string \| null }] }` |
| 実装 | **`lib/admin/documents.ts` の `listDocuments()` を呼ぶ**（現行の SQL 直書きを解消）。中身は §7.11 の11並列 |
| 500 / 503 | `server_misconfigured`（store が null）/ `store_unavailable` |

### 9.2 `GET /api/addiction-admin/documents/[key]`

| 項目 | 内容 |
|---|---|
| 応答 200 | `{ key, data, sha, updatedAt, manifest, history: [{commit, note, createdAt}] }`。`updatedAt` は `history[0]?.createdAt ?? null` |
| 読み出し元 | 常に GitHub（`?ref=<branch>`, `cache:"no-store"`）。同梱 JSON は読まない（§7.11） |
| 404 / 503 | 未知のキー・ファイル無し / `store_unavailable` |

### 9.3 `PUT /api/addiction-admin/documents/[key]`

| 項目 | 内容 |
|---|---|
| 認証・CSRF | 変更なし（`checkCsrf` + `requireAdminApi`） |
| リクエスト | `{ baseSha: string, data: object, note: string \| null }` |
| 処理順 | `normalizeDocument` → `formatDocument` → `validateDocument` → `writeDocument`（現行と同じ。trailer-admin 計画 §9.1 の決定を維持） |
| 応答 200 | `{ data, sha, commit: string \| null, createdAt, unchanged }` |
| 400 | body が壊れている / `baseSha` が 40 桁の16進でない |
| **403** | **新規**。`VERCEL_ENV === "preview"` での書き込み（§7.6） |
| 404 | 未知のキー |
| 409 | `{ error:"conflict", sha }`（`sha` は読み直した最新値。§7.2 の再試行後） |
| 422 | `{ error:"validation_failed", errors }`（変更なし） |
| 500 / 503 | `server_misconfigured` / `store_unavailable` |

直列化は §7.13。コミットメッセージは §7.7。

### 9.4 `PATCH /api/addiction-admin/documents/[key]`

`{ baseSha, ops, note }`。処理は現行の `applyOps` をそのまま使い、書き込みだけ `writeDocument` に
差し替える。応答・エラーは PUT と同じ。

### 9.5 `POST /api/addiction-admin/documents/[key]/revert`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ commit: string }`。**`/^[0-9a-f]{7,40}$/` に一致しなければ 400**（URL に埋める値なので先に検証する） |
| 処理 | `readAt(key, commit)` で当時の内容 → **現在の `sha` を読み直して** `writeDocument` |
| 応答 200 | `{ data, sha, commit, createdAt }` |
| コミットメッセージ | `content(<key>): abc1234 から復元` |
| 404 | そのコミットに当該ファイルが無い / ローカル（`readAt` が null） |
| 検証 | **現行どおり検証・変換を通さない**（trailer-admin 計画 §9.3 の帰納法: 今後書かれる版はすべて検証済みなので、過去の版も検証済み） |

### 9.6 `POST /api/addiction-admin/login` / `logout`

パスの移動、`login` からの `session_version` 読み出しの削除（§7.5）、レート制限の差し替え（§7.4）。
リクエスト / 応答の形は**完全に不変**。

---

## 10. Database Plan

**データベースを廃止する。** マイグレーションではなく撤去である。

### 10.1 撤去するスキーマ

`content_documents` / `content_revisions` / `login_attempts` / `admin_settings` / `schema_migrations` と
索引 `idx_revisions_doc` / `idx_login_attempts_updated`。定義は `scripts/db-migrate.mjs`（削除する）と
`docs/implementation-plan.md` §10.2（履歴として残す）にある。

### 10.2 データの回収と整形の正規化（最優先。task_001）

1. 本番 DB・dev DB を `backups/turso-export-<日付>/` へ書き出す（`.gitignore` 済み）。接続情報は
   `.dev.vars.prod-reference` / `.dev.vars`（dev/prod の2本立て。中身は転記しない）。
2. **現状の baseline が本番 DB の内容と一致しているか**を先に確かめる: `.dev.vars` は dev DB を
   指すので、本番 DB の書き出しと dev DB の書き出しを比較し、両者と `content/*.json` の3者で
   deep-equal + コードポイント配列比較を行う。
3. 食い違いがあれば `content_revisions.created_at` で管理画面編集の有無を判定し、**DB 側が新しければ
   `content/*.json` に取り込む**。
4. 11ファイルを §7.13 の直列化で書き直す（DB と一致していても行う。整形の正規化）。
5. `npm run verify:coverage` / `npm run build` / `npm run verify:text` を通してコミットする。
   `verify:text` は現時点ではまだ DB 経路で動く（`.dev.vars` を読む）ので、dev DB も本番と同じ内容に
   そろえてから実行する（従来の同期手順は deploy → seed の順、ただし本タスクは
   コードを変えないので seed だけでよい）。

### 10.3 ロールバック

- **本文**: Git の履歴から戻す（`git revert` または管理画面の復元）。
- **構成**: 本計画のコミットを revert すると Turso 依存が復活するが、Turso のインスタンスと環境変数が
  残っている必要がある。→ 移行完了後 **2週間**は Turso のインスタンスと `.dev.vars.prod-reference` を
  消さない（§17-4）。

### 10.4 撤去の副作用

`vercel.json` の `hnd1` 固定は根拠（DB が近い）を失うが、**触らない**（変更の面積を増やさない）。
`CLAUDE.md` の理由書きだけ直す。

---

## 11. File-by-File Plan

### 11.1 新規作成

| ファイル | 目的 | 内容 | リスク |
|---|---|---|---|
| `lib/content/store.ts` | 保存層の契約 | `ContentStore` 型、`getContentStore()`（§7.1 の選択規則）、`gitBlobSha(text)`（Web Crypto）、`serializeDocument(data)`（§7.13） | 中 |
| `lib/content/store-github.ts` | GitHub 実装 | Contents API GET/PUT、Commits API、409 再試行規則、`VERCEL_ENV==="preview"` の拒否、タイムアウト | **高**（外部 API。A2 未実測） |
| `lib/content/store-fs.ts` | ローカル実装 | `node:fs` で `content/<key>.json` を読み書き。`history()` 空、`readAt()` null | 低 |
| `scripts/verify-blob-sha.mjs` | 回帰テスト | 11件で「直列化 → `gitBlobSha`」が `git hash-object` と一致。`node` 単体で動く（`tsx` 不要） | 低 |

### 11.2 書き換え

| ファイル | 目的 | 変更内容 | リスク |
|---|---|---|---|
| `content/*.json`（11件） | 回収と正規化 | §10.2 | 中（値は不変。`verify:text` で担保） |
| `lib/admin/documents.ts` | 保存層の載せ替え | 全 SQL を削除し `getContentStore()` 経由に。型を `sha` / `commit` に | 高 |
| `lib/admin/rate-limit.ts` | DB 依存の除去 | プロセス内 `Map` 実装へ書き換え。fail-open。上限1000件。`getClientIp` は `x-forwarded-for` 優先に | 中 |
| `lib/admin/session.ts` | DB 依存の除去 | `getDbClient` の import と `session_version` 照合ブロックを削除。`redirect()` のパスを `/addiction-admin/login` へ | 中 |
| `lib/content/load.ts` | 公開読み出し | 「同梱 JSON を返す」だけに。**シグネチャ（`async`, `cache()`）は変えない**（呼び出し側11箇所を触らない） | 低 |
| `app/(public)/*.tsx` 8ファイル | 静的化 | `export const dynamic = "force-dynamic"` の1行を削除（§3.5 で出力不変を実測済み） | 中 |
| `open-next.config.ts` | コメント | 「全ルートが force-dynamic」という理由書きを実態に合わせる（設定は変えない） | 低 |
| `app/api/admin/**` → `app/api/addiction-admin/**` | URL 変更 + 契約 | `git mv` + `session_version` 削除(login) + `listDocuments()` への統一(documents) + sha/commit 契約 | 高 |
| `app/(admin)/admin/**` → `app/(admin)/addiction-admin/**` | URL 変更 | `git mv` + 参照修正 | 中 |
| `…/addiction-admin/login/page.tsx` | URL 変更 | `PageProps<"/addiction-admin/login">`、`startsWith("/addiction-admin")`、fallback、コメント。開放リダイレクト対策の `!startsWith("//")` は維持 | **高**（型が合わないとビルドが落ちる） |
| `…/addiction-admin/page.tsx` | URL + 文言 + 表示 | `requireAdminSession("/addiction-admin")`、`href`、§8.1 の文言、「版」列の削除、§8.4 の 503 文言 | 中 |
| `…/addiction-admin/docs/[key]/page.tsx` | URL + 型 | `requireAdminSession(...)`、`initialSha` / `initialHistory` | 中 |
| `…/addiction-admin/docs/[key]/DocumentEditor.tsx` | 契約 + 文言 | `/api/addiction-admin/...` 2箇所、`href`、`baseSha`、§8.2 の見出し、履歴表、§8.1 の文言、403/404 の分岐 | 高 |
| `…/addiction-admin/LogoutButton.tsx` | URL 変更 | `/api/addiction-admin/logout`、`router.replace("/addiction-admin/login")` | 低 |
| `next.config.ts` | libsql 撤去 | `outputFileTracingIncludes` ブロック（コメント込み）を削除 | 中（`opennextjs-cloudflare build` で確認） |
| `package.json` | 依存・スクリプト | `@libsql/client` / `db:migrate` / `db:seed` を削除、`verify:blob-sha` を追加 | 低 |
| `package-lock.json` | 依存 | `npm install` で再生成（手で編集しない） | 低 |
| `scripts/verify-text.sh` | DB 依存の除去 | 43-58行（`.dev.vars` を読んで起動する分岐）を削除し、`npx next start` 一本に。コメントも実態に合わせる | 低 |
| `.env.example` | 環境変数 | TURSO 2つを削除、`GITHUB_CONTENT_*` 3つと `CONTENT_STORE` を追加、`/admin` → `/addiction-admin` | 低 |
| `README.md` | 記述 | `/admin` 2箇所、保存先の説明、「デプロイは不要」→「保存すると自動でデプロイされる（1〜2分）」 | 低 |
| `CLAUDE.md` | 記述 | Turso・環境変数の数・`db-seed` による復旧手順・検証コマンド一覧・`/admin`・Cloudflare の非対称（§7.9） | 低 |
| `docs/deploy-vercel.md` | 引き継ぎ | §0/§2/§3/§4/§5/§7 を全面改訂。PAT の発行者と作り方、Production スコープのみ、WAF ルール、Turso 節の削除、上限の数値、Cloudflare | 低 |

### 11.3 削除

| ファイル | 行数 | 理由 |
|---|---|---|
| `lib/db.ts` | 22 | libsql の唯一の入口 |
| `scripts/db-migrate.mjs` | 109 | スキーマが無くなる |
| `scripts/db-seed.mjs` | 156 | 投入先が無くなる |
| `scripts/load-dev-vars.mjs` | 41 | 利用者が上記2つだけ |

### 11.4 触らないもの（明示）

**`verification/baseline.fingerprint.json` と `verification/baseline/`**（§3.5。本計画で更新しない）/
`lib/admin/auth.ts` / `lib/admin/request.ts` / `lib/admin/ops.ts` / `lib/content/manifest-core.ts` /
`lib/content/manifest.ts` / `lib/content/youtube.ts` / `lib/content/types.ts` / `lib/content/documents.ts` /
`app/(admin)/admin.css` / `app/(admin)/layout.tsx` / `components/**` / `app/globals.css` /
`scripts/verify-coverage.mjs` / `scripts/verify-youtube-id.mjs` / `scripts/snapshot.sh` /
`scripts/fingerprint.mjs` / `scripts/hash-password.mjs` / `vercel.json` / `wrangler.jsonc` / `AGENTS.md` /
`docs/implementation-plan.md` / `docs/task-list.json` / `docs/acceptance-checks.json` / `docs/PROGRESS.md` /
`docs/plans/tasks/**` / `docs/reviews/**` / `docs/plans/trailer-admin/**`（履歴。追記も書き換えもしない）/
`FieldEditor.tsx` / `InlineEditor.tsx`。

---

## 12. Implementation Order

依存関係と「壊れている時間を最短にする」ことを優先した順序。**1タスク = 1コミット**で、
**どのコミットでも `npx tsc --noEmit` / `npm run build` / `npm run verify:text` が通る**
（v1 の「task_005 では tsc が落ちる」を無くした）。fail-closed な2モジュールは `lib/db.ts` を
消す前に書き換える。

| # | task_id | 内容 | 見積(人日) |
|---|---|---|---|
| 1 | `task_001` | 本番 DB の内容を `content/*.json` へ回収し、11ファイルの整形を正規化する（§10.2） | 0.5 |
| 2 | `task_002` | `/admin` → `/addiction-admin`（挙動不変） | 0.5 |
| 3 | `task_003` | `ContentStore` 契約 + ローカル FS 実装 + blob sha + 直列化 + 回帰テスト | 0.75 |
| 4 | `task_004` | GitHub 実装（**検証用ブランチで 409 の挙動を実測してから**） | 1.0 |
| 5 | `task_005` | `lib/admin/documents.ts` と管理 API 5本を新契約へ（1コミット） | 0.75 |
| 6 | `task_006` | 管理 UI を新契約へ + 文言（§8） | 0.75 |
| 7 | `task_007` | レート制限をメモリ実装へ（§7.4） | 0.25 |
| 8 | `task_008` | セッションの DB 照合を撤去（§7.5） | 0.25 |
| 9 | `task_009` | `load.ts` を同梱 JSON 専用に + 公開8ページの静的化（baseline 不変） | 0.25 |
| 10 | `task_010` | Turso 撤去（`lib/db.ts`・依存・scripts・config）+ `verify-text.sh` の DB 依存除去 | 0.5 |
| 11 | `task_011` | ドキュメント追随 | 0.5 |
| 12 | `task_012` | 検証用 Vercel プロジェクトで全経路を実測し、文言と引き継ぎ手順を確定する | 1.0 |

**合計 7.0 人日**（履歴 UI あり = 案①）。**案②（履歴なし）は 6.0 人日**
（task_004 / 005 / 006 / 012 から履歴・復元ぶんが各 0.25 落ちる）。

> v1 の 8.25 / 6.5 から減った理由: baseline 再生成タスク（v1 task_012）が不要になった（§3.5）、
> task_005/006 の統合、`verify-text.sh` の変更を Turso 撤去に吸収。増えた理由: task_001 に整形の
> 正規化を足した（v1 は「一致しなければ考える」で見積もりに入っていなかった）。

### task_012 の実行環境（v1 から追加）

先方の Vercel は制作側が操作しない方針（`docs/deploy-vercel.md` §0）なので、「本番で保存して
実測する」を先方環境では行えない。代わりに**制作側の Vercel（Hobby。§3.8）に検証用プロジェクトを
作り、そこで全経路を実測する**。

| 設定 | 値 |
|---|---|
| プロジェクト | `addiction-film-fes-staging`（Import: 本リポジトリ） |
| Production Branch | **`cms-staging`**（`main` から切る。`main` を汚さない） |
| 環境変数（Production のみ） | `GITHUB_CONTENT_TOKEN`（**sawanori 名義**の fine-grained PAT。§7.6 の権限）/ `GITHUB_CONTENT_REPO` / `GITHUB_CONTENT_BRANCH=cms-staging` / `ADMIN_PASSWORD_PBKDF2`（検証用）/ `ADMIN_SESSION_SECRET`（検証用） |
| 実測項目 | 保存 → コミット → デプロイ開始 → Ready → 反映の各時刻（A5）／連続保存のキャンセル／変更なし保存でコミットが増えない／Preview URL からの保存が 403（このときだけ Preview にもトークンを入れる）／**コミットの author が所有者と一致してデプロイが起動する**（§7.6） |
| 後始末 | 実測値を `docs/deploy-vercel.md` と §8.1 の文言に反映。プロジェクトは残しても消してもよい（残す場合はステージング環境として文書化） |

先方環境での立ち上げは `docs/deploy-vercel.md` の手順で先方が行い、制作側は「保存が
コミットになり、デプロイが走り、公開に出る」ことを先方の URL で確認する（操作はしない）。

---

## 13. Verification Commands

```bash
npx tsc --noEmit                      # 型チェック（PageProps の typo はここで落ちる）
npm run lint                          # ESLint（既存の指摘件数から増えないこと）
npm run build                         # 本番ビルド
npm start                             # 本番ビルドの起動（手動確認用。管理画面を試すなら CONTENT_STORE=fs）
npm run verify:coverage               # 全リーフが manifest から編集できるか
node scripts/verify-youtube-id.mjs    # 予告編の動画URL→動画ID変換
node scripts/verify-blob-sha.mjs      # 本計画で追加。直列化 + blob sha が git hash-object と一致
npm run verify:text                   # 公開8ルートの DOM パス比較（baseline は変更しない）
```

**`npm run verify:text -- --update` は本計画では実行しない。** すべてのタスクで「現在の baseline と
完全一致」を要求する。差分が1件でも出たら、その変更がDOMを変えたということなので実装を止めて
原因を調べる（§15）。

**削除するコマンド**: `npm run db:migrate` / `npm run db:seed`。CLAUDE.md の「試し書きを戻す」手順は
`git checkout -- content/` に置き換わる。

---

## 14. Acceptance Criteria

1. **本番 DB の11キーと `content/*.json` の一致を実測した記録**があり、11ファイルが §7.13 の直列化で
   書かれている（`node scripts/verify-blob-sha.mjs` が exit 0）。値は変わっていない（`verify:text` 一致）。
2. `https://<URL>/addiction-admin` にログインでき、`/admin` と `/api/admin/*` は **404**。
3. 管理画面で本文を編集して保存すると、対象ブランチに `content/<key>.json` のコミットが1つできる。
   差分が**変更した行だけ**。メッセージは §7.7 の形式。
4. **そのコミットで Vercel のデプロイが自動的に始まる**（author が所有者と一致。§7.6）。完了後に
   公開ページへ反映され、**反映までの実測時間**が §8.1 の文言と食い違っていない。
5. 保存直後に管理画面を再読み込みすると、再ビルド完了前でも保存した内容が出る（§7.11）。
6. 2つのタブで同じドキュメントを開き、片方で保存したあともう片方で保存すると **409** になり、
   先の変更が消えない。
7. 何も変えずに保存すると **コミットが増えない**（`unchanged: true`）。
8. 履歴表にコミットが20件まで出る。任意の版を選んで戻すと、**新しいコミットとして**書き戻される。
   編集画面の「最終保存」と履歴表の先頭行が同じコミットを指す。
9. 同じインスタンスに6回ログイン失敗すると 429。WAF ルールの手順が文書化されている。
10. `ADMIN_SESSION_SECRET` を変えて再デプロイすると、既存のログインが全部切れる。
11. `GITHUB_CONTENT_TOKEN` を Preview に入れた状態でも、プレビュー URL からの保存は **403**。
12. 環境変数を1つも設定しない状態でも `npm run build` が通り、公開8ページが 200。管理画面は 500。
13. `npx tsc --noEmit` / `npm run build` / `npm run verify:coverage` / `node scripts/verify-youtube-id.mjs` /
    `node scripts/verify-blob-sha.mjs` がすべて通る。`npm run lint` の指摘が増えていない。
14. **公開8ページの出力が移行前と変わっていない**: `npm run verify:text` が**変更していない baseline**に
    対して完全一致。`git log -- verification/` に本計画のコミットが無い。
15. `npm run build` の出力で公開8ルートが `○ (Static)`。
16. `@libsql/client` が `package.json` / `package-lock.json` から消え、`grep -rn 'libsql\|TURSO_\|getDbClient'
    lib/ app/ components/ scripts/` が0件。
17. `opennextjs-cloudflare build` が通る（Cloudflare 版が壊れていない）。
18. `docs/deploy-vercel.md` を読んだだけで、GitHub を知らない人が「自分名義の PAT を作り、Vercel に
    登録し、WAF ルールを置く」ところまでできる。

---

## 15. Repair Loop

1. §13 の検証コマンドを実行する。
2. エラー出力を**そのまま**記録する（要約しない）。
3. エラーを `task-list.json` の `task_id` に対応づける。
4. **対応するタスクの `files_to_modify` / `files_to_create` に挙がっているファイルだけ**を直す。
5. 検証コマンドを再実行する。
6. 実装が計画と食い違ったら、コードではなく**本計画書を先に更新**してから進める。

注意する分岐:

- **`verify:text` に差分** → baseline を更新して通してはいけない。`verification/current/` と
  `verification/baseline/` を直接 diff して原因を特定する。task_001（値の変化）か task_009（静的化）が
  疑わしい。静的化で差分が出た場合は §3.5 の実測条件（環境変数なし・`next start`）と比べる。
- **`tsc` が `PageProps` で落ちる** → `login/page.tsx` の型引数が旧パスのまま。
- **管理画面が 500** → `getContentStore()` が null。§7.1 の表で条件を確認する。
- **保存が常に 409** → `sha` の取り違え。`node scripts/verify-blob-sha.mjs` で直列化と sha を確認する。
- **保存は成功するのに Vercel のデプロイが始まらない** → コミットの author を `gh api repos/<repo>/commits/<sha>`
  で見る。**Vercel 所有者と別のアカウント**なら §7.6 の発行者条件違反。所有者名義の PAT に差し替える。
  それでも起動しなければ、Vercel の Deploy Hook を保存後に叩く経路（§17-6）を検討する。
- **`opennextjs-cloudflare build` が `@libsql/isomorphic-ws` で落ちる** → 依存の削除が中途半端。
- **ログインが常に 429** → `rate-limit.ts` の fail-closed が残っている。
- **セッションが常に 401** → `session.ts` の DB 照合が残っている。
- **Cloudflare 版で保存が「成功」するのに GitHub に出ない** → `LocalFsStore` が選ばれている。
  §7.1 の規則（本番ビルドでは明示指定が無い限り FS を選ばない）が守られていない。

---

## 16. 敵対的レビューの結果と採否（v1 → v2）

レビュー担当: Fable 5.1。出所の「実測」は本セッションでの実行結果、「一次資料」は §3.8 / §3.9 に
挙げた Vercel / GitHub / Next のドキュメント。

| # | 指摘 | 出所 | 採否 | 対応 |
|---|---|---|---|---|
| 1 | 「Git 化で preload 1件の差分が恒久的に出るので baseline を作り直す」は誤り。静的生成すると現在の baseline と完全一致する | 実測（§3.5） | **採用** | v1 task_012（baseline 再生成）を削除。全タスクで `verify:text` 完全一致を要求。`verification/` を「触らない」に明記 |
| 2 | Hobby は所有者のコミットしかデプロイを起動しない。v1 はこの制約を扱っておらず、A6「制作側が PAT を発行して渡す」は破綻する | 一次資料（Vercel KB） | **採用** | §7.6 に発行者条件、A6 改訂、§14-4 と §15 に検出手順 |
| 3 | `JSON.stringify(…, null, 2)` は11ファイル中9件を再現しない。初回保存で整形差分が数百行出る | 実測（§3.7） | **採用** | §7.13 新設。task_001 で正規化コミット。`verify-blob-sha.mjs` を「直列化 + sha」の検証に拡張 |
| 4 | 案B の読み出し元が `raw.githubusercontent.com` になっている。raw は CDN でキャッシュされ鮮度を制御できない | レビュー | **採用** | §7.3 の表を Contents API + `unstable_cache` に訂正 |
| 5 | 案B の実現可能性を正しく記す: Data Cache は Hobby で使え、`revalidateTag` は 300ms で全リージョンへ伝播 | 一次資料 | **採用** | §3.8 / §7.3 の表に反映。結論（案A）は維持 |
| 6 | Cloudflare 版は incremental cache を外しているため、案B だと `unstable_cache` が効かず毎リクエスト GitHub を叩く | 実測（`open-next.config.ts`） | **採用** | §7.3 の案B 行に追記（案A を採る理由の補強） |
| 7 | 「版」に blob sha（編集画面）と commit sha（履歴表）が混在し、同じ列で値が一致しない | レビュー | **採用** | §8.2: 表示は commit のみ。blob sha は非表示 |
| 8 | ダッシュボードの「最終更新（全体）」は現行より情報が減る。11並列で足りる | レビュー | **採用** | §7.11 をドキュメント別の最終コミット日時に |
| 9 | 保存先の選択規則「`VERCEL` が無ければ FS」は Cloudflare で `LocalFsStore` に落ちる | レビュー | **採用** | §7.1 の規則を「本番ビルドでは明示指定が無い限り FS を選ばない」に |
| 10 | blob sha は `node:crypto` でなく Web Crypto（`auth.ts` と同じ流儀、workerd でも動く） | レビュー | **採用** | §7.2 |
| 11 | 同一リポジトリへの並行 PUT は ref 衝突で 409 になりうる。blob sha が同じなら1回再試行 | 一次資料（GitHub） | **採用** | §7.2 の 409 規則 |
| 12 | v1 task_005 は「tsc が落ちる中間コミット」。1タスク=1緑コミットに反する | レビュー | **採用** | task_005 に API 5本を統合 |
| 13 | 外部呼び出しにタイムアウトが無く、GitHub 停止時に関数上限までぶら下がる | レビュー | **採用** | §7.1 に `AbortSignal.timeout(10_000)` |
| 14 | revert の `commit` を検証せず URL に埋めている | レビュー | **採用** | §9.5 に正規表現検証 |
| 15 | A4（WAF のプラン要件）は一次資料で確定できる。Hobby で1ルール、窓は最長10分 | 一次資料 | **採用** | §7.4 に設定値。A4 を確定に |
| 16 | A3（Hobby の上限）は一次資料で確定できる。100/日 | 一次資料 | **採用** | §7.8。A3 を確定に |
| 17 | v1 task_014「本番で実測」は、先方の Vercel を操作しない方針と矛盾する。制作側の Vercel に本リポジトリのプロジェクトは無い | 実測（Vercel MCP） | **採用** | task_012 を制作側の検証用プロジェクト（`cms-staging`）に定義 |
| 18 | PUT 応答に `commit` が無く、UI が履歴の先頭に楽観的に足す行を作れない | レビュー | **採用** | §9.3 / §8.3 |
| 19 | `note` の長さ上限が無い | レビュー | **採用** | §7.7 で 500 文字 |
| 20 | 見積もりの再計算 | レビュー | **採用** | §12: 7.0 / 6.0 人日 |
| 21 | `updateTag` は Server Actions 専用、`revalidateTag` は2引数、という v1 の記述 | 一次資料 | 維持 | §3.9 に整理して残す |
| 22 | `hnd1` 固定は触らない | レビュー | 維持 | §10.4 |
| 23 | メモリのレート制限を消して WAF だけにする | レビュー（自己指摘） | **不採用** | 先方の手作業に全面依存する構成になる。`LoginForm` 無変更で素朴な連続試行を止められる（§7.4） |
| 24 | ローカルの履歴を `git log` で出す | v1 §7.12 | **不採用** | v1 と同じ理由（子プロセスを Next に持ち込まない） |
| 25 | Deploy Hook を保存後に常に叩くコードを入れる | レビュー（自己指摘） | **不採用** | 発行者条件（§7.6）を守れば不要。実測で起動しなかった場合の手段として §17-6 に残す |
| 26 | v1 §9.3「`JSON.stringify` が既存11ファイルとバイト一致することを task_003 で確定する」 | v1 | **別解** | 一致しないことが実測で判明したので、確認ではなく正規化（#3）に置き換えた |

---

## 17. 申し送り（本計画のスコープ外）

1. **Cloudflare Workers 版の撤去。** Vercel への切り替えが済んだら `wrangler.jsonc` /
   `open-next.config.ts` / `cloudflare-env.d.ts` / `package.json` の `*:cf` / `@opennextjs/cloudflare` /
   `wrangler` を消せる（`docs/deploy-vercel.md` §7）。
2. **Cloudflare 版で管理画面を無効化する**（§7.9 の代替案）。
3. **画像の差し替え機能。** Contents API はバイナリも base64 で置けるが、`public/assets/films/` の
   縮小処理をどこでやるかが未解決。
4. **Turso インスタンスとトークンの削除**（移行完了の2週間後。§10.3）。Cloudflare の
   `wrangler secret delete TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`、Turso 側の DB 削除、
   `.dev.vars` / `.dev.vars.prod-reference` の破棄。
5. **公開ページの実行時 GitHub 取得（§7.3 案B）。** 反映を数秒にしたくなったときの選択肢。
   本計画の `force-dynamic` 除去と GitHub 保存が前提として揃う。Cloudflare 版を撤去（#1）してから。
6. **Vercel Deploy Hook による起動。** 発行者条件を満たせない事情が出た場合、保存後に
   `VERCEL_DEPLOY_HOOK_URL` を POST する経路（数行）で代替できる。
7. **検証用プロジェクトの扱い。** task_012 で作る `addiction-film-fes-staging` を常設のステージングに
   するなら、`cms-staging` ブランチの運用（`main` からの取り込み手順）を決める。

---

## 18. 着手前に利用者へ確認する事項

実装に入る前に、次の3点の判断をもらう。いずれも推奨を示すが、決めるのは利用者である。

| # | 判断事項 | 選択肢 | 推奨 | 理由 |
|---|---|---|---|---|
| 1 | **反映までの時間** | (a) 案A: 保存から公開まで 1〜2分（ビルド反映） / (b) 案B: 数秒（実行時取得 + 無効化。+1.5〜2人日、Cloudflare 版と経路が割れる） | **(a)** | §7.3。経路が1本で説明でき、GitHub 障害時も公開ページが無傷。(b) は後から重ねられる |
| 2 | **履歴と復元の UI** | (①) 管理画面に残す（7人日） / (②) GitHub の画面に任せる（6人日） | **①** | §7.7。「間違えても戻せる」は非技術者の担保 |
| 3 | **API のパス** | (a) `/api/addiction-admin/*` に揃える / (b) `/api/admin/*` のまま | **(a)** | `/admin` を変える目的（決め打ち攻撃の素通し）が API 側にも要る。片方だけ変えると入口が残る |

加えて、task_012 で**制作側の Vercel（Hobby）に検証用プロジェクトを1つ作る**ことの了承を得る
（無料枠内。`main` は使わず `cms-staging` ブランチをデプロイする）。

**決定（2026-09-03、利用者確認済み）**: #1 = (a) 案A、#2 = ①（履歴 UI あり）、#3 = (a)（API も
`/api/addiction-admin/*`）。制作側 Vercel への検証用プロジェクト作成も了承済み。これをもって実装に着手する。
