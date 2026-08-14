# 引き継ぎ実行計画

最終更新: 2026-08-14 / 執筆: Sonnet（Opus の実測ブリーフに基づく）/ 点検: Opus / ブランチ `main` / HEAD `6e53dc4`

この文書は `docs/implementation-plan.md` を**置き換えない**。あの文書は仕様の正典として残し、
上書き・改変しない。ここに書くのは「正典に書かれた残りの段階（§12 段階0〜4）を、
kimi/codex/gemini への委譲事故を踏まえてどう安全に実行するか」という実行計画である。

---

## 1. 結論

利用者は kimi/codex/gemini への委譲を「全然ダメだった」と評価しており、内訳は
(a) 委譲プロセスの事故、(b) 直近の依頼が成果ゼロ、(c) 成果物の質が低い、の3つ全部。
これを受けて体制を Opus（計画・検証）と haiku（実装）の分業に切り替える。
**次に着手するのは利用者が選択済みの task_003（OpenNext / wrangler 導入）であり、この決定は本文書では再審議しない。**
task_003 の作業指示書は `docs/plans/tasks/task_003.md` に分離して作成した。

---

## 2. 現状（本セッションで Opus が実測した事実のみ）

### 2.1 リポジトリ

| 項目 | 値 |
|---|---|
| ブランチ | `main` |
| HEAD | `6e53dc4` |
| 作業ツリー | クリーン（stash なし・未マージの残骸なし） |
| Node | v22.22.0 |
| npm | 10.9.4 |

### 2.2 検証コマンドの実測値

| コマンド | 終了コード | 出力の要点 |
|---|---|---|
| `npm run build` | 0 | — |
| `npx tsc --noEmit` | 0 | — |
| `npm run lint` | 1 | `✖ 6 problems (2 errors, 4 warnings)`。エラー2件は `components/SiteHeader.tsx`（46:5 `react-hooks/set-state-in-effect`、63:51 `react/no-unescaped-entities`）。着手前からの既存値であり、受け入れ条件は「この6件から増えていないこと」（`docs/implementation-plan.md` §14-1 と同旨） |
| `npm run verify:text` | 0 | `完全一致: 8ルート / 要素1948個 / テキストノード1057個 / コメントノード0個` |

### 2.3 Turso dev DB の実測状態

| テーブル | 行数 |
|---|---|
| `admin_settings` | 1 |
| `content_documents` | 2 |
| `content_revisions` | 2 |
| `login_attempts` | 0 |
| `schema_migrations` | 1（version 1, applied_at 2026-08-13T05:09:57.625Z） |
| `sqlite_sequence` | 1 |

投入済みドキュメントは `legal`（rev1, 1705B）と `tickets`（rev1, 2092B）の2件のみ。
`content/` にある JSON は11件（about / films / index / legal / news / privacy / programme / site / terms / tickets / timetable）。
**したがって未投入は9件。** `scripts/db-seed.mjs` はキーを `basename(file, ".json")` で決めており、
実キーは `tickets` `legal` のような**素のファイル名**である。

### 2.4 環境・外部ツール

| 項目 | 値 |
|---|---|
| `wrangler`（インストール済みか） | 未インストール（`which wrangler` not found、`node_modules/.bin` にも無し） |
| `wrangler` のログイン状態 | **確認済み・ログイン済み**。本セッション中に利用者が `npx wrangler login` を実行し、Opus が `npx --yes wrangler@latest whoami` で確認した。wrangler `4.123.0`、OAuth Token でログイン済み、メール `snp.inc.info@gmail.com`、資格情報の保存先 `/Users/noritakasawada/.wrangler/config/default.toml`、Account Name `Snp.inc.info@gmail.com's Account`、Account ID `d4913e1ffe09be28e048105f883431d0`、終了コード0。task_014（本番反映）の外部ブロッカーはこれで解消済み |
| `@opennextjs/cloudflare` 最新 | `1.20.2`。peerDependencies: `next: ">=15.5.21 <16 \|\| >=16.2.11"`, `wrangler: "^4.86.0"`, `rclone.js: "^0.6.6"`。本プロジェクトは next `16.3.0` のため**対応範囲内** |
| `wrangler` 最新 | `4.123.0` |
| `npx @opennextjs/cloudflare migrate` の挙動 | 公式リポジトリの `migrate.ts` を確認済み。**`@opennextjs/cloudflare@latest` と `wrangler@latest` を実際に npm install する**（package.json / package-lock.json / node_modules を変更する） |
| ディスク空き容量 | 9.5Gi / 460Gi（`df -h /System/Volumes/Data` 最新実測、98%使用）。前任の事故のひとつがディスク枯渇だったため、依存追加の前後で `df -h` を確認する |
| `.gitignore` | 既に `/.wrangler/` `/.open-next/` `.dev.vars` `.dev.vars.*` が入っている。task_003 のスコープにある「.gitignore への追加」は**既に完了済み** |
| `.dev.vars` | `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` / `ADMIN_PASSWORD_PBKDF2` / `ADMIN_SESSION_SECRET` の4つが既に入っている（値の素性＝利用者が意図したパスワードかは未確認） |
| `scripts/verify-text.sh` | 環境変数 `BASE_URL` を渡すと起動済みサーバをそのまま検証できる（`BASE_URL=http://localhost:8787 npm run verify:text`）。preview の検証に新規スクリプトは不要 |

---

## 3. 既存文書に見つかった不整合（訂正リスト）

以下は `docs/PROGRESS.md` と `docs/implementation-plan.md` の記述と実測値の食い違い。
**両文書とも本文書からは改変しない**（改変は実装フェーズの担当タスクで行う）。ここには記録のみ残す。

| # | 該当箇所 | 記述 | 実測との食い違い |
|---|---|---|---|
| 1 | `docs/PROGRESS.md` §6 | `scripts/hash-password.mjs` を「未実装」と記載 | **実在する**（コミット `190651e`） |
| 2 | `docs/PROGRESS.md` §5 | 未投入ドキュメントを「7件」と記載 | `films` と `timetable` が抜けており**実際は9件** |
| 3 | `docs/implementation-plan.md` §10.1 | ドキュメント一覧表のキーを `page.tickets` `page.legal` … と記載 | 実装済みの `scripts/db-seed.mjs` は `tickets` `legal` という**素のファイル名**をキーにしている。manifest（task_011）・管理API（task_012）の設計に影響する |

**#3 についての推奨**: 実装済みの素のファイル名（`tickets` `legal` …）に揃え、`docs/implementation-plan.md` §10.1 を訂正する。
理由は、DB に既に2行（`tickets` / `legal`）が投入済みであり、`page.*` 形式に改名すると再投入とキー移行が別途必要になるため。
この訂正は task_011（manifest 実装）着手前に反映する。本文書は決定の記録のみで、実際の修正は行わない。

---

## 4. 前任の失敗と対応策（委譲ガードレール）

前任で実際に起きた事故（`docs/PROGRESS.md` に記録済み）:

- gemini が対象外ファイル（`app/layout.tsx` / `components/SiteHeader.tsx`）を無断変更し、`dangerouslySetInnerHTML` でXSS対策方針に反する実装をした
- kimi の worktree を `cleanup:true` で早期削除し、未追跡ファイル `content/privacy.json` の中身を一度消失させた
- codex の worktree で `node_modules` シンボリックリンクの中身が消え、システム全体のディスクが120MB空きまで逼迫した
- `--yolo` がこの環境ではシェル実行確認をバイパスできず、各ツールの「ビルド成功」の自己申告が検証されていなかった

これらに対する対応策を、以降のすべての委譲タスクで共通の規律として適用する。

1. **worktree を使わない。** 実装は必ずメインリポジトリの作業ツリー上で行う。隔離は worktree ではなく「クリーンなツリーから開始し、1タスク=1コミット」で担保する。
2. **ファイル白名簿。** 各タスクで作成・変更してよいファイルを事前に列挙する。実装後に Opus が `git status --porcelain` を自分で実行し、白名簿外の変更が1件でもあれば差し戻す。
3. **自己申告を証拠にしない。** `npm run build` / `npx tsc --noEmit` / `npm run lint` / `npm run verify:text` は Opus がメインリポジトリで独立に実行し、その出力のみを合否の根拠にする。実装担当の「成功しました」は根拠として採用しない。
4. **禁止コマンド。** `rm -rf`（特に `node_modules` を対象にするもの）、`git checkout -- ` / `git reset --hard` / `git clean`、`npm run verify:text -- --update`（baseline の更新）、`verification/baseline/` 配下の変更。これらが必要になったら実行せず停止して報告する。
5. **未追跡ファイルの保全。** 破壊的操作の前に必ずコミットする。各タスクはクリーンなツリーから開始する。
6. **タスク粒度。** 実装担当（haiku）には 1タスク = 1つの作業指示書 = 1コミット。指示書には手順のコマンドを逐語で、期待される出力とともに書く。探索や設計判断を実装担当に委ねない。
7. **ディスク監視。** 依存を追加する前と後に `df -h` を実行し、空き容量を報告に含める（直近実測の空きは 9.5Gi しかない）。
8. **不変条件の機械ガード。** `git diff --exit-code -- app/globals.css` が終了コード0であること、`verify:text` が完全一致であること、lint の指摘が6件から増えていないことを、各タスクの完了判定に必ず含める。

---

## 5. 「成果物の質が低い」への対応 — 一致の保証範囲を正直に区別する

DOM完全一致（`npm run verify:text`）は機械的に立証済みだが、これは「表示が変わっていないこと」しか証明しない。
**「管理画面から全ての情報を編集できるか」（編集網羅性）は未立証である。**

これは task_011 の `scripts/verify-coverage.mjs` が `docs/content-inventory.md` の全ノードを manifest から
逆引きして初めて機械的に証明される。それまでは次のとおり正直に区別して扱う。

| 保証されているもの | 保証されていないもの |
|---|---|
| 公開8ルートのDOM構造・文言・classがbaselineと完全一致すること（実測済み） | 11ドキュメントの全フィールドが管理画面の入力欄に対応していること（task_011未着手） |
| 検証ツールの検出力（1文字変更・要素入れ替えを検出できることを実証済み） | 「値をコード定数に残したままDOM diff 0を通過する」抜け道が存在しないこと |

「成果物の質が低い」という評価を繰り返さないためには、各タスクの完了報告に
「何を検証したか／何を検証していないか」を明記する運用を徹底する。

---

## 6. 進め方

体制: Opus が各タスクの作業指示書を書く → haiku がメインリポジトリの作業ツリー上で実装する →
Opus が §4 のガードレールに従い独立に検証する → 合格ならコミット、不合格なら差し戻す。

次に着手するのは **task_003**。作業指示書は `docs/plans/tasks/task_003.md`。
task_003 完了後の task_004 以降も、同じ形式（白名簿・手順・停止条件・完了報告フォーマット）で
1タスクずつ指示書を作成する（本文書はその都度更新しない。着手時に都度作成する）。

`docs/implementation-plan.md` §12 の段階0〜4、§13 の検証コマンド、§14 の受け入れ条件、§15 の修復ループは
そのまま正典として使う。本文書はそれをどう安全に実行するかの運用面のみを扱う。

---

## 7. 品質チェックのループ

利用者からの追加指示: 「実装が完成したら、再度 Opus・codex・gemini 3.5 で品質チェックし、
エラー箇所があれば修正計画書を作成して haiku に作業させる」。これを §6 の実装フローに接続する形で運用する。

### 7.1 ループの形

```
haiku が実装
  → Opus がメインリポジトリで検証コマンド（build / tsc / lint / verify:text）を独立実行
  → Opus・codex・gemini 3.5 の3者が独立に品質レビュー（7.2 の役割分担で並行）
  → Opus が指摘を採否裁定
  → 採用した指摘があれば修正計画書 docs/plans/tasks/<task_id>-fix.md を作成
  → haiku が修正
  → 再検証（Opus が独立実行）
  → 指摘ゼロなら次のタスクへ進む
```

修正計画書1本につき1コミットとする（§4-6 のタスク粒度と同じ規律）。
再検証で新たな指摘が出たら、同じループをもう一周する（`<task_id>-fix2.md` のように連番を振る）。

### 7.2 各レビュアの役割分担（同じことを3回やらせない）

| レビュア | 役割 |
|---|---|
| Opus | 不変条件（DOM完全一致・文言不変・`app/globals.css` 無変更）とガードレール遵守（白名簿外の変更が無いか）の判定。検証コマンドの実行と一次証拠の確保 |
| codex | コードとしての正しさ（設定値の妥当性、エラー処理、Next 16 / OpenNext の規約違反） |
| gemini 3.5 | 計画・仕様との突き合わせ（`docs/implementation-plan.md` の受け入れ条件を満たしているか、指示書のスコープを逸脱していないか） |

### 7.3 実測済みのツール到達性（Opus が本セッションで確認済み）

| 項目 | 実測値 |
|---|---|
| `codex` CLI | `codex-cli 0.139.0` が `/Users/noritakasawada/.local/share/nvm/v22.22.0/bin/codex` にインストール済み |
| `gemini` CLI | `0.38.1` がインストール済み |
| `gemini-3.5-flash` | 応答する（終了コード0） |
| `gemini-3-pro-preview` | 応答する（終了コード0） |
| `gemini-3.5-pro` | **404 で存在しない** |
| `gemini-3-pro` | **404 で存在しない** |

したがって「gemini 3.5」として実際に使うのは `gemini-3.5-flash` である。存在しないモデルID
（`gemini-3.5-pro` / `gemini-3-pro`）を指定しないこと。

### 7.4 レビュー結果の扱い

3者の指摘は「事実誤認・スコープ外・仕様どおり」を理由に却下してよい。却下した指摘も理由とともに記録する
（前任のレビューで `docs/reviews/review-verdict.md` に採否を残したのと同じ運用）。
レビュアの指摘を鵜呑みにして不変条件を壊す修正をしない。

### 7.5 修正計画書のフォーマット

既存の `docs/plans/tasks/task_003.md` と同じ形式（前提・スコープ・白名簿・禁止コマンド・手順・停止条件・
完了の定義・完了報告フォーマット）で `docs/plans/tasks/<task_id>-fix.md` に作成する。
指摘1件ごとに次の4項目を書く:

- **現象**: 何が問題か
- **根拠となる出力**: どのコマンド・どのレビュアの、どの出力がその指摘の根拠か
- **修正内容**: 何をどう直すか
- **検証方法**: 修正後にどのコマンドでどう確認するか
