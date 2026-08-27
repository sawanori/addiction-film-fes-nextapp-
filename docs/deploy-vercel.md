# Vercel へのデプロイ手順（引き継ぎ用）

このリポジトリを GitHub で管理し、Vercel へデプロイするための手順。
2026-08-27 時点の構成に基づく。

現状は Cloudflare Workers にもデプロイできる状態が残してある（`npm run deploy:cf`）。
Vercel へ移したあとも当面は両方動くので、切り替えが済むまで並行させてよい。

---

## クイックスタート（先方へそのまま渡せる手順）

1. GitHub の当該リポジトリを clone（または Fork / Transfer で自分のアカウントに置く）
2. Vercel で **Add New → Project → Import**。Framework Preset が **Next.js** になる
3. **Deploy を押す前に**、Environment Variables に4つ登録する（値は制作側から受け取る）
   - `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` / `ADMIN_PASSWORD_PBKDF2` / `ADMIN_SESSION_SECRET`
   - **Production と Preview で値を分ける**（理由は §2。同じにすると
     プレビューURLから本番の掲載内容を書き換えられる）
4. Deploy
5. 発行されたURLで、公開ページの表示と `/admin` のログインを確認する

ビルド設定・出力ディレクトリ・インストールコマンドは**すべて既定のまま**でよい。
Node のバージョンも `package.json` の `engines.node`（22.x）が効くので触らない。

実測済み: まっさらな clone から `npm ci` → `npm run build` が通ること、
**環境変数を1つも入れない状態でもビルドが成功し、公開8ページが 200 で表示される**こと
（その場合はリポジトリ同梱の `content/*.json` の内容が出て、管理画面だけが止まる）。

---

## 0. 方針（2026-08-27 に決定）

**先方がリポジトリを pull し、先方の Vercel アカウントでプロジェクトを立てる。**
制作側は Vercel の操作を代行しない。

そのために先方へ渡すものは2つだけ。

1. **GitHub リポジトリへのアクセス**（現在 `sawanori/addiction-film-fes-nextapp-`）。
   Collaborator に招待するか、Transfer する。Vercel の Import 画面には
   「連携した GitHub アカウントが読めるリポジトリ」しか出ないため、
   **先方自身のアカウントに読める状態**にしておく必要がある。
2. **環境変数4つの値**（§2）。**リポジトリには入っていない**ので別途受け渡す。
   チャットやメールに平文で貼らず、パスワードマネージャの共有機能などを使う。

残る唯一の判断は **Turso（DB）をどうするか**（§5）。
現行DBの接続情報をそのまま渡せば、その日から本番の掲載内容が出る。
先方が自前のDBを持ちたい場合は §5-A の手順で作り直す。

独自ドメインは未定でよい（`*.vercel.app` のままで動く）。

---

## 1. Vercel プロジェクトを作る

1. Vercel で **Add New → Project**
2. GitHub の当該リポジトリを **Import**
3. Framework Preset が **Next.js** になっていることを確認（自動判定される）
4. Build Command / Output Directory / Install Command は**すべて既定のまま**
   （`next build` で通る。Cloudflare 用のコマンドに書き換えないこと）
5. **Deploy を押す前に、次の §2 で環境変数を入れる**

補足:

- Node のバージョンは `package.json` の `engines.node`（`22.x`）が効くので、
  プロジェクト設定で選び直す必要はない。
- `vercel.json` で実行リージョンを **東京（`hnd1`）** に固定してある。
  公開8ページは毎回DBを読む作りなので、DB（Turso の `aws-ap-northeast-1`）と
  近い場所で動かすほうが速い。DBのリージョンを変える場合はここも合わせる。

---

## 2. 環境変数（4つ）

`Project Settings → Environment Variables` に登録する。名前と役割は `.env.example` にも同じものがある。

| 変数名 | 役割 | 未設定だとどうなるか |
|---|---|---|
| `TURSO_DATABASE_URL` | 掲載内容のDBのURL | 公開ページはリポジトリ同梱の `content/*.json` で表示される（落ちない）。管理画面は使えない |
| `TURSO_AUTH_TOKEN` | 同上の認証トークン | 同上 |
| `ADMIN_PASSWORD_PBKDF2` | 管理画面のパスワードのハッシュ | 管理画面が 500（`server_misconfigured`） |
| `ADMIN_SESSION_SECRET` | ログインCookieの署名鍵 | 同上 |

### ⚠ Production と Preview で値を分ける

Vercel は既定で **Production / Preview / Development** の3つに同じ値を入れられるが、
**Preview に本番DBの値を入れてはいけない。**
プルリクエストごとに作られるプレビューURLから `/admin` に入られると、
本番の掲載内容がそのまま書き換わってしまうため。

推奨:

| 環境 | Turso | 管理画面のパスワード |
|---|---|---|
| Production | 本番DB | 本番用 |
| Preview | 開発用DB（別インスタンス） | 開発用（本番と別のものにする） |
| Development | 開発用DB | 開発用 |

開発用DBが不要なら、Preview には Turso の2つを**入れない**という手もある。
その場合プレビューは同梱JSONを表示し、管理画面だけ使えない状態になる。

あわせて `Project Settings → Deployment Protection` で
**Preview の保護（Vercel Authentication）を有効にする**ことを勧める。

### パスワード・鍵の作り方

```bash
# パスワードのハッシュ（平文はどこにも保存しない）
echo -n '設定したいパスワード' | node scripts/hash-password.mjs --iterations 100000

# セッション署名鍵
node -e "console.log(crypto.randomBytes(32).toString('base64'))"
```

`ADMIN_SESSION_SECRET` を変えると、発行済みのログインはすべて無効になる。
パスワードを変えたときに全端末をログアウトさせたい場合は、
DBの `admin_settings.session_version` を +1 する（`docs/PROGRESS.md` §14 に前例がある）。

---

## 3. デプロイの流れ（git 運用）

- `main` に push → **本番デプロイ**
- それ以外のブランチ / プルリクエスト → **プレビューデプロイ**（URLが自動で発行される）

掲載内容の変更は**コードのデプロイとは無関係**である点に注意。
本文はDBに入っているので、管理画面（`/admin`）で保存した時点で公開ページに反映される。
デプロイは要らない。

逆に、`content/*.json` を編集しただけではサイトの表示は変わらない
（あれは初期投入用の正典データとフォールバック）。DBへ反映するには:

```bash
node scripts/db-seed.mjs --force
```

を、対象DBの接続情報を渡して実行する。**実行前に必ずDBを退避すること**
（管理画面での編集を上書きするため。手順は `docs/PROGRESS.md` §15.2）。

---

## 4. 初回デプロイ後の確認

```bash
# 8ルートが 200 で返るか
for r in / /about /programme /tickets /news /privacy /terms /legal; do
  echo -n "$r "; curl -s -o /dev/null -w "%{http_code}\n" "https://<デプロイURL>$r"
done
```

- 管理画面 `https://<デプロイURL>/admin` にログインできるか
- 公開ページの文言がDBの内容（管理画面で見えるもの）と一致しているか
  - 一致していなければ環境変数が入っていない可能性が高い（同梱JSONを表示している）

見た目・文言が変換元の静的HTMLと一致しているかまで見るなら:

```bash
npm run build && BASE_URL=https://<デプロイURL> npm run verify:text
```

---

## 5. Turso（DB）の扱い

掲載内容はすべて Turso に入っている。選択肢は2つ。

### A. 先方が自前のDBを作る

Turso でDBを作ってから、リポジトリのスクリプトでスキーマとデータを入れる。

```bash
# 接続情報を .env.local に書いてから（.dev.vars でも可）
npm run db:migrate   # テーブルを作る（content_documents / content_revisions /
                     #                login_attempts / admin_settings / schema_migrations）
npm run db:seed      # content/*.json の内容を投入する
```

**注意**: `content/*.json` は**リポジトリ同梱の正典データ**であって、現行サイトの
最新状態とは限らない。管理画面から入れた変更は現行DBにしかないので、
最新の内容を引き継ぐなら制作側から現行DBの中身（`content_documents`）を書き出して渡す。

### B. 現行のDBをそのまま使う

制作側の Turso の接続情報（`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`）を渡すだけ。
移行作業もデータ移送も要らず、その日から本番の掲載内容が出る。
運用中の編集は管理画面で完結するので、先方が Turso の管理画面を触る必要はない。

移行期間中に Cloudflare 版と Vercel 版を並行させる場合、**同じDBを見せておくと
両方の表示が自動で揃う**（DBは1つ、フロントが2つという状態になる）。
切り替えが済んだら Cloudflare 側を止める。

---

## 6. 公開前に必ず確認すること

このサイトは**まだ検索結果に出さない設定**になっている。一般公開するときに外す。

| 項目 | 現在 | 公開時 |
|---|---|---|
| `app/layout.tsx` の `metadata.robots` | `noindex, nofollow, noarchive` | 外す |
| `public/robots.txt` | `Allow: /`（noindex を読ませるため） | 必要に応じて `Sitemap:` 行を有効化 |
| `public/sitemap.xml` | ドメインが `https://example.jp/` のまま | 実ドメインに書き換え |
| 掲載情報 | **すべて仮置き**（`PLACEHOLDERS.md` に一覧） | 確定した内容に差し替え |
| `privacy` / `terms` / `legal` | 法務未確認の雛形。本文に〔調整中〕が残っている | 確認を通す |

---

## 7. Cloudflare 版について

`wrangler.jsonc` / `open-next.config.ts` / `npm run deploy:cf` は残してある。
Vercel へ完全に移行して不要になったら、次を消せばよい（消さなくても Vercel 側に害はない）。

- `wrangler.jsonc`、`open-next.config.ts`、`cloudflare-env.d.ts`
- `package.json` の `preview:cf` / `deploy:cf` / `upload:cf` / `cf-typegen`
- 依存の `@opennextjs/cloudflare`、`wrangler`
- `next.config.ts` 末尾の `initOpenNextCloudflareForDev` の呼び出しと
  `outputFileTracingIncludes`（どちらも Cloudflare 向けの回避策）

消す場合は、消したあとに `npm run build` と `npm run verify:text` を通すこと。
