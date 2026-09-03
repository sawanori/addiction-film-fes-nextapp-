# Vercel へのデプロイ手順（引き継ぎ用）

このリポジトリを GitHub で管理し、Vercel へデプロイするための手順。
2026-09-03 時点の構成に基づく。

**掲載内容の保存先はこのリポジトリ自身**である。データベースも外部サービスも要らない。
管理画面で保存すると `content/<key>.json` が GitHub にコミットされ、そのコミットを
Vercel が拾って本番デプロイし、公開ページに反映される。

現状は Cloudflare Workers にもデプロイできる状態が残してある（`npm run deploy:cf`）。
ただし Cloudflare 版は掲載内容の更新に**追随しない**（§7）。

---

## クイックスタート（先方へそのまま渡せる手順）

1. GitHub の当該リポジトリを clone（または Fork / Transfer で自分のアカウントに置く）
2. **自分の GitHub アカウントで fine-grained personal access token を作る**（作り方と
   権限は §2。**制作側が作ったトークンでは公開に反映されない**ので、必ず自分名義で作る）
3. Vercel で **Add New → Project → Import**。Framework Preset が **Next.js** になる
4. **Deploy を押す前に**、Environment Variables に登録する（§2）
   - 必須4つ: `GITHUB_CONTENT_TOKEN` / `GITHUB_CONTENT_REPO` /
     `ADMIN_PASSWORD_PBKDF2` / `ADMIN_SESSION_SECRET`
   - 任意1つ: `GITHUB_CONTENT_BRANCH`（省略時 `main`）
   - **`GITHUB_CONTENT_TOKEN` は Production スコープだけに入れる。**
     Preview には管理画面のパスワードと署名鍵だけを、本番と**別の値**で入れる（理由は §2）
5. Deploy
6. Vercel の **Firewall** にログインのレート制限ルールを1つ置く（手順は §8）
7. 発行されたURLで、公開ページの表示と **`/addiction-admin`** のログインを確認する
8. 管理画面で何か1つ編集して保存し、**1〜2分後**に公開ページへ反映されることを確認する
   （2026-09-03 の実測では 31秒〜102秒。差はビルドのキュー待ち）

ビルド設定・出力ディレクトリ・インストールコマンドは**すべて既定のまま**でよい。
Node のバージョンも `package.json` の `engines.node`（22.x）が効くので触らない。

実測済み: まっさらな clone から `npm ci` → `npm run build` が通ること、
**環境変数を1つも入れない状態でもビルドが成功し、公開8ページが 200 で表示される**こと
（その場合はリポジトリ同梱の `content/*.json` の内容が出て、管理画面だけが止まる）。

---

## 0. 方針（2026-08-27 に決定）

**先方がリポジトリを pull し、先方の Vercel アカウントでプロジェクトを立てる。**
制作側は Vercel の操作を代行しない。

そのために先方へ渡すものは2つ。

1. **GitHub リポジトリへのアクセス**（現在 `sawanori/addiction-film-fes-nextapp-`）。
   Collaborator に招待するか、Transfer する。Vercel の Import 画面には
   「連携した GitHub アカウントが読めるリポジトリ」しか出ないため、
   **先方自身のアカウントに読める状態**にしておく必要がある。
2. **環境変数の値**（§2）。**リポジトリには入っていない**ので別途受け渡す。
   チャットやメールに平文で貼らず、パスワードマネージャの共有機能などを使う。

**`GITHUB_CONTENT_TOKEN` だけは制作側から渡さない。先方が自分の GitHub アカウントで作る**
（理由は §2 の「トークンの発行者」）。先方が GitHub アカウントを持っていない場合は、
アカウントを先方名義で作るところから始める。

データベースは無くなったので、**掲載内容の移送作業も不要**である（§5）。

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
- **Framework Preset は必ず `Next.js` にする。** ダッシュボードの Import なら自動で入るが、
  CLI や API でプロジェクトを作ると未設定（`framework: null`）のままになり、ビルドは成功するのに
  全ページが 404 になる（2026-09-03 の検証用プロジェクトで実測。`Settings → General → Framework Preset`
  を `Next.js` にして再デプロイすれば直る）。
- `vercel.json` で実行リージョンを **東京（`hnd1`）** に固定してある。公開8ページは
  ビルド時に静的生成されるので、この設定が効くのは管理画面まわりの処理だけ。触らなくてよい。

---

## 2. 環境変数

`Project Settings → Environment Variables` に登録する。名前と役割は `.env.example` にも同じものがある。

| 変数名 | 必須 | 役割 | 未設定だとどうなるか |
|---|---|---|---|
| `GITHUB_CONTENT_TOKEN` | 必須 | 掲載内容を GitHub へ書き込むトークン。**Production スコープだけ**に入れる | 公開ページはリポジトリ同梱の `content/*.json` で表示される（落ちない）。管理画面は使えない |
| `GITHUB_CONTENT_REPO` | 必須 | 保存先リポジトリ。`owner/repo` 形式（例 `sawanori/addiction-film-fes-nextapp-`）。Fork / Transfer したら自分のものに書き換える | 同上 |
| `GITHUB_CONTENT_BRANCH` | 任意 | 保存先ブランチ。**省略時は `main`** | 既定の `main` が使われる |
| `ADMIN_PASSWORD_PBKDF2` | 必須 | 管理画面のパスワードのハッシュ | 管理画面が 500（`server_misconfigured`） |
| `ADMIN_SESSION_SECRET` | 必須 | ログインCookieの署名鍵 | 同上 |
| `CONTENT_STORE` | ローカル専用 | 保存先の実装を明示する。`fs` を指定すると `npm start` でも作業ツリーの `content/*.json` に保存する | 通常は未設定でよい。`next dev` は指定しなくても FS を使う |

Vercel に登録するのは上の**必須4つ**（ブランチを変えるなら `GITHUB_CONTENT_BRANCH` を足して5つ）。
`CONTENT_STORE` は Vercel には入れない。

### トークン（PAT）の作り方

GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens** →
**Generate new token**。

| 設定項目 | 値 |
|---|---|
| Resource owner | リポジトリの所有者（Transfer 済みなら自分） |
| Repository access | **Only select repositories** → 対象リポジトリ1つだけ |
| Repository permissions | **Contents: Read and write** だけ（Metadata: Read は自動で付く） |
| そのほかの permissions | **すべて No access** |
| Expiration（有効期限） | 設定する（fine-grained は最長1年） |

Contents の読み書きだけなら、万一漏れても**このリポジトリのファイルを書き換えられる**だけで、
ほかのリポジトリ・組織設定・Actions には触れない。

**有効期限を必ずこの手順書に書き留め、切れる前に更新する。**

| 有効期限 | 更新した日 | 次の更新期限 |
|---|---|---|
| （記入する） | （記入する） | （記入する） |

期限が切れると、管理画面で保存したときに「保存先に接続できません」と出るようになる。
そのときは新しいトークンを同じ権限で発行し、Vercel の `GITHUB_CONTENT_TOKEN` を差し替えて
再デプロイする（公開ページは無事なので、慌てなくてよい）。

### ⚠ トークンの発行者（いちばん間違えやすいところ）

**トークンは、Vercel プロジェクトを持っている本人の GitHub アカウントで発行する。**

Vercel の Hobby プランは **アカウント所有者のコミットしかデプロイを起動しない**
（出所: Vercel の KB「Why aren't commits triggering deployments on Vercel」）。
管理画面の保存で作られるコミットの author はトークンの持ち主になるので、
**制作側が発行したトークンを先方の Vercel で使うと、保存はコミットになるのに
デプロイが走らず、いつまでも公開に反映されない**。

Pro プラン以降ならチームメンバーのコミットでもデプロイされる。

### ⚠ Preview から本番を書き換えられないようにする（3枚重ね）

Vercel は既定で **Production / Preview / Development** の3つに同じ値を入れられるが、
**Preview に `GITHUB_CONTENT_TOKEN` を入れてはいけない。**
プルリクエストごとに作られるプレビューURLの `/addiction-admin` に入られると、
本番の掲載内容がそのまま書き換わってしまうため。`GITHUB_CONTENT_BRANCH` を変えても
**トークン自体が `main` を書ける**ので対策にならない。

塞ぎ方を3つ重ねている。

1. **設定**: `GITHUB_CONTENT_TOKEN` を **Production スコープだけ**に登録する。
   Preview の管理画面は保存先が無いので 500 になる（公開ページは同梱 JSON で動く）。
2. **コード**: プレビュー環境（`VERCEL_ENV=preview`）での保存はコード側で **403** に拒否する。
   1 の設定ミスへの保険なので、こちらは何もしなくてよい。
3. **設定**: `Project Settings → Deployment Protection` で
   **Preview の保護（Vercel Authentication）を有効にする**。あわせて
   `ADMIN_PASSWORD_PBKDF2` は Preview では本番と別の値にする。

推奨:

| 環境 | `GITHUB_CONTENT_TOKEN` | 管理画面のパスワード |
|---|---|---|
| Production | 入れる | 本番用 |
| Preview | **入れない** | 本番と別のもの |
| Development | 入れない | 開発用 |

### パスワード・鍵の作り方

```bash
# パスワードのハッシュ（平文はどこにも保存しない）
echo -n '設定したいパスワード' | node scripts/hash-password.mjs --iterations 100000

# セッション署名鍵
node -e "console.log(crypto.randomBytes(32).toString('base64'))"
```

元にするパスワードは **20文字以上のランダムな文字列**にし、ほかのサービスと使い回さない。
ログイン試行の回数をサーバ側で共有して数える仕組みが無くなったぶん（§8）、
最終的な守りはパスワードそのものの強さになる。

`ADMIN_SESSION_SECRET` を変えると、発行済みのログインはすべて無効になる。
これが**全端末をログアウトさせる唯一の手段**である（手順は §5）。

---

## 3. デプロイの流れ（git 運用）

- `main` に push → **本番デプロイ**
- それ以外のブランチ / プルリクエスト → **プレビューデプロイ**（URLが自動で発行される）

**掲載内容の変更も同じ経路を通る。**

```
管理画面で保存
  → content/<key>.json に 1コミット（GitHub）
  → Vercel が自動で本番デプロイ
  → 公開ページに反映（1〜2分。実測は 31秒〜102秒。§9）
```

覚えておくとよいこと。

- **何も変えずに保存してもコミットは増えない。** 保存しようとした内容が現在のファイルと
  同一なら、コミットを作らずに終わる（無駄なビルドを1本増やさないため）。
- **続けて何回も保存した場合**、Vercel が古いビルドを自動でキャンセルし、最新の1本だけを
  残す。順番が入れ替わることはない。
- **1日にデプロイできる本数には上限がある。** Hobby プランは
  **1日100本 / 1時間100本 / 5分60本**（出所: `vercel.com/docs/limits`）。
  1保存 = 1デプロイなので、会期前に1日数十回更新しても届かない。
  もし上限に当たると、その日はそれ以上デプロイされない
  （**保存＝コミット自体は成功している**ので、翌日のデプロイで反映される）。
- **`content/*.json` を手で編集して push しても同じように反映される。** 管理画面と
  同じファイルを触っているだけなので、経路は1本しかない。

---

## 4. 初回デプロイ後の確認

```bash
# 8ルートが 200 で返るか
for r in / /about /programme /tickets /news /privacy /terms /legal; do
  echo -n "$r "; curl -s -o /dev/null -w "%{http_code}\n" "https://<デプロイURL>$r"
done
```

- 管理画面 `https://<デプロイURL>/addiction-admin` にログインできるか
- **`https://<デプロイURL>/admin` が 404 になるか**（旧URL。残っていたら古いビルドを見ている）
- 管理画面で本文を1箇所だけ編集して保存し、
  1. GitHub の当該リポジトリに `content(<key>): 管理画面から更新` というコミットが1つできるか
  2. そのコミットで Vercel のデプロイが**自動的に始まる**か
     （始まらなければトークンの発行者を疑う。§2）
  3. デプロイ完了後、公開ページに反映されているか。ここで**かかった時間を計る**

見た目・文言が変換元の静的HTMLと一致しているかまで見るなら:

```bash
npm run build && BASE_URL=https://<デプロイURL> npm run verify:text
```

---

## 5. 掲載内容の所在と履歴（GitHub）

掲載内容は **このリポジトリの `content/*.json`（11ファイル）** に入っている。
外部のデータベースは使っていないので、**Vercel へ移すときのデータ移送作業は無い。**
リポジトリを clone した時点で中身も付いてくる。

### 履歴を見る・前の内容に戻す

- 管理画面の編集ページに、そのファイルの**コミット20件**が新しい順で並ぶ。
  日時・メモ欄に入力した文言・コミットの短縮SHAが出る。
- 「この版に戻す」を押すと、その時点の内容を**新しいコミットとして書き戻す**。
  履歴が消えたり巻き戻ったりはしない。戻したあとも1〜2分で公開に反映される。
- **20件より前**を見たいときは、履歴表の下にある GitHub へのリンクから
  そのファイルのコミット一覧を開く。GitHub の画面では差分も見られる。

### トークンの期限が切れたら

症状は「管理画面で保存すると『保存先に接続できません』と出る」。公開ページは
静的に配信されているので**影響を受けない**。§2 の手順で新しいトークンを発行し、
Vercel の `GITHUB_CONTENT_TOKEN` を差し替えて再デプロイする。

### 全端末をログアウトさせたいとき

`ADMIN_SESSION_SECRET` を新しいランダム文字列に差し替えて**再デプロイする**（§2）。
発行済みのログインCookieがすべて無効になる。これが唯一の手段で、
パスワードを変えるだけでは既にログイン済みの端末は切れない。
**パスワード変更（`ADMIN_PASSWORD_PBKDF2` の差し替え）と一緒に行うこと。**

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

**注意: Cloudflare 版は掲載内容の更新に自動で追随しない。**
管理画面の保存先は GitHub なので、保存すると Vercel だけが自動でデプロイし直す。
Cloudflare 側は **`npm run deploy:cf` を打った時点の `content/*.json` のスナップショット**
であり続ける。最新の内容を出すには `npm run deploy:cf` をもう一度実行する。

（Cloudflare 版でも管理画面は動き、保存すれば GitHub にコミットされる。
反映先が Vercel だけ、という非対称になる。）

Vercel へ完全に移行して不要になったら、次を消せばよい（消さなくても Vercel 側に害はない）。

- `wrangler.jsonc`、`open-next.config.ts`
- `package.json` の `preview:cf` / `deploy:cf` / `upload:cf` / `cf-typegen`
- 依存の `@opennextjs/cloudflare`、`wrangler`
- `next.config.ts` 末尾の `initOpenNextCloudflareForDev` の呼び出し

消す場合は、消したあとに `npm run build` と `npm run verify:text` を通すこと。

---

## 8. ログインのレート制限（Vercel WAF ルール）

管理画面のパスワードを総当たりされないための設定。**Hobby プランでも1ルール使える**
（出所: `vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting`）。
デプロイが終わったら入れておく。

1. Vercel のダッシュボード → 対象プロジェクト → **Firewall**
2. **Configure** → **+ New Rule**
3. 条件を2つ置く（AND）
   - **Request Path** が `/api/addiction-admin/login` に **equals**
   - **Method** が `POST` に **equals**
4. **Then** で **Rate Limit** を選ぶ
   - 窓（window）: **10分**（Hobby で選べる最長）
   - 上限: **10回**
   - キー: **IP**
5. **Save Rule** → **Review Changes** → **Publish**

補足:

- カウンタは**リージョン単位**なので、複数リージョンから分散して試行されると
  上限を超えうる。単一IPからの総当たりには十分効く。
- コード側にも、関数インスタンスのメモリ上で「5回失敗したら15分ロック」する
  簡易な制限が入っている。ただしインスタンス単位でしか効かないので、
  **主たる守りはこの WAF ルールとパスワードの強さ**（§2）である。

---

## 9. 実測記録と検証用プロジェクト（制作側）

2026-09-03 に制作側の Vercel（Hobby）に検証用プロジェクト `addiction-film-fes-staging` を作り、
本番ブランチを `cms-staging` にして全経路を実測した。先方の環境ではなく、あくまで「同じ構成が
Vercel で動くこと」の証明用。

| 項目 | 結果 |
|---|---|
| 保存 → GitHub コミット | 1秒（author は Vercel 所有者。fine-grained PAT・Contents のみで動いた） |
| コミット → Vercel ビルド開始 | 1〜3秒（キューが空いているとき）。混んでいると 77秒待った例あり |
| ビルド | 19〜22秒（キャッシュあり）。初回は 36〜43秒 |
| **保存 → 公開ページに反映** | **31秒**（空いているとき）〜 **102秒**（キュー待ちあり） |
| 5秒おきに3回保存 | 1回目 READY → 2回目 **CANCELED** → 3回目 READY（自動キャンセルで最新だけ残る） |
| 何も変えずに保存 | コミットが増えない（`unchanged`） |
| 古い sha で保存 | 409 と最新の sha |
| 履歴から「この版に戻す」 | 新しいコミットとして書き戻され、公開ページも戻る |
| Preview 環境（`VERCEL_ENV=preview`）での保存 | 403（ローカルで本番ビルドを起動して確認） |

検証用プロジェクトは残してある。同じ作業をやり直すときは、`main` の内容を `cms-staging` に
push すれば本番ブランチとしてデプロイされる（`git push --force origin main:cms-staging`）。
不要になったら Vercel のダッシュボードから削除してよい（`main` にも先方の環境にも影響しない）。
