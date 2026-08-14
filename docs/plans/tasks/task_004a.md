# task_004a: 認証コア（`lib/admin/auth.ts`）と `proxy.ts`

最終更新: 2026-08-14 / 執筆: Sonnet（Opus の実測ブリーフに基づく）/ 実装担当: haiku / 検証担当: Opus（メインリポジトリで独立実行）

## 分割方針（Opus の判断）

`docs/task-list.json` の `task_004`（認証基盤 + ログイン画面）は `proxy.ts` / `lib/admin/auth.ts` /
`lib/admin/rate-limit.ts` / `app/(admin)/layout.tsx` / `admin.css` / ログイン画面 /
`/api/admin/login|logout` / `scripts/hash-password.mjs` の10ファイル規模で、1回の委譲としては大きすぎる。
暗号処理（PBKDF2検証・HMAC署名）を含むため慎重に進める必要があり、次の2本に分割する。

- **task_004a（この指示書）**: 認証コアと `proxy.ts`。作るのは `lib/admin/auth.ts` と `proxy.ts` の2ファイルだけ
- **task_004b（次に別途作成する）**: 管理面 Route Group・ログイン画面・`/api/admin/login|logout`・`lib/admin/rate-limit.ts`

**task_004a の完了時点では、ログイン画面はまだ存在せず、`/admin/login` へのリダイレクト先は 404 になる。
これは想定どおりであり、404 を理由に停止しないこと。**

---

## 0. 前提（実測済みの事実。ここに無い数値・記述を推測で書かない）

### 0.1 リポジトリ状態

- HEAD は `5f57ec0`。task_003（OpenNext / wrangler 導入）は完了済み（コミット `cbf8198`）
- **`app/(admin)/` は存在しない。** `app/` 配下にあるのは `app/(public)/` と直下の `layout.tsx` / `globals.css` /
  `favicon.ico` のみ。task_002 は `app/(public)` だけを作っていた
- **`proxy.ts` も `middleware.ts` もリポジトリルートに存在しない**（確認済み）
- 検証コマンドの現在値: `npm run build` 終了コード0 / `npx tsc --noEmit` 終了コード0 /
  `npm run lint` は `✖ 6 problems (2 errors, 4 warnings)` /
  `npm run verify:text` は完全一致（8ルート / 要素1948個 / テキストノード1057個 / コメントノード0個）
- `npm run preview` は OpenNext preview を起動する。待受URLは起動のたびに変わりうる
  （実測で 8787 と 8788 の両方を観測している）。このタスクでは preview の検証は不要だが、
  もし使う場合は必ずログから読むこと（決め打ちしない）

### 0.2 シークレットまわり

- `.dev.vars` の `ADMIN_PASSWORD_PBKDF2` は**利用者が指示したパスワードから生成されたものであることを
  本人が確認済み**。形式は `pbkdf2-sha256$100000$<salt base64 24文字=16バイト>$<hash base64 44文字=32バイト>`
- `.dev.vars` の `ADMIN_SESSION_SECRET` は base64 で44文字 = **32バイト**
- `scripts/hash-password.mjs` は実装済み（コミット `190651e`）。反復回数の既定は 100,000
- **`.dev.vars` の中身を読み取って報告やログに貼らない。** 形式の確認が必要なら「4フィールドある」等の
  構造だけを書く

### 0.3 Next 16 `proxy` の正規仕様（`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` から実際に読み取った内容。推測で書かない）

> **Note**: The `middleware` file convention is deprecated and has been renamed to `proxy`.

基本形（ドキュメント冒頭の例をそのまま引用）:

```tsx filename="proxy.ts" switcher
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}

export const config = {
  matcher: '/about/:path*',
}
```

- ファイルはプロジェクトルート（`app` と同じ階層）に `proxy.ts` として置く
- **関数は named export `proxy` または default export のどちらか一方のみ**（両方は不可。複数の proxy は非対応）
- `config.matcher` は文字列 1 つでも配列でもよい。配列例: `matcher: ['/about/:path*', '/dashboard/:path*']`
- matcher の `source` パターンは `/` で始まり、`:path*`（0個以上）/ `:path?`（0または1個）/ `:path+`（1個以上）の
  修飾子付き named parameter や正規表現が使える
- **matcher が無いと proxy は静的ファイルや `public/` を含む全リクエストで実行される。** 認証ロジックが
  CSS/JS/画像の読み込みを誤ってブロックしないよう、対象を絞るか除外パターンを使うこと（今回は
  `["/admin/:path*", "/api/admin/:path*"]` に絞るのでこの問題は起きない）
- 直接レスポンスを返す例（`Response.json` を使う）:
  ```ts
  export function proxy(request: NextRequest) {
    if (!isAuthenticated(request)) {
      return Response.json(
        { success: false, message: 'authentication failed' },
        { status: 401 }
      )
    }
  }
  ```
- Cookie の取得は `request.cookies.get('name')`（`RequestCookies` API）
- **重要な注意書き（原文引用）**: "Proxy is meant to be invoked separately of your render code and in
  optimized cases deployed to your CDN for fast redirect/rewrite handling, you should not attempt relying
  on shared modules or globals." → `proxy.ts` は共有モジュールやグローバル状態に依存させない。DB アクセスもしない
- **Runtime**: "Proxy defaults to using the Node.js runtime. The `runtime` config option is not available
  in Proxy files." → `runtime` を指定するコードを書かない（書くとビルドエラーになる）
- 同ディレクトリの `middleware.md` には廃止の明記がある（本指示書では未引用。存在確認のみでよい）

**読んだ内容がこの指示書の前提と食い違う場合は、ドキュメントを優先し、実装せずに報告すること。**

### 0.4 認証方式の仕様（`docs/implementation-plan.md` §9.1 から抜粋・具体化）

- **パスワード検証**: 環境変数 `ADMIN_PASSWORD_PBKDF2` を `pbkdf2-sha256$<iterations>$<salt_base64>$<hash_base64>`
  の形式でパースする。`crypto.subtle.deriveBits`（アルゴリズム PBKDF2、ハッシュ SHA-256、鍵長 32バイト、
  salt は base64 デコードした16バイト、iterations はパースした値）で導出し、結果を `hash_base64` の
  デコード結果と**XORループによる定数時間比較**で比較する（早期 return しない。長さが違う場合も
  最後まで比較ループを回してから false を返す設計にする）
- **セッション Cookie の署名**: Cookie 名 `aff_admin`。値は `v1.<base64url(payload)>.<base64url(sig)>`。
  - `payload` は `{"iat":<unix秒>,"exp":<unix秒>,"ver":<session_version>}` を JSON 文字列化したもの
  - `sig` は `HMAC-SHA256(ADMIN_SESSION_SECRET, "v1." + base64url(payload))` を `crypto.subtle.sign`
    （アルゴリズム HMAC / SHA-256、鍵は `ADMIN_SESSION_SECRET` を base64 デコードしたバイト列を
    `crypto.subtle.importKey` でインポートしたもの）で計算した結果
  - base64url は `+`→`-`、`/`→`_`、末尾の `=` パディングを除去したもの
- **検証関数の責務**: 「署名が正しいか（HMAC を再計算して定数時間比較）」と「`exp` を過ぎていないか」の
  2点のみを判定する。**`ver` の DB 照合はここで行わない。** 計画 §9.1 のとおり、DB 照合は API ハンドラ側
  （task_004b 以降）の責務であり、`proxy` は CDN 側で動きうるため DB に触らせない設計にする
- **Cookie 属性**（`proxy.ts` が未認証レスポンスを返す際にはこの属性で Cookie を発行しない。属性の
  実装自体は task_004b のログイン API 側の責務だが、`auth.ts` 側で Cookie 文字列を組み立てるヘルパーを
  用意する場合は `HttpOnly; SameSite=Lax; Path=/; Max-Age=43200` を踏まえること）

### 0.5 `proxy.ts` の仕様（0.3 と 0.4 の統合）

- `export function proxy(request: NextRequest)` と `export const config = { matcher: [...] }` の形にする
- matcher は `["/admin/:path*", "/api/admin/:path*"]`
- コード内で以下は認証不要として素通りさせる（`NextResponse.next()` 相当。存在しなくても 404 で構わない
  ので、ここでは「認証チェックを通過させる」ことだけが要件）:
  - `/admin/login`
  - `/api/admin/login`
- それ以外の `/admin/:path*` `/api/admin/:path*` に対して、`aff_admin` Cookie を `auth.ts` の検証関数で
  検証する
  - 検証に失敗（Cookie が無い・署名不一致・期限切れ）した場合:
    - パス（ページ遷移。`/api/` で始まらない）なら **307** で `/admin/login?next=<元のパス>` へリダイレクト
    - API（`/api/` で始まる）なら **401** の JSON（例: `Response.json({ error: "unauthorized" }, { status: 401 })`）
  - 検証に成功した場合は `NextResponse.next()` を返す
- `proxy` 本体は共有モジュールやグローバル状態、DB に依存しない

---

## 1. スコープ

作成するのは次の2ファイルだけ。

### `lib/admin/auth.ts`
- 0.4 の仕様に従い、PBKDF2 検証関数とセッション Cookie の署名・検証関数を実装する
- **Node 固有の `crypto` モジュール（`require('crypto')` や `import crypto from 'node:crypto'`）を
  使わず、Web Crypto（`crypto.subtle` および `globalThis.crypto`）だけを使う。** Cloudflare Workers 上で
  同じコードが動く必要があるため

### `proxy.ts`（リポジトリルート）
- 0.5 の仕様に従い実装する

### 非スコープ（やらないこと）

- ログイン画面・`app/(admin)/` 配下・`/api/admin/login|logout`（すべて task_004b）
- `lib/admin/rate-limit.ts`（task_004b）
- コンテンツ編集UI・DBのcontentテーブル
- 既存 lint 指摘6件の修正
- `git commit` / `git add`

---

## 2. 白名簿（作成・変更してよいファイル）

- `lib/admin/auth.ts`（新規）
- `proxy.ts`（新規）

## 3. 触ってはいけないもの

これ以外は作らない・変えない。特に:

- `app/` 配下すべて
- `components/` 配下すべて
- `content/` 配下すべて
- `scripts/` 配下すべて
- `verification/baseline/` 配下すべて
- `app/globals.css`
- `wrangler.jsonc` / `open-next.config.ts` / `next.config.ts`
- `package.json` / `package-lock.json`
- 日本語の文言すべて

---

## 4. 禁止コマンド

`docs/plans/tasks/task_003.md` §4 と同じもの（`rm -rf`、`git checkout -- `、`git reset --hard`、
`git clean`、`npm run verify:text -- --update`、`verification/baseline/` への書き込み、`wrangler login`）
に加えて:

- **`middleware.ts` を作らない**（Next 16 で廃止された規約。`check_008` に違反する）
- **`git commit` / `git add` をしない**
- **`.dev.vars` の中身を読み取ってログや報告に貼らない**（シークレットのため。形式の確認が必要なら
  「4フィールドある」等の構造だけを書く）

---

## 5. 手順

各コマンドの終了コードと出力を必ず記録しながら進める。

### 5.1 着手前確認

```bash
git status --porcelain
```

- 出力が空（クリーン）であることを確認する。空でなければ実行を止めて報告する。

### 5.2 `proxy.md` を読む

`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` を実際に開いて読む。
読み取った正規のシグネチャ・matcher の書式・レスポンスの返し方を、完了報告にそのまま引用する
（本指示書 0.3 に書いた内容と一致するはずだが、必ず自分で確認すること）。

### 5.3 `lib/admin/auth.ts` の実装

0.4 の仕様に従って実装する。Web Crypto のみを使用する。

### 5.4 `proxy.ts` の実装

0.5 の仕様に従って実装する。

### 5.5 型チェックとビルド

```bash
npx tsc --noEmit
npm run build
```

- それぞれの終了コードを記録する。

### 5.6 lint の確認

```bash
npm run lint
```

- 最終行が `✖ 6 problems (2 errors, 4 warnings)` から**増えていない**ことを確認する。増えていたら
  停止して報告する。

### 5.7 公開面への影響がないことの確認

```bash
npm run verify:text
```

- 完全一致のままであることを確認する（認証コードの追加が公開面に漏れていないことの確認）。

### 5.8 `next start` での挙動確認

`next start` をバックグラウンド起動し、以下を確認する。期待値は次のとおり:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:3000/admin
# 期待: 307 で redirect_url に /admin/login を含む

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/admin/documents
# 期待: 401

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/login
# 期待: 404（ログイン画面は task_004b でまだ実装していないため、これが正常。404 を理由に停止しない）

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/tickets
# 期待: 200（公開面が壊れていないことの確認）
```

- 確認後、サーバを停止し、使用したポートに対して `lsof -nP -iTCP:<使ったポート> -sTCP:LISTEN` を実行して
  出力が空であることを確認する。

### 5.9 ファイル規約の確認

```bash
test ! -f middleware.ts && test -f proxy.ts
```

- 終了コード0（両方の条件を満たす）であることを確認する（`check_008` 相当）。

### 5.10 最終確認

```bash
git status --porcelain
```

- `?? lib/admin/auth.ts` と `?? proxy.ts` の2行だけであることを確認する。`git add` / `git commit` はしない。

---

## 6. 停止条件

以下に該当したら、その場で作業を止めて Opus に報告する。自己判断で回避策を取らない。

- 5.1 の `git status --porcelain` が空でない
- `proxy.md` の記載が、この指示書に書かれた前提（`export function proxy` + `config.matcher`）と
  食い違う場合 → 実装せず、ドキュメントの該当箇所を引用して報告する
- `npm run lint` の指摘が6件から増えた
- `npm run verify:text` が完全一致にならない
- `npm run build` または `npx tsc --noEmit` が終了コード0以外
- 白名簿外のファイルに変更が必要になった
- **`curl` の結果が期待値と異なる場合。ただし `/admin/login` の404は例外で、これは想定どおりなので
  停止しない**

---

## 7. 完了の定義

- `lib/admin/auth.ts` と `proxy.ts` の2ファイルのみが新規作成されている
- `npx tsc --noEmit` が終了コード0
- `npm run build` が終了コード0
- `npm run lint` の最終行が `✖ 6 problems (2 errors, 4 warnings)`（着手前と同一）
- `npm run verify:text` が完全一致
- `GET /admin` が307で `Location`（またはリダイレクト先）に `/admin/login` を含む
- `GET /api/admin/documents` が401
- `test ! -f middleware.ts && test -f proxy.ts` が終了コード0
- `GET /tickets` が200（公開面は無影響）

## 8. 完了報告のフォーマット

各コマンドの**終了コードと出力の該当行**を貼ること。「成功しました」だけの報告は不可。
実行していない手順は「未実行」と明記すること。最低限、以下を含める:

1. 5.1 の `git status --porcelain` の出力
2. 5.2 で `proxy.md` から読み取った正規シグネチャ・matcher書式・レスポンスの返し方の引用
3. 5.5 の `npx tsc --noEmit` / `npm run build` の終了コード
4. 5.6 の `npm run lint` の終了コードと最終行
5. 5.7 の `npm run verify:text` の終了コードと出力
6. 5.8 の4つの `curl` 結果（`/admin/login` の404が想定どおりである旨を明記）と `lsof` 確認結果
7. 5.9 の `test` コマンドの終了コード
8. 5.10 の最終 `git status --porcelain` 出力
