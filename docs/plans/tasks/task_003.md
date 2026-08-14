# task_003: OpenNext / wrangler を導入して Workers 上で現行サイトが動くことを確認する

最終更新: 2026-08-14 / 執筆: Sonnet（Opus の実測ブリーフに基づく）/ 実装担当: haiku / 検証担当: Opus（メインリポジトリで独立実行）

この指示書は `docs/task-list.json` の `task_003` と `docs/implementation-plan.md` §12 段階0の手順2を具体化したもの。
`docs/takeover-plan.md` §4 の委譲ガードレールに従うこと。**このタスクではリポジトリの内容（公開面の見た目・文言）は一切変えない。**

---

## 0. 前提（実測済みの事実。ここに無い数値・コマンド名を推測で書かない）

- リポジトリはブランチ `main` / HEAD `6e53dc4` / 作業ツリークリーン
- Node v22.22.0 / npm 10.9.4
- `wrangler` は未インストール（`which wrangler` not found、`node_modules/.bin` にも無し）
- **wrangler へのログインは完了済み。** 利用者が `npx wrangler login` を実行し、Opus が
  `npx --yes wrangler@latest whoami` で確認した: wrangler `4.123.0`、OAuth Token でログイン済み、
  メール `snp.inc.info@gmail.com`、資格情報の保存先 `/Users/noritakasawada/.wrangler/config/default.toml`、
  Account Name `Snp.inc.info@gmail.com's Account`、Account ID `d4913e1ffe09be28e048105f883431d0`。
  したがって `wrangler login` 自体を実行する必要はない。
- `@opennextjs/cloudflare` の最新は `1.20.2`。peerDependencies は
  `next: ">=15.5.21 <16 || >=16.2.11"`, `wrangler: "^4.86.0"`, `rclone.js: "^0.6.6"`。
  本プロジェクトは next `16.3.0` なので対応範囲内
- `npx @opennextjs/cloudflare migrate` は `@opennextjs/cloudflare@latest` と `wrangler@latest` を
  実際に npm install する（package.json / package-lock.json / node_modules を変更する）
- ディスク空き容量は直近実測で 9.5Gi / 460Gi（98%使用）。前任の事故のひとつがディスク枯渇だったため、
  依存追加の前後で `df -h` を確認する
- `.gitignore` には既に `/.wrangler/` `/.open-next/` `.dev.vars` `.dev.vars.*` が入っている
  （このタスクのスコープにある「.gitignore への追加」は既に完了済みなので、通常は触らなくてよい）
- `scripts/verify-text.sh` は環境変数 `BASE_URL` を渡すと起動済みサーバをそのまま検証できる
  （`BASE_URL=http://localhost:8787 npm run verify:text`）。preview の検証に新規スクリプトは不要
- **migrate が生成する npm scripts の実際の名前と、preview の待受ポートはまだ誰も確認していない。**
  推測で書かず、生成物を実際に開いて確認すること

---

## 1. スコープ

- `npx @opennextjs/cloudflare migrate` の実行
- 生成された `wrangler.jsonc` / `open-next.config.ts` の中身の確認と報告
- preview 上での8ルート fingerprint 比較（`npm run verify:text` を `BASE_URL` 付きで使う）

### 非スコープ（やらないこと）

- 本番デプロイ
- DB接続
- 認証実装
- `.gitignore` の追加（既に完了済み）

---

## 2. 触ってよいファイルの白名簿

- `package.json`
- `package-lock.json`
- `wrangler.jsonc`（migrate の生成物）
- `open-next.config.ts`（migrate の生成物）
- `next.config.ts`（migrate が `initOpenNextCloudflareForDev()` を追加する場合のみ）
- `.gitignore`（既に必要な行はあるので、原則触る必要はない。migrate が新しい行を追加した場合のみ差分を確認して許容する）

上記以外のファイルに変更が生じた場合は、それが migrate コマンドの直接の生成物であることを確認したうえで
完了報告に明記すること。生成物ではない変更が紛れていたら、次の「触ってはいけないもの」に該当しないか確認し、
該当するなら実行前の状態に戻して停止・報告する。

## 3. 触ってはいけないもの

- `app/` 配下すべて
- `components/` 配下すべて
- `content/` 配下すべて
- `lib/` 配下すべて
- `app/globals.css`
- `verification/baseline/` 配下すべて
- 既存 `scripts/` 配下すべて
- 日本語の文言すべて（どのファイルにあっても変更しない）

---

## 4. 禁止コマンド（実行しない。必要になったら停止して報告する）

- `rm -rf`（特に `node_modules` を対象にするもの）
- `git checkout -- ` / `git reset --hard` / `git clean`
- `npm run verify:text -- --update`（baseline の更新）
- `verification/baseline/` 配下への書き込み
- `wrangler login`（ログイン済みのため不要。実行しない）

---

## 5. 手順

各コマンドの終了コードと出力を必ず記録しながら進める。

### 5.1 着手前確認

```bash
df -h /System/Volumes/Data
git status --porcelain
```

- `git status --porcelain` の出力が空である（クリーンなツリーである）ことを確認する。空でなければ実行を止めて報告する。
- `df -h` の空き容量を記録する。

### 5.2 migrate の実行

```bash
npx @opennextjs/cloudflare migrate
```

- 対話プロンプトが出た場合は、内容をそのまま報告し、公開面の挙動を変えない選択（デフォルト・変更なし）を選ぶ。
  判断に迷うプロンプトが出たら選ばずに停止して報告する。

### 5.3 生成物を開いて中身を読み、報告する

以下は**必ず実際にファイルを開いて確認した内容を書く**。推測で埋めない。

- `wrangler.jsonc` の `compatibility_date`
- `wrangler.jsonc` の `compatibility_flags`（`nodejs_compat` が含まれているか）
- `wrangler.jsonc` の `main`（エントリポイント）
- `wrangler.jsonc` の assets 設定（該当ブロックの中身をそのまま引用する）
- `open-next.config.ts` の中身（全文でよい。短いファイルのはず）
- `package.json` の `scripts` に**新規追加された項目**を、キー名も値もそのまま引用する
  （`preview` や `deploy` という名前が付くとは限らない。実際に diff を見て確認する）
- `next.config.ts` に変更があったか（`initOpenNextCloudflareForDev()` の追加有無）

### 5.4 依存関係の確認

```bash
df -h /System/Volumes/Data
```

- migrate 実行後のディスク空き容量を記録し、5.1 の値と比較する。**3Gi を下回っていたら以降の手順を止めて報告する。**

```bash
npm install
```

- 実行後、標準出力・標準エラーに `peer dep` / `peer dependency` を含む警告が出ていないか確認する。
  出ていた場合は該当行をそのまま報告する（「警告なし」と書くなら、grep 等で確認した根拠を示す）。

### 5.5 ビルド

```bash
npm run build
```

- 終了コードと最後の20行程度の出力を記録する。

### 5.6 preview の起動と検証

- `package.json` に追加された preview 系のスクリプト（5.3 で確認した実際の名前）を実行する。
  例: `npm run <実際のスクリプト名>`（`preview` と決め打ちしない）。
- 起動ログに表示された実際の待受URL（ポート番号を含む）を確認する。推測しない。
- 別ターミナル相当で以下を実行する（`<preview のURL>` は起動ログの実測値に置き換える）:

```bash
BASE_URL=<preview のURL> npm run verify:text
```

- 終了コードと出力（`完全一致: ...` の行、または diff の内容）をそのまま記録する。

---

## 6. 停止条件

以下に該当したら、その場で作業を止めて Opus に報告する。自己判断で回避策を取らない。

- **preview 起動時に、ログイン済みの状態にもかかわらず追加の認証・アカウント選択・課金同意などを求められた場合。**
  （wrangler へのログイン自体は完了済みだが、`opennextjs-cloudflare preview` 系のコマンドが
  別途アカウント選択やブラウザでの追加確認を要求する可能性は未確認のため、実際に求められたら停止する。
  利用者本人にしかできない操作を代行しない。）
- ディスク空き容量が 3Gi を下回った場合
- 白名簿外のファイルに変更が必要になった場合
- migrate の対話プロンプトで判断に迷う選択肢が出た場合
- `npm run build` が終了コード0以外を返した場合（原因調査はしてよいが、白名簿外の修正が必要なら停止）

---

## 7. 完了の定義（`docs/task-list.json` の done_definition と同一）

- preview 上の8ルートが baseline と比較して差分0（Next自動生成のchunkハッシュ差を除く）
- `npm run build` が終了コード0
- peer dependency 警告が出ていない

## 8. 完了報告のフォーマット

各コマンドの**終了コードと出力の該当行**を貼ること。「成功しました」だけの報告は不可。
実行していない手順は「未実行」と明記すること。最低限、以下を含める:

1. 5.1 の `df -h` と `git status --porcelain` の出力
2. 5.2 の migrate 実行時の対話内容（あれば）と終了コード
3. 5.3 で確認した `compatibility_date` / `compatibility_flags` / `main` / assets 設定 / `open-next.config.ts` 全文 /
   `package.json` に追加された scripts の実際のキー名と値 / `next.config.ts` の変更有無
4. 5.4 の `df -h`（前後比較）と `npm install` の peer dependency 警告の有無（根拠付き）
5. 5.5 の `npm run build` の終了コードと末尾出力
6. 5.6 で実行した実際のコマンド名・preview の実測URL・`verify:text` の終了コードと出力
7. `git status --porcelain` の最終出力（白名簿との突合用）
