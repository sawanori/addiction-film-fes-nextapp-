# task_003-fix: 品質チェックで検出された指摘の修正

最終更新: 2026-08-14 / 執筆: Sonnet（Opus の裁定に基づく）/ 実装担当: haiku / 検証担当: Opus（メインリポジトリで独立実行）

この指示書は `docs/takeover-plan.md` §7 の品質チェックループに基づき、task_003 実装後に
Opus・codex・gemini-3.5-flash の3者レビューで検出された指摘のうち**採用したもの**を修正するための作業指示書。
`docs/plans/tasks/task_003.md` と同じ形式で書く。**このタスクでも公開面の見た目・文言は一切変えない。**

---

## 0. 前提（経緯と実測値。ここに無い数値を発明しない）

haiku が task_003（OpenNext / wrangler 導入）を実装し、Opus が独立に検証、そのうえで
Opus / codex / gemini-3.5-flash の3者がレビューした。

### 0.1 現在のリポジトリ状態（重要）

**作業ツリーはクリーンではない。task_003 の変更が未コミットのまま載っているのが正常な状態。**
`git status --porcelain` の期待される出力は次のとおり。これ以外の行があったら着手せず停止して報告する。

```
 M next.config.ts
 M package-lock.json
 M package.json
?? open-next.config.ts
?? public/_headers
?? wrangler.jsonc
```

このタスクの修正を終えると、これに `M eslint.config.mjs` が加わる。
**task_003 の実装と今回の修正はまとめて1コミットにする。haiku はこのタスクでコミットしない。**

### 0.2 Opus が独立実行した検証結果（task_003 実装直後）

| コマンド／確認内容 | 結果 |
|---|---|
| `npm run build` | 終了コード0 |
| `npx tsc --noEmit` | 終了コード0 |
| `npm run verify:text`（`next start` に対して） | `完全一致: 8ルート / 要素1948個 / テキストノード1057個 / コメントノード0個` |
| `npm run verify:text`（OpenNext preview / workerd `http://localhost:8788` に対して。Opus が自分で起動して実行） | 同上の完全一致 |
| `npm ls @opennextjs/cloudflare wrangler next` | 終了コード0、peer dependency 警告なし（`@opennextjs/cloudflare@1.20.2` / `next@16.3.0` / `wrangler@4.123.0` が dedupe 済み） |
| `git diff --exit-code -- app/globals.css` | 終了コード0（無変更） |
| `npm run lint` | **`✖ 14873 problems (366 errors, 14507 warnings)`**（着手前は `✖ 6 problems (2 errors, 4 warnings)`） |

`npm run lint` の悪化が唯一の blocker。他はすべて合格している。

### 0.3 現在の `eslint.config.mjs`（修正前・参考として引用）

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

---

## 1. 対象の指摘（採用分。各指摘は「現象 / 根拠となる出力 / 修正内容 / 検証方法」の4項目で書く）

### 指摘1（blocker・修正する）: ESLint が生成物ディレクトリを走査している

- **現象**: `npm run lint` の指摘が 6 problems から `✖ 14873 problems (366 errors, 14507 warnings)` へ増えた。`docs/implementation-plan.md` §14-1 の受け入れ条件「lint の指摘が既存の 2 errors / 4 warnings から増えていないこと」に違反している。
- **根拠となる出力**: Opus がファイル単位で集計した結果、増加分は `.open-next` が91ファイル、`.wrangler` が2ファイル。残りは既存の `components` 4件・`app` 2件（＝着手前からの6件）。
- **原因**: `package.json` の `"lint": "eslint"` はリポジトリ全体を走査する。`.gitignore` には `/.open-next/` `/.wrangler/` があるが、ESLint 9 のフラット設定は `.gitignore` を参照しないため、`eslint.config.mjs` の `globalIgnores` に無いディレクトリは走査対象になる。
- **修正内容**: `eslint.config.mjs` の `globalIgnores` 配列に `".open-next/**"` と `".wrangler/**"` を追加する。既存の4項目（`.next/**` `out/**` `build/**` `next-env.d.ts`）は消さない。
- **検証方法**: `npm run lint` の最終行が `✖ 6 problems (2 errors, 4 warnings)` に戻ること。エラー2件が `components/SiteHeader.tsx` の46:5と63:51であること。
- **指摘者**: Opus（実測）/ codex（major・同一の修正差分を提示）/ gemini-3.5-flash（blocker）の3者一致。

### 指摘2（minor・修正する）: `package.json` の末尾改行が失われた

- **現象**: `git diff -- package.json` の末尾に `\ No newline at end of file` が出る。migrate が書き戻したときに末尾改行が落ちた。
- **根拠となる出力**: `git diff -- package.json` の最終行 `-}` / `+}` と `\ No newline at end of file`。
- **修正内容**: `package.json` の末尾に改行を1つ足す。**JSONの中身（scripts / dependencies / devDependencies の値）は1文字も変えない。**
- **検証方法**: `git diff -- package.json` に `\ No newline at end of file` が出ないこと。`npm run build` が終了コード0のままであること。
- **指摘者**: Opus。

---

## 2. スコープ

- `eslint.config.mjs` の `globalIgnores` に `.open-next/**` と `.wrangler/**` を追加する（指摘1）
- `package.json` の末尾に改行を1つ追加する（指摘2。JSONの値は変更しない）

### 非スコープ（やらないこと）

- 既存の lint 指摘6件（`components/SiteHeader.tsx` の2エラー・4警告）の修正
- R2 バケットの作成（§4「記録するが直さない指摘」参照）
- 本番デプロイ・DB接続・認証
- `git commit` / `git add`（task_003 本体とまとめて1コミットにするため、コミットはこのタスクの範囲外）

---

## 3. 触ってよいファイルの白名簿

- `eslint.config.mjs`
- `package.json`（末尾改行のみ。中身の値は変更しない）

## 4. 触ってはいけないもの

`docs/plans/tasks/task_003.md` §3 と同一。加えて以下も対象:

- `app/` 配下すべて
- `components/` 配下すべて
- `content/` 配下すべて
- `lib/` 配下すべて
- `app/globals.css`
- `verification/baseline/` 配下すべて
- 既存 `scripts/` 配下すべて
- 日本語の文言すべて
- `wrangler.jsonc` / `open-next.config.ts` / `next.config.ts` / `package-lock.json` / `public/_headers`（task_003 の生成物。このタスクでは触らない）

---

## 5. 禁止コマンド（実行しない。必要になったら停止して報告する）

`docs/plans/tasks/task_003.md` §4 と同一のものに、以下2点を追加する。

- `rm -rf`（特に `node_modules` を対象にするもの）
- `git checkout -- ` / `git reset --hard` / `git clean`
- `npm run verify:text -- --update`（baseline の更新）
- `verification/baseline/` 配下への書き込み
- `wrangler login`
- **既存6件の lint 指摘を修正しない**（`components/SiteHeader.tsx` の `react-hooks/set-state-in-effect` と `react/no-unescaped-entities` は着手前からの既存値であり、後者の `Addiction Int'l Film Festival` のアポストロフィは CLAUDE.md が文言変更を禁止している）
- **`git commit` / `git add` をしない**（task_003 実装分とまとめて1コミットにするため、コミットは haiku の作業範囲外）

---

## 6. 手順

各コマンドの終了コードと出力を必ず記録しながら進める。

### 6.1 着手前確認

```bash
git status --porcelain
```

- 出力が 0.1 の期待どおり（`next.config.ts` / `package-lock.json` / `package.json` が M、`open-next.config.ts` / `public/_headers` / `wrangler.jsonc` が `??`）であることを確認する。**これ以外の行があれば作業せず停止して報告する（クリーンでないのが正常なので、クリーンにしようとしない）。**

### 6.2 `eslint.config.mjs` の修正（指摘1）

`globalIgnores` 配列に `".open-next/**"` と `".wrangler/**"` を追加する。既存の4項目は消さない。

### 6.3 `package.json` の末尾改行の追加（指摘2）

ファイル末尾に改行を1つ追加する。scripts / dependencies / devDependencies の値は変更しない。

### 6.4 lint の確認

```bash
npm run lint
```

- 出力の最終行が `✖ 6 problems (2 errors, 4 warnings)` に戻っていることを確認する。
- エラー2件が `components/SiteHeader.tsx:46:5`（`react-hooks/set-state-in-effect`）と
  `components/SiteHeader.tsx:63:51`（`react/no-unescaped-entities`）であることを確認する。

### 6.5 ビルドと型チェック

```bash
npm run build
npx tsc --noEmit
```

- それぞれの終了コードを記録する。

### 6.6 `next start` 経由の検証

```bash
npm run verify:text
```

- 終了コードと `完全一致: ...` の出力行を記録する。

### 6.7 OpenNext preview 経由の検証

```bash
npm run preview
```

- バックグラウンドで起動し、ログから実際の待受URLを読み取る（task_003 の実測では `http://localhost:8788` だったが、今回も実測してから使うこと。決め打ちしない）。
- 別ターミナル相当で以下を実行する（`<実測URL>` はログの実測値に置き換える）:

```bash
BASE_URL=<実測URL> npm run verify:text
```

- 終了コードと出力を記録する。

### 6.8 preview の停止確認

- preview プロセスを停止したあと、実測したポート番号に対して以下を実行し、出力が空であることを確認する（`<実測ポート>` は 6.7 で確認した値）:

```bash
lsof -nP -iTCP:<実測ポート> -sTCP:LISTEN
```

- 出力が空でなければ、残留プロセスが完全に終了するまで対処し、その経緯を報告に含める。

### 6.9 最終確認

```bash
git status --porcelain
```

- 0.1 の期待出力に `M eslint.config.mjs` が加わった状態になっていることを確認する。`git add` / `git commit` はしない。

---

## 7. 停止条件

以下に該当したら、その場で作業を止めて Opus に報告する。自己判断で回避策を取らない。

- 6.1 の `git status --porcelain` が期待どおりでない場合
- `npm run lint` の最終行が `✖ 6 problems (2 errors, 4 warnings)` に戻らない場合（既存6件以外の指摘が残る、または既存6件の内容が変わっている場合を含む）
- 白名簿外のファイルに変更が必要になった場合
- preview 起動時に追加の認証・アカウント選択・課金同意などを求められた場合
- `npm run build` または `npx tsc --noEmit` が終了コード0以外を返した場合

---

## 8. 完了の定義

- `npm run lint` の最終行が `✖ 6 problems (2 errors, 4 warnings)`（着手前と同一）
- `npm run build` が終了コード0
- `npx tsc --noEmit` が終了コード0
- `npm run verify:text`（`next start` 経由）が完全一致
- `npm run verify:text`（OpenNext preview 経由、`BASE_URL` 指定）が完全一致
- `git diff -- package.json` に `\ No newline at end of file` が出ない
- `git status --porcelain` が 0.1 の期待出力 + `M eslint.config.mjs` のみである

## 9. 完了報告のフォーマット

各コマンドの**終了コードと出力の該当行**を貼ること。「成功しました」だけの報告は不可。
実行していない手順は「未実行」と明記すること。最低限、以下を含める:

1. 6.1 の `git status --porcelain` の出力
2. 6.2 / 6.3 の差分内容（`eslint.config.mjs` と `package.json` の変更箇所そのもの）
3. 6.4 の `npm run lint` の終了コードと最終行
4. 6.5 の `npm run build` / `npx tsc --noEmit` の終了コード
5. 6.6 の `npm run verify:text` の終了コードと出力
6. 6.7 で実測した preview の待受URLと、`BASE_URL` 付き `verify:text` の終了コードと出力
7. 6.8 の `lsof` 出力（空であることの確認）
8. 6.9 の最終 `git status --porcelain` 出力

---

## 10. 記録するが、この修正計画書では直さない指摘

haiku はこれらに手を出さない。

- **R2 バケットが未作成**（codex が major で指摘・採用するが task_003 の範囲では直さない）: `open-next.config.ts` が `r2IncrementalCache` を有効化し、`wrangler.jsonc` が `NEXT_INC_CACHE_R2_BUCKET` / `bucket_name: addiction-film-fes-nextapp-opennext-cache` を宣言しているが、このバケットはまだ作成していない。ローカル preview は通る（miniflare がシミュレートするため実測で完全一致を確認済み）が、`npm run deploy` は成立しない。task_003 の非スコープが「本番デプロイ」であるため今は作らない。**task_014（本番反映）の前提条件として引き継ぐ。** あわせて、計画（`docs/implementation-plan.md` §7.2）が配信方式を `force-dynamic` に決めているため、そもそも R2 増分キャッシュが要るのかを task_010 の時点で判断する必要がある、という論点も記録する。
- **`public/_headers` の配信**（Opus・info）: migrate が `public/_headers` を生成した。Cloudflare の静的アセット用ヘッダ設定ファイルだが、`public/` 配下なので `next start` では `/_headers` として配信される。公開8ルートのDOM比較には影響しない（実測で完全一致）ため許容する。
- **preview サーバの残留**（Opus・process）: haiku は前回「preview を停止した」と報告したが、`lsof -nP -iTCP:8787 -sTCP:LISTEN` で `workerd` プロセスが残っていた（Opus が kill して解消済み）。今回の手順（§6.8）では、preview を停止したあとに `lsof` で LISTEN が消えたことを確認する手順を必ず入れている。

## 11. 却下した指摘（理由とともに記録する）

- gemini-3.5-flash「完了の定義『preview上の8ルート比較』が確認できない」（major）→ **却下**。Opus が OpenNext preview（`http://localhost:8788`）に対して `verify:text` を実行し完全一致を確認済み。レビュー時にこの実測値を渡していなかったこちらの不備であり、指摘自体は成果物の欠陥ではない。
- gemini-3.5-flash「peer dependency 警告が確認できない」（minor）→ **却下**。同上。`npm ls` 終了コード0・警告なしを実測済み。
- gemini-3.5-flash「既存の `app` 2件・`components` 4件の指摘も増加している」→ **却下（事実誤認）**。この6件は着手前から存在する既存値であり、増加分ではない。
