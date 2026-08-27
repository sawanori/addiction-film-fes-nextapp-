# Vercel へのデプロイ手順（引き継ぎ用）

このリポジトリを GitHub で管理し、Vercel へデプロイするための手順。
2026-08-27 時点の構成に基づく。

現状は Cloudflare Workers にもデプロイできる状態が残してある（`npm run deploy:cf`）。
Vercel へ移したあとも当面は両方動くので、切り替えが済むまで並行させてよい。

---

## 0. 事前に決めておくこと（人が決める。ここだけは自動化できない）

| 決めること | 選択肢 | 補足 |
|---|---|---|
| GitHub リポジトリの持ち主 | 現在は `sawanori/addiction-film-fes-nextapp-`（private 想定） | 先方が管理するなら Transfer するか、先方の Organization に移す。Vercel からは「連携したアカウントが読めるリポジトリ」しか選べない |
| Vercel のアカウント / チーム | 制作側 or 先方 | 請求先と、あとで誰が環境変数を触れるかが決まる。**先方管理にするなら先方のチームで作る** |
| Turso（DB）の持ち主 | 現在は制作側の Turso アカウント | 掲載内容は全部ここに入っている。先方管理にするならDBも移す（後述 §5） |
| 独自ドメイン | 未定 | 決まっていなければ `*.vercel.app` のままで問題ない |

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

## 5. Turso（DB）を先方へ移す場合

掲載内容はすべて Turso に入っている。移管の選択肢は2つ。

**A. データベースごと引き渡す** — Turso の組織/グループを移管するか、
先方のアカウントで新しいDBを作って中身を移す。後者の手順:

```bash
# 1. 現行の内容を books アップ（backups/ は git 管理外）
node scripts/db-migrate.mjs   # 新DBにスキーマを作る
node scripts/db-seed.mjs      # content/*.json を投入
```

投入後に管理画面から入れた変更がある場合は、`content/*.json` にも反映してから
seed するか、旧DBの `content_documents` をコピーする。

**B. 制作側が持ち続ける** — 環境変数だけ Vercel に入っていれば動く。
運用中の編集は管理画面で完結するので、先方が Turso を触る必要はない。

どちらにするかは §0 で決めておく。

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
