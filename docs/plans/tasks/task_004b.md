# task_004b: 管理面 Route Group・ログイン画面・`/api/admin/login|logout`・`lib/admin/rate-limit.ts`

最終更新: 2026-08-14 / 執筆: Sonnet（Opus の設計ブリーフに基づく）/ 実装担当: haiku / 検証担当: Opus（メインリポジトリで独立実行）

`task_004a`（`lib/admin/auth.ts` と `proxy.ts`）と `task_004a-fix`（指摘1〜4の修正）は完了・コミット済み。
本指示書は `task_004a.md` の「分割方針」で予告されていた後半部分を実装する。
**このタスクでも公開面の見た目・文言は一切変えない。**

---

## 0. 前提（実測済みの事実。ここに無い数値・記述を推測で書かない）

### 0.1 現在のリポジトリ状態

- HEAD は `2bff7d9`（`feat: 認証コア（lib/admin/auth.ts）とproxy.tsを実装（task_004a）`）。
  task_004a・task_004a-fix はこのコミットに含まれている。
- **`docs/PROGRESS.md` の更新と本指示書のコミットは Opus が haiku への委譲前に別コミットで先に入れる**
  （`docs/takeover-plan.md` §4-9「実装を渡す前にツリーをクリーンにする」に従う）。
  したがって **haiku が着手する時点の `git status --porcelain` の期待値は「空」**。空でなければ
  着手せず停止して報告する（クリーンにしようとしない）。
- `lib/admin/` には `auth.ts` のみが存在する（`rate-limit.ts` はまだ無い）。
- `app/` 配下には `app/layout.tsx` / `app/globals.css` / `app/favicon.ico` と `app/(public)/`（8ルート）
  のみが存在する。**`app/(admin)/` も `app/api/` もまだ存在しない。**
- `app/layout.tsx` は `<html lang="ja">` の `<head>`（Google Fonts 3行 + `metadata.robots`）と
  `<body>{children}</body>` だけの最小の殻（`app/(public)/layout.tsx` に切り出し済み）。
  `app/(public)/layout.tsx` が `SiteHeader` / `SiteFooter` / `ScrollReveal` を置いている。
  Route Group はURLに現れないため8ルートのパスは変わらない。
- `lib/admin/auth.ts` が export している関数（変更禁止・そのまま使う）:
  - `export async function verifyPasswordPBKDF2(password: string, hashString: string): Promise<boolean>`
  - `export async function generateSessionCookie(sessionVersion: number, ttlSeconds: number, secret: string): Promise<string>`
  - `export interface SessionPayload { iat: number; exp: number; ver: number }`
  - （`verifySessionCookie` と `signSessionCookie` も export されているが、`proxy.ts` 用であり本タスクの
    ファイルからは呼ばない）
- `proxy.ts` は `/admin/login` と `/api/admin/login` の2パスだけを認証除外している。
  **`/api/admin/logout` は除外リストに入っていない。** つまり Cookie 無しで `POST /api/admin/logout` を
  叩くと `proxy.ts` の `handleUnauthenticated` が先に反応し、401 `{"error":"unauthorized"}` を返す
  （ルートハンドラには到達しない）。この挙動は当然のものとして検証手順に組み込む。

### 0.2 実測値（Opus が2026-08-14に実測。ここに無い数値を発明しない）

- `next start` を `.dev.vars` を注入して起動したときの実測:
  - `GET /admin` → 307 / `Location: http://localhost:3111/admin/login?next=%2Fadmin`
  - `GET /api/admin/documents` → 401
  - `GET /tickets` → 200
  - `GET /admin/login` → 404（ログイン画面が未実装のため。**本タスクの完了後は200になる**）
- `npm run lint` は着手前から `✖ 6 problems (2 errors, 4 warnings)`（終了コード1が正常）。この件数から
  増えていないことが合格条件。
- `npm run verify:text` は `完全一致: 8ルート / 要素1948個 / テキストノード1057個 / コメントノード0個`。
- `.dev.vars` には `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` / `ADMIN_PASSWORD_PBKDF2` /
  `ADMIN_SESSION_SECRET` / `NEXTJS_ENV` の5つが入っている。**値は絶対に読ませない・貼らせない。**
  `ADMIN_PASSWORD_PBKDF2` の形式は `pbkdf2-sha256$100000$<salt>$<hash>`（反復回数100,000）。
- `next start` は `.dev.vars` を読まない。注入方法（そのまま使う。`$` を含む値もシェル展開されず安全）:
  `node --env-file=.dev.vars node_modules/next/dist/bin/next start -p 3111`
- Turso dev DB は `admin_settings`（1行・`session_version` = 1）と `login_attempts`（0行）を含む
  スキーマ適用済み（`SELECT session_version FROM admin_settings WHERE id = 1` → `1` を Opus が実測済み）。
- `@libsql/client@0.17.4` は導入済み。`@libsql/client/web` の `createClient` が `libsql://` URL でも
  dev DB へ接続できることを Opus が Node 22 上で実測済み。
  （Sonnet が本指示書作成時に `node_modules/@libsql/client/package.json` の `exports` フィールドと
  `node_modules/@libsql/client/lib-esm/web.d.ts` を確認済み。`"./web"` サブパスは
  `export declare function createClient(config: Config): Client;` と `@libsql/core/api` からの
  型の re-export を提供している。`import { createClient, type Client } from "@libsql/client/web";` は
  型として成立する）。
- `package.json` の `scripts.preview` は `opennextjs-cloudflare build && opennextjs-cloudflare preview`。
  `.dev.vars` は wrangler が自動で読む（`npm run preview` に `--env-file` は不要）。
- `tsconfig.json` は `"strict": true`。`any` を使わず、`unknown` + 型ガード/キャストで書くこと。

---

## 1. スコープ

作成するのは次の8ファイルだけ（詳細仕様は5章）。

| ファイル | 役割 |
|---|---|
| `lib/db.ts` | Turso クライアント生成（`@libsql/client/web`）。未設定なら `null` を返す |
| `lib/admin/rate-limit.ts` | `login_attempts` を使ったログイン試行のレート制限 |
| `app/api/admin/login/route.ts` | `POST /api/admin/login`（CSRF検証・パスワード検証・Cookie発行） |
| `app/api/admin/logout/route.ts` | `POST /api/admin/logout`（CSRF検証・Cookie失効） |
| `app/(admin)/layout.tsx` | 管理画面シェル（`.adm` ラッパー + `admin.css` の import） |
| `app/(admin)/admin.css` | 管理画面専用スタイル（全セレクタ `.adm` 配下） |
| `app/(admin)/admin/login/page.tsx` | ログイン画面（Server Component。`title` を設定） |
| `app/(admin)/admin/login/LoginForm.tsx` | ログインフォーム（Client Component） |

### 非スコープ（やらないこと）

- `/admin` ダッシュボード本体（task_013）・ドキュメント編集UI・`/api/admin/documents*`（task_012）
- 公開ページの DB 読み出し切替（task_010）・`content/*.json` の追加投入（task_009残り）
- `session_version` +1 による全端末ログアウト
- 既存 lint 指摘6件の修正
- `lib/admin/auth.ts` と `proxy.ts` の変更（**変更が必要だと思ったら停止して報告する**）
- `.dev.vars` の変更、本番デプロイ、`wrangler login`、`git add` / `git commit`

---

## 2. 白名簿（作成・変更してよいファイル）

- `lib/db.ts`（新規）
- `lib/admin/rate-limit.ts`（新規）
- `app/api/admin/login/route.ts`（新規。`app/api/` ディレクトリごと新規作成になる）
- `app/api/admin/logout/route.ts`（新規）
- `app/(admin)/layout.tsx`（新規。`app/(admin)/` ディレクトリごと新規作成になる）
- `app/(admin)/admin.css`（新規）
- `app/(admin)/admin/login/page.tsx`（新規）
- `app/(admin)/admin/login/LoginForm.tsx`（新規）

これ以外のファイルは一切作成・変更しない。

## 3. 触ってはいけないもの

- `app/(public)/` 配下すべて
- `app/layout.tsx`
- `app/globals.css`
- `components/` 配下すべて
- `content/` 配下すべて
- `lib/content/` 配下すべて
- `lib/style.ts`
- `lib/admin/auth.ts`
- `proxy.ts`
- `scripts/` 配下すべて
- `verification/baseline/` 配下すべて
- `wrangler.jsonc` / `open-next.config.ts` / `next.config.ts`
- `package.json` / `package-lock.json`
- `.dev.vars`
- 日本語の公開文言すべて（`app/(public)/` 配下のテキスト。管理画面側の文言は自由に決めてよい）

---

## 4. 禁止コマンド

`docs/plans/tasks/task_004a-fix.md` §5 と同じもの（`rm -rf`、`git checkout -- `、`git reset --hard`、
`git clean`、`npm run verify:text -- --update`、`verification/baseline/` への書き込み、`wrangler login`、
既存6件の lint 指摘の修正、`git commit` / `git add`、`middleware.ts` を作る、`.dev.vars` の中身をログや
報告に貼る）に加えて:

- **`content_documents` / `content_revisions` / `admin_settings` へ書き込む SQL を実行しない**
  （`login_attempts` の DELETE だけは6.10（後始末）で明示的に許可する）
- `lib/admin/auth.ts` と `proxy.ts` を変更しない（変更が必要だと思ったら実装せず停止して報告する）

---

## 5. 各ファイルの仕様（詳細設計）

以下は Opus が決めた設計をそのまま実装に落としたものである。関数名・レスポンス形式・チェックの順序を
勝手に変えないこと。TypeScript は `tsconfig.json` の `"strict": true` を満たすこと（`any` を使わない）。

### 5.1 `lib/db.ts`

```ts
import { createClient, type Client } from "@libsql/client/web";

/**
 * Turso クライアントを生成する。
 * TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定なら例外を投げず null を返す。
 * モジュール読み込み時には接続しない（呼び出しごとに生成する。Next のビルド時評価を避けるため）。
 */
export function getDbClient(): Client | null {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    return null;
  }
  return createClient({ url, authToken });
}
```

`@libsql/client` ではなく **`@libsql/client/web`** から import すること（workerd と Node の両方で
同じ fetch ベースの経路になるため。0.2 に記載の実測根拠を参照）。

### 5.2 `lib/admin/rate-limit.ts`

`login_attempts` テーブル（`scripts/db-migrate.mjs` の DDL。カラムは `ip TEXT PRIMARY KEY` /
`failures INTEGER NOT NULL DEFAULT 0` / `locked_until TEXT` / `updated_at TEXT NOT NULL`）を使う。

仕様（Opus決定）:
- IP の決め方: `cf-connecting-ip` ヘッダ優先 → 無ければ `x-forwarded-for` の先頭（カンマ区切りの最初の値、
  前後の空白を trim） → 両方無ければ `"unknown"`。
- 連続5回目の失敗でロックする。1〜4回目は401、5回目は429（5回目の失敗時に `locked_until` を
  「現在時刻+15分」に設定し、そのレスポンス自体を429にする）。
- ロック中は残り秒数を `retryAfter` として返す。ロック期限が過ぎていたらカウンタをリセットして
  再び受け付ける。
- ログイン成功時はその IP の行を削除する。
- **DB に接続できない場合は fail-closed**（レート制限を判定できないなら通さない＝ロック扱いにする）。

実装（そのまま使ってよい参考実装。変数名・SQL文言は多少変えてよいが、返り値の型と分岐条件は変えない）:

```ts
import { getDbClient } from "@/lib/db";

export type RateLimitStatus =
  | { locked: false }
  | { locked: true; retryAfter: number };

const MAX_FAILURES = 5;
const LOCK_DURATION_SECONDS = 15 * 60;

/** cf-connecting-ip → x-forwarded-for の先頭 → "unknown" の順で IP を決める。 */
export function getClientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/**
 * ログイン試行の前に呼ぶ。ロック中かどうかだけを判定する（カウンタは変更しない）。
 * DB に接続できない場合は fail-closed でロック扱いにする。
 */
export async function checkRateLimit(ip: string): Promise<RateLimitStatus> {
  const client = getDbClient();
  if (!client) {
    return { locked: true, retryAfter: LOCK_DURATION_SECONDS };
  }
  const { rows } = await client.execute({
    sql: "SELECT locked_until FROM login_attempts WHERE ip = ?",
    args: [ip],
  });
  if (rows.length === 0) {
    return { locked: false };
  }
  const lockedUntilRaw = rows[0].locked_until;
  if (!lockedUntilRaw) {
    return { locked: false };
  }
  const lockedUntilMs = new Date(String(lockedUntilRaw)).getTime();
  const nowMs = Date.now();
  if (lockedUntilMs > nowMs) {
    return { locked: true, retryAfter: Math.ceil((lockedUntilMs - nowMs) / 1000) };
  }
  // ロック期限切れ: カウンタをリセットする
  await client.execute({ sql: "DELETE FROM login_attempts WHERE ip = ?", args: [ip] });
  return { locked: false };
}

/**
 * パスワード検証が失敗した直後に呼ぶ。失敗回数を+1し、5回目に達したらロックする。
 * DB に接続できない場合は fail-closed でロック扱いにする。
 */
export async function recordLoginFailure(ip: string): Promise<RateLimitStatus> {
  const client = getDbClient();
  if (!client) {
    return { locked: true, retryAfter: LOCK_DURATION_SECONDS };
  }
  const { rows } = await client.execute({
    sql: "SELECT failures FROM login_attempts WHERE ip = ?",
    args: [ip],
  });
  const currentFailures = rows.length > 0 ? Number(rows[0].failures) : 0;
  const nextFailures = currentFailures + 1;

  if (nextFailures >= MAX_FAILURES) {
    const lockedUntilIso = new Date(Date.now() + LOCK_DURATION_SECONDS * 1000).toISOString();
    await client.execute({
      sql: `INSERT INTO login_attempts (ip, failures, locked_until, updated_at)
            VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            ON CONFLICT(ip) DO UPDATE SET
              failures = excluded.failures,
              locked_until = excluded.locked_until,
              updated_at = excluded.updated_at`,
      args: [ip, nextFailures, lockedUntilIso],
    });
    return { locked: true, retryAfter: LOCK_DURATION_SECONDS };
  }

  await client.execute({
    sql: `INSERT INTO login_attempts (ip, failures, locked_until, updated_at)
          VALUES (?, ?, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          ON CONFLICT(ip) DO UPDATE SET
            failures = excluded.failures,
            locked_until = excluded.locked_until,
            updated_at = excluded.updated_at`,
    args: [ip, nextFailures],
  });
  return { locked: false };
}

/** ログイン成功時に呼ぶ。対象 IP の行を削除する。 */
export async function clearLoginAttempts(ip: string): Promise<void> {
  const client = getDbClient();
  if (!client) return;
  await client.execute({ sql: "DELETE FROM login_attempts WHERE ip = ?", args: [ip] });
}
```

### 5.3 `app/api/admin/login/route.ts`

POST のみ。処理順序（この順を変えない。理由は5.9参照）:

1. **CSRF検証**（3条件。1つでも満たさなければ即座に400 `{"error":"bad_request"}`。この時点では
   レート制限のカウンタに一切触れない）:
   - (a) `Content-Type` ヘッダが `application/json` で始まる（大文字小文字を区別しない。
     `; charset=...` 等の付加は許容する）
   - (b) カスタムヘッダ `x-aff-admin` の値が `"1"`
   - (c) `Origin` ヘッダが存在する場合、その URL の `host` が `Host` ヘッダと一致する
     （`Origin` が無い場合はこの条件をスキップ。`new URL(origin)` が例外を投げたら不一致扱い）
2. **環境変数チェック**: `ADMIN_PASSWORD_PBKDF2` と `ADMIN_SESSION_SECRET` のどちらかが未設定なら
   500 `{"error":"server_misconfigured"}`。
3. **body解析**: `await request.json()` が失敗する、または結果が object でない、または
   `password` フィールドが string でない場合は400 `{"error":"bad_request"}`（レート制限のカウンタに
   触れない）。
4. **IP決定**: `getClientIp(request)`。
5. **レート制限チェック**: `checkRateLimit(ip)`。ロック中なら429
   `{"error":"locked","retryAfter":<秒数>}`。
6. **パスワード検証**: `verifyPasswordPBKDF2(password, ADMIN_PASSWORD_PBKDF2)`。
   - 不一致: `recordLoginFailure(ip)` を呼ぶ。その結果が `locked:true` なら429
     `{"error":"locked","retryAfter":<秒数>}`、そうでなければ401 `{"error":"invalid"}`。
   - 一致: 次のステップへ。
7. **`session_version` の読み出し**: `getDbClient()` で `admin_settings` から
   `SELECT session_version FROM admin_settings WHERE id = 1` を実行。クライアントが `null`
   （DB未設定）なら500 `{"error":"server_misconfigured"}`。行が無い場合は `session_version = 1`
   として扱ってよい（`scripts/db-migrate.mjs` が `INSERT OR IGNORE ... VALUES (1, 1)` で
   投入済みなので通常は発生しない）。
8. **Cookie発行**: `generateSessionCookie(sessionVersion, 43200, ADMIN_SESSION_SECRET)` で
   Cookie値を作り、Next 16 の `cookies()`（`next/headers`。Route Handler 内で
   `await cookies()` してから `.set(name, value, options)`）で `aff_admin` を設定する。
   オプションは `{ httpOnly: true, sameSite: "lax", path: "/", maxAge: 43200, secure: process.env.NODE_ENV === "production" }`。
   `Secure` は本番のみ（localhost の http 検証で Cookie が落ちる事故を避けるため）。
9. **成功時のクリーンアップ**: `clearLoginAttempts(ip)` を呼ぶ。
10. 200 `{"ok":true}` を返す。

**すべてのレスポンス（400/401/429/500/200のすべて）に `Cache-Control: no-store` ヘッダを付ける。**

`cookies()` の使い方は `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`
で確認すること（6.2 で読む）。Route Handler は `NextRequest` を受け取る形で書き、
`import { NextResponse } from 'next/server'; import type { NextRequest } from 'next/server';` の
書き方は `proxy.ts` の既存スタイルに合わせる。

### 5.4 `app/api/admin/logout/route.ts`

POST のみ。CSRF検証は5.3の(a)(b)(c)と同一ロジック（この2ファイル間でヘルパーを共有する新規モジュールは
作らない。白名簿を超えるため、素朴に重複実装してよい）。

- CSRF検証に失敗したら400 `{"error":"bad_request"}`。
- 通過したら、Next 16 の `cookies()` で `aff_admin` を `{ httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: process.env.NODE_ENV === "production" }` として `.set("aff_admin", "", { ...options })`
  で失効させる（`Max-Age=0`）。
- 200 `{"ok":true}` を返す。
- **すべてのレスポンスに `Cache-Control: no-store` ヘッダを付ける。**

**このルートハンドラは `aff_admin` の署名・`exp` を自前で再検証しない。** `proxy.ts` の matcher
（`/api/admin/:path*`）が `/api/admin/logout` を認証除外リストに含めていないため、Cookie が無い/
無効なリクエストは `proxy.ts` の `handleUnauthenticated` が先に401を返し、このハンドラには到達しない。
`session_version` の DB 照合（`ver` チェック）はこのタスクでは行わない（5.9 と10章に理由を記録）。

### 5.5 `app/(admin)/layout.tsx`

```tsx
import "./admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="adm">{children}</div>;
}
```

`export const metadata` は書かない（`robots` を上書きしない。ルートレイアウトの
`noindex, nofollow, noarchive` をそのまま継承させる）。

### 5.6 `app/(admin)/admin.css`

全セレクタを `.adm` 配下に置く。`app/globals.css` には1行も足さない。`globals.css` のクラス
（`.btn` 等）を参照しない。最小限の見た目でよく、クラス名は `.adm` プレフィックスである限り
自由に変えてよい（以下は参考例。そのまま使ってよい）:

```css
.adm {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, sans-serif;
}

.adm__login-card {
  width: 100%;
  max-width: 360px;
  padding: 2rem;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.adm__field {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem;
  margin-bottom: 1rem;
}

.adm__button {
  width: 100%;
  padding: 0.75rem;
}

.adm__error {
  color: #b00020;
  margin-bottom: 1rem;
}
```

### 5.7 `app/(admin)/admin/login/page.tsx`

Server Component。`export const metadata` で `title` を設定する（日本語で自由に決めてよい。
例: `"ログイン | 管理画面"`。公開8ページの文言とは無関係）。`LoginForm` を `Suspense` で包んで
描画する（`useSearchParams` を使う Client Component を本番ビルドで静的に含めるには Suspense
境界が必須。5.8参照・6.2で読む `use-search-params.md` の該当箇所を参照）。

```tsx
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "ログイン | 管理画面",
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
```

### 5.8 `app/(admin)/admin/login/LoginForm.tsx`

Client Component（`"use client"`）。パスワード入力1項目 + 送信ボタン。

- `useSearchParams()`（`next/navigation`）で `next` クエリを読む。
- 送信: `fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-aff-admin': '1' }, body: JSON.stringify({ password }) })`。
- **オープンリダイレクト対策**: `next` が `/admin` で始まり、かつ `//` で始まらない場合のみ採用し、
  それ以外は `/admin` にフォールバックする。
- レスポンス処理:
  - 200: 上記のフォールバック込みの遷移先へ `window.location.href` で遷移する。
  - 401: エラー文言「パスワードが違います」を表示する。
  - 429: レスポンス body の `retryAfter`（秒）を `Math.ceil(retryAfter / 60)` で分に切り上げ、
    「しばらく待ってください（残り○分）」を表示する（○は算出した分数）。
  - それ以外（ネットワークエラー・500等）: 上記2つと区別できる一般的なエラー文言を表示する
    （具体的な日本語文言は自由に決めてよい）。

参考実装（構造はこのとおりにすること。変数名・JSXの細部は変えてよい）:

```tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

function resolveNext(nextParam: string | null): string {
  if (nextParam && nextParam.startsWith("/admin") && !nextParam.startsWith("//")) {
    return nextParam;
  }
  return "/admin";
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aff-admin": "1",
        },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = resolveNext(searchParams.get("next"));
        return;
      }

      if (res.status === 401) {
        setError("パスワードが違います");
      } else if (res.status === 429) {
        const data: unknown = await res.json().catch(() => null);
        const retryAfter =
          data !== null &&
          typeof data === "object" &&
          typeof (data as Record<string, unknown>).retryAfter === "number"
            ? (data as { retryAfter: number }).retryAfter
            : 0;
        const minutes = Math.ceil(retryAfter / 60);
        setError(`しばらく待ってください（残り${minutes}分）`);
      } else {
        setError("エラーが発生しました。しばらくしてから再度お試しください。");
      }
    } catch {
      setError("エラーが発生しました。しばらくしてから再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="adm__login-card">
      <form onSubmit={handleSubmit}>
        {error && <p className="adm__error">{error}</p>}
        <input
          className="adm__field"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
        <button className="adm__button" type="submit" disabled={submitting}>
          ログイン
        </button>
      </form>
    </div>
  );
}
```

### 5.9 Sonnet が補った設計判断（Opus未規定分。要確認）

Opus のブリーフに明示が無かったため、実装のブレを防ぐために Sonnet が以下を決めた。
検証担当（Opus）はこれらが不変条件・スコープに反していないか確認すること。

1. **login ルートの処理順序**（CSRF → 環境変数チェック → body解析 → レート制限チェック →
   パスワード検証 → DB照合 → Cookie発行）と、**CSRF検証失敗・body不正はレート制限のカウンタに
   一切触れない**という設計。これにより6.7の検証手順で失敗回数を確定的に数えられる。
2. **body の JSON parse 失敗・`password` フィールド欠落**は CSRF失敗と同じ400
   `{"error":"bad_request"}` 扱いとし、レート制限のカウンタ対象外とした。
3. Cookie の読み書きに **Next 16 の `cookies()`（`next/headers`）を使う**設計とした
   （`Set-Cookie` 文字列を手組みしない）。属性値はすべてオプションオブジェクトで渡す。
4. `logout` ルートは**自前でセッション（署名・`exp`・`ver`）を再検証しない**設計とした。
   `docs/implementation-plan.md` §9 冒頭は「認証は login 以外の全エンドポイントで
   `lib/admin/auth.ts` のセッション検証を実行（`proxy.ts` と二重化）」と原則を書いているが、
   `proxy.ts` の matcher が `/api/admin/logout` を保護対象に含んでおり（0.1参照）、
   `session_version` +1 による失効がこのタスクの非スコープで実際には一度も version が
   変わらない以上、二重検証を今回省いても実害は生じない。10章に記録として残す。
5. `lib/admin/rate-limit.ts` の関数シグネチャ（`getClientIp` / `checkRateLimit` /
   `recordLoginFailure` / `clearLoginAttempts`）と `RateLimitStatus` 型は5.2のとおりに固定した。
6. `git status --porcelain` は新規に作る未追跡ディレクトリ（`app/(admin)/` と `app/api/`）を
   ディレクトリ単位の1行にまとめて表示する（個々のファイルごとには展開されない）のが git の
   通常の挙動。6.10で個別ファイルの存在確認コマンドを別途用意した。

---

## 6. 手順

各コマンドの終了コードと出力を必ず記録しながら進める。

### 6.1 着手前確認

```bash
git status --porcelain
```

出力が空（クリーン）であることを確認する。**空でなければ実装に着手せず停止して報告する**
（クリーンにしようとしない）。

### 6.2 Next 16 ドキュメントの確認

以下の3ファイルを実際に開いて読む。完了報告に、読んだファイルパスと、実装に反映した要点
（Route Handler の書き方・`cookies()` の使い方・`useSearchParams` に Suspense が要る理由）を書く。

```
node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md
node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md
```

読んだ内容が本指示書5章の前提と食い違う場合は、実装せずドキュメントの該当箇所を引用して報告する。

### 6.3 実装

5章の仕様に従って8ファイルを作成する。

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

### 6.7 `next start` での挙動確認

サーバをバックグラウンド起動する。

ログとPIDの置き場所は scratchpad を使う（`/tmp` を直接使わない）。以下の `$SP` を
Opus から渡された scratchpad ディレクトリの絶対パスに置き換える。

```bash
node --env-file=.dev.vars node_modules/next/dist/bin/next start -p 3111 > "$SP/task_004b_next_start.log" 2>&1 &
echo $! > "$SP/task_004b_next_start.pid"
```

起動を待つ（`/tickets` が200を返すまでポーリングしてよい）。以降、次の順で検証する
（**先にロックさせると正しいパスワードの確認ができなくなるため、この順序を守ること**）。

#### a. ログイン画面が表示されること

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/admin/login
curl -s http://localhost:3111/admin/login | grep -c '<form'
curl -s http://localhost:3111/admin/login | grep -c 'type="password"'
```

期待値: 1行目が `200`。2行目・3行目が `0` より大きい（`<form` と `type="password"` を含む）。

#### b. 正しいパスワードでのログイン（未実行）と代替検証

**パスワードの平文は Opus も haiku も持っていない。したがって「正パスワードで200 + Set-Cookie」の
確認は実行できない。この項目は完了報告に『未実行（平文パスワード不在のため）』と明記し、代わりに
次の代替検証を行う。**

誤ったパスワードで401になること（**この1回がレート制限カウンタの1回目の失敗になる**。以降の
c章の回数はここから継続してカウントする）。

**リクエストは1本だけ送る。** `-D -` はヘッダを、`-o -` 相当の既定動作は body を出すので、
ヘッダと body の両方をこの1本で確認する。**同じ内容を2回叩くと失敗回数が1回ずれ、c章の期待値が
合わなくなる**ので、確認したい項目が複数あってもリクエストを増やさない:

```bash
curl -s -D - -X POST http://localhost:3111/api/admin/login \
  -H "Content-Type: application/json" \
  -H "x-aff-admin: 1" \
  -d '{"password":"wrong-password-for-test"}'
```

期待値: ステータス行が `401`、レスポンスヘッダに `cache-control: no-store` を含み、
body が `{"error":"invalid"}`。

CSRF 3条件をそれぞれ1つ欠いたリクエストが400 `{"error":"bad_request"}` になること（**この3本は
レート制限カウンタに影響しない設計＝5.9-1**）:

```bash
# (1) x-aff-admin ヘッダが無い
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3111/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"wrong-password-for-test"}'

# (2) Content-Type が application/json でない
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3111/api/admin/login \
  -H "Content-Type: text/plain" \
  -H "x-aff-admin: 1" \
  -d '{"password":"wrong-password-for-test"}'

# (3) Origin が Host と一致しない
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3111/api/admin/login \
  -H "Content-Type: application/json" \
  -H "x-aff-admin: 1" \
  -H "Origin: https://evil.example" \
  -d '{"password":"wrong-password-for-test"}'
```

期待値: 3本とも `400`。

#### c. レート制限

bで既に誤パスワードを1回送信している（累計1回目・401）。ここから追加で5回送信し、
**累計2〜4回目が401、累計5回目が429（bodyに `retryAfter` を含む）、累計6回目も429**であることを
確認する。

```bash
for i in 2 3 4 5 6; do
  echo "--- 累計${i}回目 ---"
  curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://localhost:3111/api/admin/login \
    -H "Content-Type: application/json" \
    -H "x-aff-admin: 1" \
    -d '{"password":"wrong-password-for-test"}'
done
```

期待値: 累計2・3・4回目は `HTTP_CODE:401` かつ body `{"error":"invalid"}`。累計5・6回目は
`HTTP_CODE:429` かつ body に `"retryAfter"` を含む。

#### d. 後始末（このタスクで唯一許可された DB 書き込み）

```bash
node --env-file=.dev.vars --input-type=module -e "const m=await import('@libsql/client');const c=m.createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});await c.execute('DELETE FROM login_attempts');const r=await c.execute('SELECT COUNT(*) AS n FROM login_attempts');console.log('login_attempts rows =', r.rows[0].n);process.exit(0)"
```

期待出力: `login_attempts rows = 0`。

#### e. ログアウト（Cookie無し）

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3111/api/admin/logout \
  -H "Content-Type: application/json" \
  -H "x-aff-admin: 1"
```

期待値: `401`（`proxy.ts` が `/api/admin/logout` を保護しているため。ルートハンドラの
`{"ok":true}` には到達しない）。**Cookie 有りでの200確認はログインできないため未実行と報告する。**

#### f. 公開面が壊れていないこと

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/tickets
```

期待値: `200`。

#### g. `/admin` の保護が維持されていること

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3111/admin
```

期待値: `307` で `redirect_url` に `/admin/login?next=%2Fadmin` を含む（0.2の実測値と同一）。

### 6.8 サーバ停止

```bash
kill "$(cat "$SP/task_004b_next_start.pid")"
lsof -nP -iTCP:3111 -sTCP:LISTEN
```

`lsof` の出力が空であることを確認する。

### 6.9 PBKDF2 の CPU 時間実測（`docs/implementation-plan.md` §9.1 の宿題）

```bash
npm run preview
```

を**バックグラウンドで**起動する（`.dev.vars` は wrangler が自動で読むため `--env-file` は不要）。
起動ログから実際の待受ポートを読む（**決め打ちしない。** `docs/PROGRESS.md` §2 には
`BASE_URL=http://localhost:8787` での検証実績があるが、ポートが空いていない場合に別番号へ
ずれることがあるため、必ず起動ログの表示を見て実際の番号を使う）。起動できたら、誤パスワードで
`POST /api/admin/login` を叩き、(i) HTTPステータスが401であること（CPU時間超過なら500や切断に
なる）、(ii) `curl -w "%{time_total}"` の値、を記録する。

```bash
# <PORT> は起動ログから読んだ実際のポート番号に置き換える
curl -s -o /dev/null -w "http_code=%{http_code} time_total=%{time_total}\n" \
  -X POST http://localhost:<PORT>/api/admin/login \
  -H "Content-Type: application/json" \
  -H "x-aff-admin: 1" \
  -d '{"password":"wrong-password-for-test"}'
```

**判断はしない。数値を報告するだけ。** preview が起動しない・エラーになる場合は回避策を取らず
停止して報告する。

停止後:

```bash
lsof -nP -iTCP:<PORT> -sTCP:LISTEN
```

の出力が空であることを確認する（ブリーフの原文は `8787` 決め打ちだが、実際に使ったポート番号に
対して実行し、両方の値（原文の8787と実際に使ったポート）を報告に書くこと）。

### 6.10 最終確認

```bash
git status --porcelain
```

**新規に作った `app/(admin)/` と `app/api/` はディレクトリ単位で1行にまとめて表示される**
（git の通常の挙動。5.9-6参照）。目安の出力:

```
?? app/(admin)/
?? app/api/
?? lib/admin/rate-limit.ts
?? lib/db.ts
```

この4行（またはこれに相当する行）以外に変更が無いことを確認する。加えて、白名簿8ファイルが
実際に存在することを個別に確認する:

```bash
test -f "lib/db.ts" && echo "OK: lib/db.ts"
test -f "lib/admin/rate-limit.ts" && echo "OK: lib/admin/rate-limit.ts"
test -f "app/api/admin/login/route.ts" && echo "OK: app/api/admin/login/route.ts"
test -f "app/api/admin/logout/route.ts" && echo "OK: app/api/admin/logout/route.ts"
test -f "app/(admin)/layout.tsx" && echo "OK: app/(admin)/layout.tsx"
test -f "app/(admin)/admin.css" && echo "OK: app/(admin)/admin.css"
test -f "app/(admin)/admin/login/page.tsx" && echo "OK: app/(admin)/admin/login/page.tsx"
test -f "app/(admin)/admin/login/LoginForm.tsx" && echo "OK: app/(admin)/admin/login/LoginForm.tsx"
```

8行すべて `OK:` で出力されることを確認する。`git add` / `git commit` はしない。

---

## 7. 停止条件

以下に該当したら、その場で作業を止めて Opus に報告する。自己判断で回避策を取らない。

- 6.1 の `git status --porcelain` が空でない
- 6.2 で読んだ Next 16 docs の記載が本指示書5章の前提と食い違う場合 → 実装せず、該当箇所を
  引用して報告する
- `npm run lint` の指摘が6件から増えた
- `npm run verify:text` が完全一致にならない
- `npm run build` または `npx tsc --noEmit` が終了コード0以外
- 白名簿外のファイルに変更が必要になった
- `lib/admin/auth.ts` または `proxy.ts` の変更が必要だと感じた場合
- 6.7 の curl の結果が期待値と異なる場合。**ただし「正パスワードでの確認」（b）と「Cookie有りの
  logout確認」（e）は最初から未実行であることが前提のため、これ自体は停止理由にならない**
- 6.9 で `npm run preview` が起動しない・エラーになる場合（回避策を取らない）

---

## 8. 完了の定義

- 5章の8ファイルのみが新規作成されている
- `npx tsc --noEmit` が終了コード0
- `npm run build` が終了コード0
- `npm run lint` の最終行が `✖ 6 problems (2 errors, 4 warnings)`（着手前と同一）
- `npm run verify:text` が完全一致
- 6.7a〜g がすべて期待どおり。ただし b の「正パスワードでの200+Set-Cookie確認」と e の
  「Cookie有りでの200確認」は『未実行（平文パスワード不在のため）』と明記されていること
- 6.8・6.9末尾の `lsof` がいずれも空
- 6.9 の CPU時間実測値（`time_total` と実際に使ったポート番号）が数値として報告されている
  （判断は不要）
- 6.10 の `git status --porcelain` が白名簿8ファイル相当の行のみで、8つの `test -f` がすべて
  `OK` であること

---

## 9. 完了報告のフォーマット

各コマンドの**終了コードと出力の該当行**を貼ること。「成功しました」だけの報告は不可。
実行していない手順は「未実行」と明記すること。最低限、以下を含める:

1. 6.1 の `git status --porcelain` の出力
2. 6.2 で読んだ3ファイルのパスと、実装に反映した要点
3. 6.4 の `npx tsc --noEmit` / `npm run build` の終了コード
4. 6.5 の `npm run lint` の終了コードと最終行
5. 6.6 の `npm run verify:text` の終了コードと出力
6. 6.7 の a〜g すべての結果（b・e は「未実行」の旨を明記）
7. 6.8 の `lsof` 出力（空であることの確認）
8. 6.9 の実際に使ったポート番号・`http_code`・`time_total` の値と、preview 停止後の `lsof` 出力
9. 6.10 の最終 `git status --porcelain` 出力と、8つの `test -f` の結果

---

## 10. 記録するが、この指示書では扱わない論点

- **正パスワードでの一連の疎通確認**（ログイン成功→Set-Cookie→ダッシュボード遷移、
  Cookie有りでのログアウト成功）は、平文パスワードを持つ利用者にしか実行できない。
  task_004b の受け入れ後、利用者へ手動確認を依頼する必要がある。
- **`next` クエリに元のクエリ文字列を引き継ぐか**は、`task_004a-fix` §10 からの持ち越し。
  task_013 でダッシュボードを作るときに再検討する。
- **`logout` ルートが `session_version`（`ver`）の DB 照合を自前で行わない設計**（5.9-4）。
  `proxy.ts` が `/api/admin/logout` を保護しているため今回は実害が無いが、`session_version` +1
  による全端末ログアウトを実装する将来のタスクで、`logout` 自身にも二重検証が要るか再検討する。

---

## 11. この指示書の作成時点で Sonnet が実際に読んだファイルの一覧

- `docs/plans/tasks/task_004a.md`（全文）
- `docs/plans/tasks/task_004a-fix.md`（全文）
- `docs/takeover-plan.md`（全文。§4 委譲ガードレール・§7 品質チェックループを含む）
- `docs/implementation-plan.md`（1〜550行目。§1〜§10.4 を含む。**551行目以降（§11.2〜§15相当）は
  読んでいない**）
- `lib/admin/auth.ts`（全文）
- `proxy.ts`（全文）
- `app/layout.tsx`（全文）
- `app/(public)/layout.tsx`（全文）
- `CLAUDE.md`（プロジェクトルート、全文）
- `AGENTS.md`（システムプロンプトに埋め込まれた内容として参照。本セッションで個別に Read
  ツールを使って開いてはいない）
- `scripts/db-migrate.mjs`（全文）
- `package.json`（`cat` コマンドで dependencies / devDependencies / scripts を確認。ライセンス等
  下部は未確認）
- `tsconfig.json`（全文）
- `eslint.config.mjs`（`head -60` で確認。出力が完結していたため実質全文）
- `docs/task-list.json`（95〜134行目。`task_004` のエントリのみ）
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`（全文）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`（全文）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`（全文）
- `node_modules/@libsql/client/package.json` の `exports` フィールド（`grep` で抽出）
- `node_modules/@libsql/client/lib-esm/web.d.ts`（全文）

**`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` は本セッションで
直接読んでいない。** `task_004a.md` の0.3節が同ファイルの該当箇所を引用しており、それを根拠にした。
`proxy.ts` は本タスクで変更しないファイルであるため、直接の再読は行わなかった。

---

## 12. Opus による点検と修正（2026-08-14。委譲前に実施）

Sonnet が起草した本指示書を Opus が点検し、次の3点を直した。haiku は修正後の本文に従う。

1. **6.7b が誤パスワードを2回送る手順になっていた。** ヘッダ確認用と body 確認用で curl を2本
   並べていたため、レート制限の失敗回数が1回ずれ、c章の「累計5回目で429」が成立しなくなる。
   `-D -` の1本でヘッダと body の両方を確認する形に直した。
2. **6.9 に存在しない出典が書かれていた。** 「`docs/takeover-plan.md` 2.4 に 8787 と 8788 の両方を
   観測している記録がある」という記述は事実ではない（同節は環境・外部ツールの表であり、ポート番号の
   観測記録は無い）。実在する `docs/PROGRESS.md` §2 の `BASE_URL=http://localhost:8787` の実績に
   置き換えたうえで、起動ログの表示を見て実ポートを使う指示だけを残した。
3. **ログとPIDの置き場所を `/tmp` から scratchpad に変えた。**

あわせて Opus が独立に確認した事項:

- **`cookies()` を Route Handler で書き込みに使う設計（5.3・5.4）は Next 16 のドキュメントどおりである。**
  `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` の6行目に
  「read/write outgoing request cookies in Server Functions or **Route Handlers**」、153行目に
  「`(await cookies()).set(name, value, options)` を Server Function または Route Handler で使える」、
  282行目に削除の手段として `maxAge: 0` が明記されている。
- 5.9 で Sonnet が補ったその他の設計判断（処理順序、CSRF失敗をレート制限のカウンタ対象外にする、
  logout でセッションを再検証しない）は、いずれもスコープと不変条件に反しないため**採用する**。
