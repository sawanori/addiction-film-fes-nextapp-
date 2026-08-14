# task_004c: `proxy.ts` 廃止と認証の app 層移行（Cloudflare デプロイ対応）

最終更新: 2026-08-14 / 執筆: Sonnet（Opus の設計ブリーフに基づく）/ 実装担当: haiku / 検証担当: Opus（メインリポジトリで独立実行）

`task_004a`（`lib/admin/auth.ts` と `proxy.ts`）と `task_004b`（ログイン画面・login/logout API・レート制限）は
完了・コミット済み。task_004b の検証中に、**`proxy.ts` が存在すると `opennextjs-cloudflare build` が
終了コード1で失敗し、Cloudflare Workers へデプロイできない**ことが判明した（`docs/PROGRESS.md` §9）。
本指示書は、認証を `proxy.ts`（Next 16 では Node.js ランタイム固定で edge 化できない Proxy）から
app 層（Data Access Layer）へ移し、Cloudflare デプロイを可能にする。
**このタスクでも公開面の見た目・文言は一切変えない。**

---

## 0. 前提（実測済みの事実。ここに無い数値・記述を推測で書かない）

### 0.1 現在のリポジトリ状態

- HEAD は `146d72c`（`feat: ログイン画面と login/logout API とレート制限を実装（task_004b）`）。
  task_004b はこのコミットに含まれている。
- **`docs/PROGRESS.md` の更新と本指示書のコミットは Opus が haiku への委譲前に別コミットで先に入れる**
  （`docs/takeover-plan.md` §4-9「実装を渡す前にツリーをクリーンにする」に従う）。
  したがって **haiku が着手する時点の `git status --porcelain` の期待値は「空」**。空でなければ
  着手せず停止して報告する（クリーンにしようとしない）。
- `proxy.ts` は68行。認証除外は `/admin/login` と `/api/admin/login` の2パスのみ。
  `matcher` は `['/admin/:path*', '/api/admin/:path*']`。`/api/admin/logout` は除外リストに
  入っていない（Cookie 無しで叩くと `proxy.ts` の `handleUnauthenticated` が先に401を返す。
  この挙動は `proxy.ts` を削除すると無くなる）。
- `lib/admin/auth.ts` が export している関数のうち、本タスクで使うもの（変更禁止・そのまま使う）:
  - `export async function verifySessionCookie(cookieValue: string, secret: string): Promise<SessionPayload | null>`
  - `export interface SessionPayload { iat: number; exp: number; ver: number }`
  - （`verifyPasswordPBKDF2` / `generateSessionCookie` / `signSessionCookie` / `parsePBKDF2Hash` も
    export されているが、本タスクの新規ファイルからは呼ばない）
- `lib/db.ts` は既に **`@libsql/client/http`**（`/web` ではない）を使っており、
  `export function getDbClient(): Client | null` を提供する。`TURSO_DATABASE_URL` /
  `TURSO_AUTH_TOKEN` が未設定なら例外を投げず `null` を返す。モジュール読み込み時には接続しない。
- `app/api/admin/logout/route.ts` の現状（54行）: CSRF検証（3条件）のみを行い、認証チェックはせず
  Cookie を失効して200を返す。認証はこれまで `proxy.ts` が前段で担っていた。
- `next.config.ts` の現状（9行）: `nextConfig` オブジェクトは空（コメントのみ）。
  `import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());` の1行がある。
  `outputFileTracingIncludes` はまだ無い。
- `admin_settings` テーブルの `session_version` カラムは、`app/api/admin/login/route.ts` が既に
  `SELECT session_version FROM admin_settings WHERE id = 1` で読んでいる実績がある
  （本タスクの `getAdminSession` でも同一の SQL を使う）。

### 0.2 実測値（Opus が2026-08-14に実測。ここに無い数値を発明しない）

- **`proxy.ts` があると `npx opennextjs-cloudflare build` が終了コード1で失敗する**。エラーは
  `ERROR Node.js middleware is not currently supported. Consider switching to Edge Middleware.`
  Next 16 の `proxy.md` 221-223行が「Proxy は Node.js ランタイム既定、`runtime` 設定は使えず指定すると
  エラー」と明記しており、edge に切り替える手段が無い。`@opennextjs/cloudflare` は `latest` が
  導入済みの `1.20.2`。
- Opus が `proxy.ts` を一時退避して `npx opennextjs-cloudflare build` を実行したところ**終了コード0で
  成功**した（ただし `next.config.ts` の追記が同時に必要だった）。
- `@libsql/client` を workerd 向けにバンドルすると `Could not resolve "@libsql/isomorphic-ws"` で
  失敗する。Next の standalone 出力が同パッケージの `node.mjs` しかコピーせず、esbuild が workerd
  条件の `web.mjs` を探して見つけられないため。`next.config.ts` に
  `outputFileTracingIncludes: { "**": ["./node_modules/@libsql/isomorphic-ws/web.mjs"] }` を
  足すと通る（実測済み）。
- workerd（`opennextjs-cloudflare preview`）でのログイン1回の往復は 初回 0.467s / 2回目 0.071s /
  3回目 0.054s、CSRF で弾く経路は 0.004s。preview のポートは 8787 だった。
- PBKDF2 100,000回の所要は Node/V8 で約 8.1ms（5回中央値）。**反復回数は今回変更しない**
  （Cloudflare の契約プランが未確認のため。ハッシュ文字列に回数が埋め込んであり後から変えられる）。
- **代替案として Next 15.5.23 へのダウングレードを Opus が実験ブランチ `experiment/next15`
  （コミット `8b646b1`）で実測した。** `opennextjs-cloudflare build` は終了コード0で通り、workerd
  上で `/admin` が 307 になることまで確認できたが、`npm run verify:text` が145件の差分（フレーム
  ワークが吐く `<script>` と `<head>` の link、React のコメントマーカー）で失敗し、`npm run lint` も
  eslint 設定の非互換で実行不能になった。**利用者の決定により、この案は採らない。Next 16 のまま
  app 層へ移す。**

---

## 1. スコープ

作る/変える/消すファイルは次の4つだけ（詳細仕様は5章）。

| ファイル | 操作 | 役割 |
|---|---|---|
| `proxy.ts` | 削除 | Cloudflare デプロイを阻害しているため廃止 |
| `lib/admin/session.ts` | 新規 | 認証の Data Access Layer（`getAdminSession` / `requireAdminSession` / `requireAdminApi`） |
| `app/api/admin/logout/route.ts` | 変更 | `proxy.ts` が担っていた認証を自前で行う |
| `next.config.ts` | 変更 | `@libsql/isomorphic-ws` の workerd 解決失敗を回避する |

### 非スコープ（やらないこと）

- `/admin` ダッシュボード・ドキュメント編集UI・`/api/admin/documents*`（task_012 / task_013）
- `lib/admin/auth.ts` / `lib/admin/rate-limit.ts` / `lib/db.ts` / `app/api/admin/login/route.ts` /
  `app/(admin)/` 配下の変更（**必要だと思ったら停止して報告する**）
- PBKDF2 反復回数の変更
- `session_version` +1（全端末ログアウト）
- 本番デプロイ・`wrangler login`・`git add` / `git commit`
- `docs/` 配下の更新（Opus が別途行う）

---

## 2. 白名簿（作成・変更してよいファイル）

- `proxy.ts`（削除）
- `lib/admin/session.ts`（新規）
- `app/api/admin/logout/route.ts`（変更）
- `next.config.ts`（変更）

これ以外のファイルは一切作成・変更しない。

---

## 3. 触ってはいけないもの

`app/(public)/` 配下すべて / `app/layout.tsx` / `app/globals.css` / `components/` 配下すべて /
`content/` 配下すべて / `lib/content/` 配下すべて / `lib/style.ts` / `lib/admin/auth.ts` /
`lib/admin/rate-limit.ts` / `lib/db.ts` / `app/api/admin/login/route.ts` / `app/(admin)/` 配下すべて /
`scripts/` 配下すべて / `verification/baseline/` 配下すべて / `wrangler.jsonc` / `open-next.config.ts` /
`package.json` / `package-lock.json` / `.dev.vars` / `docs/` 配下すべて / 日本語の公開文言すべて

---

## 4. 禁止コマンド

`task_004b.md` §4 と同じもの（`rm -rf`、`git checkout -- `、`git reset --hard`、`git clean`、
`npm run verify:text -- --update`、`verification/baseline/` への書き込み、`wrangler login`、
既存6件の lint 指摘の修正、`git commit` / `git add`、`middleware.ts` を作る、`.dev.vars` の中身をログや
報告に貼る、`content_documents`/`content_revisions`/`admin_settings` へ書き込む SQL）に加えて:

- **`proxy.ts` の削除は `git rm` ではなく `rm proxy.ts` で行う**（`git rm` はステージングを伴うため）
- **`git switch` / `git checkout` でブランチを移動しない**（`experiment/next15` という実験ブランチが
  存在するが、作業は `main` で行う）

---

## 5. 各ファイルの仕様（詳細設計）

以下は Opus が決めた設計をそのまま実装に落としたものである。関数名・レスポンス形式・チェックの順序を
勝手に変えないこと。TypeScript は `tsconfig.json` の `"strict": true` を満たすこと（`any` を使わない）。

### 5.1 `lib/admin/session.ts`（新規）

```ts
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionCookie, type SessionPayload } from "@/lib/admin/auth";
import { getDbClient } from "@/lib/db";

/**
 * 管理認証の Data Access Layer（DAL）。
 *
 * なぜレイアウト（app/(admin)/layout.tsx）で認証しないのか:
 * Next 16 の authentication ガイド
 * （node_modules/next/dist/docs/01-app/02-guides/authentication.md 1348-1354行）が、
 * 「レイアウトはクライアント遷移で再レンダリングされないため毎回セッションを
 * チェックできるとは限らず、また配下のルートセグメントのレンダリングを
 * 止める手段も持たない。認証チェックはレイアウトではなく、データソースに
 * 近い場所（DAL）で行うべき」と明記している。そのため認証チェックは
 * 各ページ・各 API ハンドラの先頭でこの DAL の関数を呼ぶことで行う。
 */
export const getAdminSession = cache(async (): Promise<SessionPayload | null> => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("aff_admin");
  if (!sessionCookie) {
    return null;
  }

  const payload = await verifySessionCookie(sessionCookie.value, secret);
  if (!payload) {
    return null;
  }

  // session_version の DB 照合（fail-closed: DB未設定・行なし・例外はすべて null）
  const client = getDbClient();
  if (!client) {
    return null;
  }

  let currentVersion: number;
  try {
    const { rows } = await client.execute({
      sql: "SELECT session_version FROM admin_settings WHERE id = 1",
      args: [],
    });
    if (rows.length === 0) {
      return null;
    }
    currentVersion = Number(rows[0].session_version);
  } catch {
    return null;
  }

  if (payload.ver !== currentVersion) {
    return null;
  }

  return payload;
});

/** ページ用。セッションが無ければ /admin/login?next=... へリダイレクトする。 */
export async function requireAdminSession(nextPath: string): Promise<SessionPayload> {
  const session = await getAdminSession();
  if (!session) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}

/** API ハンドラ用。セッションが無ければ 401 の Response を返す。 */
export async function requireAdminApi(): Promise<
  { ok: true; session: SessionPayload } | { ok: false; response: Response }
> {
  const session = await getAdminSession();
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { error: "unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }
  return { ok: true, session };
}
```

**`"server-only"` パッケージは使わない。** Next 公式ドキュメントの DAL 例は `import 'server-only'` を
書いているが、`package.json` に同パッケージは存在しない（Sonnet が本指示書作成時に `grep` で確認済み）。
`package.json` は白名簿外であり新規依存を追加できないため、このタスクでは import しない。

### 5.2 `app/api/admin/logout/route.ts`（変更）

これまで `proxy.ts` が前段で401を返していたが、proxy が無くなるので**自分で認証する**。
処理順は **(1) CSRF 3条件 →（失敗なら400）(2) `requireAdminApi()` →（失敗ならその 401 Response を
そのまま返す）(3) Cookie 失効 → 200**。CSRF 検証のロジック（3条件の中身）は今のまま変えない。

変更後の全文（そのまま使ってよい）:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireAdminApi } from "@/lib/admin/session";

export async function POST(request: NextRequest): Promise<Response> {
  const cacheControlHeader = { "Cache-Control": "no-store" };

  // 1. CSRF検証（既存ロジックのまま変更しない）
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { error: "bad_request" },
      { status: 400, headers: cacheControlHeader }
    );
  }

  const xAffAdmin = request.headers.get("x-aff-admin");
  if (xAffAdmin !== "1") {
    return NextResponse.json(
      { error: "bad_request" },
      { status: 400, headers: cacheControlHeader }
    );
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const hostHeader = request.headers.get("host");
      if (originUrl.host !== hostHeader) {
        return NextResponse.json(
          { error: "bad_request" },
          { status: 400, headers: cacheControlHeader }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "bad_request" },
        { status: 400, headers: cacheControlHeader }
      );
    }
  }

  // 2. 認証チェック（proxy.ts 廃止に伴い、このハンドラ自身が行う）
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  // 3. Cookie失効
  const cookieStore = await cookies();
  cookieStore.set("aff_admin", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ ok: true }, { headers: cacheControlHeader });
}
```

**このルートハンドラは `aff_admin` の署名・`exp`・`ver` を `requireAdminApi()` 経由で再検証する。**
task_004b までは `proxy.ts` の matcher が保護していたが、`proxy.ts` が無くなるためこのハンドラ自身が
検証を担う（5.4-2 に記録）。

### 5.3 `next.config.ts`（変更）

`nextConfig` に次を足す（既存の `initOpenNextCloudflareForDev()` の行は消さない）:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turso クライアント（@libsql/client/http 経由）を workerd 向けにバンドルする際、
  // esbuild が @libsql/isomorphic-ws の workerd 条件（web.mjs）を解決できず
  // `Could not resolve "@libsql/isomorphic-ws"` で opennextjs-cloudflare build が
  // 失敗する。standalone 出力に同ファイルを明示的に含めることで解決する（実測済み）。
  outputFileTracingIncludes: {
    "**": ["./node_modules/@libsql/isomorphic-ws/web.mjs"],
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
```

`outputFileTracingIncludes` は `node_modules/next/dist/server/config-shared.d.ts` の1603行目に
`outputFileTracingIncludes?: Record<string, string[]>` として存在する正規の設定キーである
（Sonnet が本指示書作成時に確認済み）。

### 5.4 Sonnet が補った設計判断（Opus未規定分。要確認）

Opus のブリーフに明示が無かったため、実装のブレを防ぐために Sonnet が以下を決めた。
検証担当（Opus）はこれらが不変条件・スコープに反していないか確認すること。

1. **`getAdminSession` 内の DB クエリを `try/catch` で包み、例外時（ネットワーク断など）も
   `null` を返す設計とした。** Opus のブリーフは「クライアントが `null`、または行が取れない場合は
   fail-closed で `null`」と明記しているが、クエリ実行自体が例外を投げるケースへの明示は無かった。
   `lib/admin/rate-limit.ts` の既存パターン（DB接続不可は fail-closed）に倣った。
2. **`rows.length === 0`（`admin_settings` に行が無い）場合の扱いを、login ルート（5.3 of task_004b、
   行が無ければ `session_version = 1` として扱う）とは意図的に区別し、`fail-closed`（`null`）とした。**
   これは Opus のブリーフに明記されている（「行が取れない場合は fail-closed で `null`」）。login と
   getAdminSession で挙動が異なる点に注意。
3. `requireAdminSession` の戻り値の型は `Promise<SessionPayload>`（non-null）とした。`redirect()` の
   戻り値型が `never`（`node_modules/next/dist/client/components/redirect.d.ts` で確認済み）である
   ため、TypeScript strict モードでも `if` 文後の `session` は non-null に絞り込まれる。
4. `app/api/admin/logout/route.ts` の `POST` 関数の戻り値型を明示的に `Promise<Response>` とした。
   `requireAdminApi()` の失敗時は素の `Response` を返す一方、成功時は `NextResponse.json` を使うため
   型を揃える必要がある（`NextResponse` は `Response` を継承しているため問題ない）。

---

## 6. 手順

各コマンドの終了コードと出力を必ず記録しながら進める。

### 6.1 着手前確認

```bash
git status --porcelain
git branch --show-current
```

1つ目の出力が空、2つ目の出力が `main` であることを確認する。**どちらかが違えば実装に着手せず
停止して報告する**（クリーンにしようとしない・ブランチを切り替えようとしない）。

### 6.2 Next 16 ドキュメントの確認

```
node_modules/next/dist/docs/01-app/02-guides/authentication.md
```

の 1119行付近（Proxy は最終防御線ではなく DAL で検証すべきという注意書き）、1129行付近
（Data Access Layer の節）、1348〜1360行（Layouts and auth checks の節）を実際に開いて読む。
完了報告に、読んだファイルパスと要点（DAL とは何か、レイアウトで認証チェックをしてはいけない理由）を
書く。読んだ内容が本指示書5章の前提と食い違う場合は、実装せずドキュメントの該当箇所を引用して報告する。

### 6.3 実装

```bash
rm proxy.ts
```

（`git rm` ではなく `rm`。理由は4章参照）

続けて、5.1〜5.3の仕様に従って `lib/admin/session.ts` を新規作成し、
`app/api/admin/logout/route.ts` と `next.config.ts` を変更する。

### 6.4 型チェックとビルド

```bash
npx tsc --noEmit
npm run build
```

それぞれの終了コードを記録する（両方とも0であること）。

### 6.5 lint の確認

```bash
npm run lint
```

最終行が `✖ 6 problems (2 errors, 4 warnings)` から**増えていない**ことを確認する
（終了コード1が正常）。増えていたら停止して報告する。

### 6.6 公開面への影響がないことの確認

```bash
npm run verify:text
```

`完全一致: 8ルート / 要素1948個 / テキストノード1057個 / コメントノード0個` のままであることを
確認する。

### 6.7 `proxy.ts` / `middleware.ts` が存在しないことの確認

```bash
test ! -f proxy.ts && test ! -f middleware.ts && echo OK
```

`OK` が出力され、終了コード0であることを確認する。

### 6.8 `next start` での挙動確認

サーバをバックグラウンド起動する。ログとPIDの置き場所は scratchpad を使う（`/tmp` を直接使わない）。
以下の `$SP` は Opus から渡された scratchpad ディレクトリの絶対パスに置き換える。

```bash
node --env-file=.dev.vars node_modules/next/dist/bin/next start -p 3111 > "$SP/task_004c_next_start.log" 2>&1 &
echo $! > "$SP/task_004c_next_start.pid"
```

起動を待つ（`/tickets` が200を返すまでポーリングしてよい）。**proxy を外したことで期待値が
task_004b から変わる箇所があるので注意する。**

#### a. `GET /admin`

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/admin
```

期待値: **`404`**（proxy が消えたので307ではない。ダッシュボードが未実装なので404が正しい。
**404 を理由に停止しない**）。

#### b. `GET /api/admin/documents`

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/api/admin/documents
```

期待値: **`404`**（同上。401ではない）。

#### c. `GET /admin/login`

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/admin/login
curl -s http://localhost:3111/admin/login | grep -c '<form'
curl -s http://localhost:3111/admin/login | grep -c 'type="password"'
```

期待値: 1行目が `200`。2行目・3行目がどちらも0より大きい。

#### d. `POST /api/admin/logout`（Cookie無し・CSRFヘッダ有り）

```bash
curl -s -D - -X POST http://localhost:3111/api/admin/logout \
  -H "Content-Type: application/json" \
  -H "x-aff-admin: 1"
```

期待値: ステータス行が `401`、body が `{"error":"unauthorized"}`。**今回は `proxy.ts` ではなく
ルートハンドラ自身（`requireAdminApi()`）が返す。**

#### e. `POST /api/admin/logout`（CSRFヘッダ無し）

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3111/api/admin/logout \
  -H "Content-Type: application/json"
```

期待値: `400`。

#### f. `POST /api/admin/login`（誤パスワード・CSRFヘッダ有り）

**この1回がレート制限カウンタの1回目の失敗になる。リクエストは1本だけ送る**
（`-D -` でヘッダと body の両方を1本で確認する。同じ内容を2回叩くと後続のカウントがずれる）:

```bash
curl -s -D - -X POST http://localhost:3111/api/admin/login \
  -H "Content-Type: application/json" \
  -H "x-aff-admin: 1" \
  -d '{"password":"wrong-password-for-test"}'
```

期待値: ステータス行が `401`、body が `{"error":"invalid"}`。

#### g. `GET /tickets`

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/tickets
```

期待値: `200`。

#### サーバ停止

```bash
kill "$(cat "$SP/task_004c_next_start.pid")"
lsof -nP -iTCP:3111 -sTCP:LISTEN
```

`lsof` の出力が空であることを確認する。

#### 後始末（レート制限カウンタのリセット。`task_004b.md` の 6.7d と同じコマンドを再掲）

```bash
node --env-file=.dev.vars --input-type=module -e "const m=await import('@libsql/client');const c=m.createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});await c.execute('DELETE FROM login_attempts');const r=await c.execute('SELECT COUNT(*) AS n FROM login_attempts');console.log('login_attempts rows =', r.rows[0].n);process.exit(0)"
```

期待出力: `login_attempts rows = 0`。

### 6.9 `opennextjs-cloudflare build`（本題の確認）

```bash
npx opennextjs-cloudflare build
```

**終了コード0**で完了すること。末尾に `OpenNext build complete.` が出る。ここが今回のタスクの
目的なので、失敗したら回避策を取らず、エラー出力をそのまま貼って停止・報告する。

### 6.10 `opennextjs-cloudflare preview`

```bash
npx opennextjs-cloudflare preview > "$SP/task_004c_preview.log" 2>&1 &
echo $! > "$SP/task_004c_preview.pid"
```

起動ログから**実ポートを読んで**（決め打ちしない。Opus の実測では8787だった）次を確認する:

```bash
# <PORT> は起動ログから読んだ実際のポート番号に置き換える
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<PORT>/tickets
BASE_URL=http://localhost:<PORT> npm run verify:text
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:<PORT>/api/admin/login \
  -H "Content-Type: application/json" \
  -H "x-aff-admin: 1" \
  -d '{"password":"wrong-password-for-test"}'
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:<PORT>/api/admin/logout \
  -H "Content-Type: application/json" \
  -H "x-aff-admin: 1"
```

期待値: 1本目 `200`。2本目 `完全一致`。3本目 `401`（誤パスワード）。4本目 `401`（Cookie無しの logout）。

停止:

```bash
kill "$(cat "$SP/task_004c_preview.pid")"
lsof -nP -iTCP:<PORT> -sTCP:LISTEN
```

出力が空であることを確認する。停止後、6.8末尾と同じコマンドで `login_attempts` を空に戻す。

### 6.11 最終確認

```bash
git status --porcelain
```

期待値は次の4行相当（`proxy.ts` の削除は ` D proxy.ts` として出る）:

```
 D proxy.ts
 M app/api/admin/logout/route.ts
 M next.config.ts
?? lib/admin/session.ts
```

`git add` / `git commit` はしない。

---

## 7. 停止条件

以下に該当したら、その場で作業を止めて Opus に報告する。自己判断で回避策を取らない。

- 6.1 の `git status --porcelain` が空でない、または `git branch --show-current` が `main` でない
- 6.2 で読んだ Next 16 docs の記載が本指示書5章の前提と食い違う場合 → 実装せず、該当箇所を
  引用して報告する
- `npm run lint` の指摘が6件から増えた
- `npm run verify:text` が完全一致にならない
- `npm run build` または `npx tsc --noEmit` が終了コード0以外
- 白名簿外のファイルに変更が必要になった
- `lib/admin/auth.ts` / `lib/admin/rate-limit.ts` / `lib/db.ts` / `app/api/admin/login/route.ts` /
  `app/(admin)/` 配下の変更が必要だと感じた場合
- 6.9 の `npx opennextjs-cloudflare build` が終了コード0以外（回避策を取らず、エラー出力をそのまま
  貼って停止・報告する）
- 6.10 の `npx opennextjs-cloudflare preview` が起動しない・エラーになる場合（回避策を取らない）

---

## 8. 完了の定義

手順6.4〜6.11がすべて期待どおりであること。とくに **6.9 の `opennextjs-cloudflare build` 終了コード0**
と **6.7 の `proxy.ts` 不在**、**6.10 の preview 上での `verify:text` 完全一致**が今回の核心。

- `npx tsc --noEmit` / `npm run build` が終了コード0
- `npm run lint` の最終行が `✖ 6 problems (2 errors, 4 warnings)`（着手前と同一）
- `npm run verify:text` が完全一致
- `proxy.ts` / `middleware.ts` が存在しない
- 6.8 a〜g がすべて期待どおり。サーバ停止後の `lsof` が空
- 6.9 の `opennextjs-cloudflare build` が終了コード0・`OpenNext build complete.` を出力
- 6.10 の preview 上で 4本の確認（`/tickets`=200、`verify:text`完全一致、誤パスワード=401、
  Cookie無しlogout=401）がすべて期待どおり。停止後の `lsof` が空
- 6.11 の `git status --porcelain` が白名簿4ファイル相当の行のみ

---

## 9. 完了報告のフォーマット

`task_004b.md` §9 と同じ厳しさ。各コマンドの**終了コードと出力の該当行**を貼ること。
「成功しました」だけの報告は不可。実行していない手順は「未実行」と明記すること。最低限、以下を含める:

1. 6.1 の `git status --porcelain` と `git branch --show-current` の出力
2. 6.2 で読んだファイルパスと、実装に反映した要点
3. 6.4 の `npx tsc --noEmit` / `npm run build` の終了コード
4. 6.5 の `npm run lint` の終了コードと最終行
5. 6.6 の `npm run verify:text` の終了コードと出力
6. 6.7 の `test` コマンドの終了コード
7. 6.8 の a〜g すべての結果と、サーバ停止後の `lsof` 出力
8. 6.9 の `npx opennextjs-cloudflare build` の終了コードと末尾の出力
9. 6.10 の実際に使ったポート番号、4本の確認結果、停止後の `lsof` 出力
10. 6.11 の最終 `git status --porcelain` 出力

---

## 10. 記録するが、この指示書では扱わない論点

1. **`/admin` ダッシュボード（task_013）を作るときは、各ページの先頭で `requireAdminSession()` を
   呼ぶ必要がある。** レイアウトに置くだけでは足りない理由は、Next の authentication ガイド
   1348-1354行が「レイアウトは遷移時に再レンダリングされず、配下のレンダリングを止められないので、
   認証チェックはレイアウトではなくデータソースの近くで行う」と明記しているため（5.1 のコメント
   参照）。新しい管理ページを足したときに呼び忘れる穴があるので、機械チェックの導入を task_013 で
   検討すること。
2. **正パスワードでの疎通確認は平文パスワードを持つ利用者にしか実行できない**（task_004b からの
   持ち越し）。
3. **`Secure` 属性が `next start` のローカル http でも付く件**（`next start` は NODE_ENV=production
   のため）。実害は未確認で、今回は直さない。
4. **PBKDF2 の反復回数は Cloudflare の契約プラン確認後に見直す余地がある。**
5. **Next 15 へのダウングレード案は実験済みで、採らないと決めたこと**（ブランチ `experiment/next15`、
   コミット `8b646b1`）。理由は `verify:text` の完全一致という安全網を失うため。
6. **`admin_settings` に行が無いときの挙動が login と getAdminSession で食い違う**（Opus 追記）。
   login は `session_version = 1` として Cookie を発行するが、`getAdminSession` は fail-closed で
   `null` を返すため、「ログインは通るが以後どこにもアクセスできない」状態になりうる。
   `scripts/db-migrate.mjs` が `INSERT OR IGNORE ... VALUES (1, 1)` で行を作るため通常は起こらない。
   **この不整合は task_012（管理API）で login 側を fail-closed に揃えて解消する。今回は直さない。**

---

## 11. この指示書の作成時点で Sonnet が実際に読んだファイルの一覧

- `docs/plans/tasks/task_004b.md`（全文）
- `docs/PROGRESS.md`（全文。作業ツリー上の現在の内容。§1 の task_004b 付記と §9「Cloudflare へ
  デプロイできない問題」を含む。**このファイルは本セッション時点で `git status --porcelain` 上
  未コミットの変更を含んでいた**。0.1 参照）
- `docs/takeover-plan.md`（全文。§4 委譲ガードレール9項目・§7 品質チェックループを含む）
- `lib/admin/auth.ts`（全文）
- `proxy.ts`（全文）
- `app/api/admin/logout/route.ts`（全文）
- `app/api/admin/login/route.ts`（全文）
- `lib/db.ts`（全文）
- `next.config.ts`（全文）
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`（1080〜1379行目。1119行付近・
  1129行付近の Data Access Layer・1348〜1360行の Layouts and auth checks を含む）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`（全文）
- `node_modules/next/dist/server/config-shared.d.ts`（`grep` で `outputFileTracingIncludes` の
  型定義の存在を確認）
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`
  （`grep` で `outputFileTracingIncludes` の記述箇所を確認。全文は読んでいない）
- `node_modules/next/dist/client/components/redirect.d.ts`（全文。`redirect()` の戻り値型が
  `never` であることを確認するため）
- `package.json`（`grep` で `react` / `react-dom` / `next` のバージョンと `server-only` の不在を
  確認。全文は読んでいない）
- `app/(admin)/` 配下・`app/api/admin/` 配下の実在ファイル一覧（`find` コマンドで確認）
- `docs/plans/tasks/` ディレクトリの一覧（`ls` コマンドで確認）
