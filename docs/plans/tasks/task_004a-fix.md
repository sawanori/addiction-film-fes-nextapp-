# task_004a-fix: 品質チェックで検出された指摘の修正

最終更新: 2026-08-14 / 執筆: Sonnet（Opus の裁定に基づく）/ 実装担当: haiku / 検証担当: Opus（メインリポジトリで独立実行）

この指示書は `docs/takeover-plan.md` §7 の品質チェックループに基づき、task_004a
（`lib/admin/auth.ts` と `proxy.ts`）実装後に Opus・codex・gemini-3.5-flash の3者レビューで検出された
指摘のうち**採用したもの**を修正するための作業指示書。`docs/plans/tasks/task_003-fix.md` と同じ形式で書く。
**このタスクでも公開面の見た目・文言は一切変えない。**

---

## 0. 前提（経緯と実測値。ここに無い数値・記述を発明しない）

haiku が task_004a を実装し、Opus が独立に検証、そのうえで Opus / codex / gemini-3.5-flash の3者が
レビューした。**gemini-3.5-flash は完了の定義・仕様整合・スコープの3点すべてで指摘なし**だった。
codex が3件、Opus が1件の指摘を出し、4件とも採用する。いずれも認証を突破される欠陥ではなく、
認証コアとしての堅牢性と型安全性の問題である。

### 0.1 現在のリポジトリ状態（重要）

着手時の `git status --porcelain` の期待される出力は次のとおり。これ以外の行があったら着手せず
停止して報告する。

```
?? lib/admin/auth.ts
?? proxy.ts
```

**task_004a の実装と今回の修正はまとめて1コミットにする。haiku はこのタスクでコミットしない。**

### 0.2 Opus が独立実行した検証結果（すべて合格。修正後も維持すること）

| 確認 | 結果 |
|---|---|
| `GET /admin` | 307 / Location `http://localhost:3111/admin/login?next=%2Fadmin` |
| `GET /admin/docs/tickets` | 307 / Location に `next=%2Fadmin%2Fdocs%2Ftickets` |
| `GET /api/admin/documents` | 401 / body `{"error":"unauthorized"}` |
| 署名が壊れた偽Cookie付き `GET /admin` | 307（署名検証が効いている） |
| `GET /api/admin/login` と `GET /admin/login` | 404（未実装。想定どおり） |
| `GET /tickets`（公開面） | 200 |
| `npm run build` / `npx tsc --noEmit` | 終了コード0 |
| `npm run lint` | `✖ 6 problems (2 errors, 4 warnings)`（着手前と同一） |
| `npm run verify:text` | 完全一致（8ルート / 要素1948個 / テキストノード1057個 / コメントノード0個） |
| `git diff --exit-code -- app/globals.css` | 終了コード0 |
| `test ! -f middleware.ts && test -f proxy.ts` | 終了コード0 |

---

## 1. 対象の指摘（採用分。各指摘は「現象 / 根拠となる記述 / 修正内容 / 検証方法 / 指摘者」の順で書く）

### 指摘1（major・修正する）: セッション payload の実行時検証が無く、`exp` の判定が fail-open

- **現象**: `lib/admin/auth.ts` の `verifySessionCookie` は `JSON.parse` の結果をそのまま
  `SessionPayload` として扱い、`exp` が欠落・非数値でも `payload.exp <= now` が `false` になるため、
  期限切れ扱いされずに payload を返す。
- **根拠となる記述**: `lib/admin/auth.ts:228` の `const payload: SessionPayload = JSON.parse(payloadJson);`、
  `lib/admin/auth.ts:232-234` の `if (payload.exp <= now) { return null; }` と `return payload;`。
- **修正内容**: `JSON.parse` の結果が plain object であり、`iat` / `exp` / `ver` がいずれも
  `Number.isSafeInteger()` を満たすことを検証する。満たさなければ `null` を返す。期限判定は
  「`exp > now` を満たすときだけ通す」形（fail-closed）に書き換える。
- **検証方法**: `npx tsc --noEmit` と `npm run build` が終了コード0。実測済みの curl 結果
  （偽Cookieで307、`/api/admin/documents` で401）が変わらないこと。
- **指摘者**: codex（major）/ Opus（同一の懸念を独立に検出）。
- **補足**: この payload に到達するには HMAC 署名の検証を通過している必要があるため、外部から
  署名なしで突破できる経路ではない。認証コアとして fail-closed にするための修正である。

### 指摘2（minor・修正する）: 定数時間比較がコメントと仕様に一致していない

- **現象**: `constantTimeCompare` はコメントで「lengths differ, still compare all bytes」と書いているが、
  実際は短い方の長さまでしかループしない。計画 §9.1 の「XORループで定数時間比較」という記述ともズレる。
- **根拠となる記述**: `lib/admin/auth.ts:117` のコメント
  `// If lengths differ, still compare all bytes to avoid timing leak`、`lib/admin/auth.ts:120-123` の
  `const minLength = Math.min(a.length, b.length);` と `for (let i = 0; i < minLength; i++)`。
- **修正内容**: PBKDF2 のハッシュ長を先に検証して 32バイト固定で比較する形にする（長さが 32 で
  なければその時点で false）。もしくは長い方の長さまでループし、範囲外は 0 として XOR に含める。
  **どちらか一方を選び、コメントを実装と一致させる。**
- **検証方法**: `npx tsc --noEmit` 終了コード0。`npm run build` 終了コード0。
- **指摘者**: codex（minor）。

### 指摘3（minor・修正する）: `as unknown as NextResponse` の二重アサーション

- **現象**: `proxy.ts` の `handleUnauthenticated` は戻り値型を `NextResponse` と宣言しているため、
  ネイティブの `Response.json()` を返すのに二重アサーションが要る。型の不整合を隠しており、将来
  この戻り値を `NextResponse` 前提で扱う変更が入ると型検査をすり抜ける。
- **根拠となる記述**: `proxy.ts:47` の
  `function handleUnauthenticated(request: NextRequest, pathname: string): NextResponse {`、
  `proxy.ts:50-53` の `return Response.json({ error: 'unauthorized' }, { status: 401 }) as unknown as NextResponse;`。
- **修正内容**: 戻り値型を `NextResponse | Response` にして、`Response.json(...)` をアサーションなしで
  そのまま返す。
- **検証方法**: `npx tsc --noEmit` 終了コード0。`GET /api/admin/documents` が引き続き 401 で body が
  `{"error":"unauthorized"}` であること。
- **指摘者**: codex（minor）/ Opus（同一の懸念を独立に検出）。
- **補足**: `CLAUDE.md` は `lib/style.ts` について「`as CSSProperties` で object 全体をアサートしない
  （typo が型チェックをすり抜けるため）」という方針を明記している。この修正は同じ方針に沿う。

### 指摘4（minor・修正する）: 標準base64の秘密鍵を base64url デコーダで復号している

- **現象**: `ADMIN_SESSION_SECRET` は `openssl rand -base64 32` 相当で生成した**標準base64**だが、
  `signSessionCookie` と `verifySessionCookie` はどちらも `base64UrlToBytes(secret)` で復号している。
- **根拠となる記述**: `lib/admin/auth.ts:155` の `const secretBytes = base64UrlToBytes(secret);`、
  `lib/admin/auth.ts:204` の同一行。
- **修正内容**: 秘密鍵の復号には既存の `base64ToBytes(secret)` を使う。`base64UrlToBytes` は Cookie の
  payload と署名の復号にだけ使う。
- **検証方法**: `npx tsc --noEmit` と `npm run build` が終了コード0。**修正の前後で挙動が変わらないこと**
  （`GET /admin` が307、`/api/admin/documents` が401、偽Cookieで307）。
- **指摘者**: Opus。
- **補足**: 現在の秘密鍵の値では両者の結果は一致するため実害は出ていない（`-`→`+`・`_`→`/` の置換が
  標準base64に対しては何もせず、44文字はパディング済みのため）。ただし秘密鍵に `-` や `_` が含まれる
  値へ差し替えると**黙って別の鍵として解釈され、既存セッションが全て無効になる**。将来の事故を防ぐ
  ための修正である。

---

## 2. スコープ

- 指摘1〜4の修正（`lib/admin/auth.ts` と `proxy.ts` の範囲内）

### 非スコープ（やらないこと）

- 既存の lint 指摘6件の修正
- task_004b の範囲（ログイン画面・`app/(admin)/` 配下・`/api/admin/login|logout`・`lib/admin/rate-limit.ts`）
- 本番デプロイ・DB接続
- `git commit` / `git add`

---

## 3. 白名簿

- `lib/admin/auth.ts`
- `proxy.ts`

## 4. 触ってはいけないもの

- `app/` 配下すべて
- `components/` 配下すべて
- `content/` 配下すべて
- `lib/` 配下の `admin/auth.ts` 以外すべて
- `scripts/` 配下すべて
- `verification/baseline/` 配下すべて
- `app/globals.css`
- `wrangler.jsonc` / `open-next.config.ts` / `next.config.ts`
- `package.json` / `package-lock.json`
- 日本語の文言すべて

---

## 5. 禁止コマンド（実行しない。必要になったら停止して報告する）

`docs/plans/tasks/task_003-fix.md` §5 と同じもの（`rm -rf`、`git checkout -- `、`git reset --hard`、
`git clean`、`npm run verify:text -- --update`、`verification/baseline/` への書き込み、`wrangler login`、
既存6件の lint 指摘の修正、`git commit` / `git add`）に加えて:

- **`middleware.ts` を作らない**（Next 16 で廃止された規約。`check_008` に違反する）
- **`.dev.vars` の中身を読み取ってログや報告に貼らない**（シークレットのため。形式の確認が必要なら
  「4フィールドある」等の構造だけを書く）

---

## 6. 手順

各コマンドの終了コードと出力を必ず記録しながら進める。

### 6.1 着手前確認

```bash
git status --porcelain
```

- 出力が 0.1 の期待どおり（`?? lib/admin/auth.ts` と `?? proxy.ts` の2行のみ）であることを確認する。
  **これ以外の行があれば作業せず停止して報告する（クリーンでないのが正常なので、クリーンにしようと
  しない）。**

### 6.2 指摘1〜4の修正

1章の修正内容に従って `lib/admin/auth.ts` と `proxy.ts` を修正する。

### 6.3 型チェックとビルド

```bash
npx tsc --noEmit
npm run build
```

- それぞれの終了コードを記録する。

### 6.4 lint の確認

```bash
npm run lint
```

- 最終行が `✖ 6 problems (2 errors, 4 warnings)` から増えていないことを確認する。**終了コードは1が
  正常**（着手前から既存6件があるため）。増えていたら停止して報告する。

### 6.5 公開面への影響がないことの確認

```bash
npm run verify:text
```

- 完全一致であることを確認する。

### 6.6 `next start` での再確認

`next start` をバックグラウンド起動し、以下を確認する。期待値は 0.2 の実測表と同じ。

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:3000/admin
# 期待: 307 で redirect_url に /admin/login?next= を含む

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/admin/documents
curl -s http://localhost:3000/api/admin/documents
# 期待: 401 / body {"error":"unauthorized"}

curl -s -o /dev/null -w "%{http_code}" \
  -H "Cookie: aff_admin=v1.eyJpYXQiOjEsImV4cCI6OTk5OTk5OTk5OSwidmVyIjoxfQ.AAAA" \
  http://localhost:3000/admin
# 期待: 307（署名が壊れた偽Cookieでは通過しない）

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/login
# 期待: 404（ログイン画面は task_004b でまだ実装していないため、これが正常。404 を理由に停止しない）

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/tickets
# 期待: 200（公開面が壊れていないことの確認）
```

### 6.7 preview の停止確認

- サーバを停止したあと、使用したポートに対して `lsof -nP -iTCP:<使ったポート> -sTCP:LISTEN` を実行し、
  出力が空であることを確認する。

### 6.8 最終確認

```bash
git status --porcelain
```

- `?? lib/admin/auth.ts` と `?? proxy.ts` の2行だけであることを確認する。`git add` / `git commit` はしない。

---

## 7. 停止条件

以下に該当したら、その場で作業を止めて Opus に報告する。自己判断で回避策を取らない。

- 6.1 の `git status --porcelain` が期待どおりでない場合
- `npm run lint` の最終行が `✖ 6 problems (2 errors, 4 warnings)` から増えた場合
- `npm run verify:text` が完全一致にならない場合
- `npm run build` または `npx tsc --noEmit` が終了コード0以外を返した場合
- 6.6 の curl 結果が期待値と異なる場合。**ただし `/admin/login` の404は例外で、これは想定どおりなので
  停止しない**
- 白名簿外のファイルに変更が必要になった場合

---

## 8. 完了の定義

- 指摘1〜4がすべて修正されている
- `npx tsc --noEmit` が終了コード0
- `npm run build` が終了コード0
- `npm run lint` の最終行が `✖ 6 problems (2 errors, 4 warnings)`（着手前と同一）
- `npm run verify:text` が完全一致
- 0.2 の実測結果（`GET /admin` が307、`GET /api/admin/documents` が401、偽Cookieで307、`GET /tickets` が
  200）がすべて維持されている
- `git status --porcelain` が `?? lib/admin/auth.ts` と `?? proxy.ts` の2行のみである

## 9. 完了報告のフォーマット

各コマンドの**終了コードと出力の該当行**を貼ること。「成功しました」だけの報告は不可。
実行していない手順は「未実行」と明記すること。最低限、以下を含める:

1. 6.1 の `git status --porcelain` の出力
2. 6.2 の差分内容（指摘1〜4それぞれの修正箇所そのもの）
3. 6.3 の `npx tsc --noEmit` / `npm run build` の終了コード
4. 6.4 の `npm run lint` の終了コードと最終行
5. 6.5 の `npm run verify:text` の終了コードと出力
6. 6.6 の全 curl 結果（4本）とそれぞれの期待値との一致状況
7. 6.7 の `lsof` 出力（空であることの確認）
8. 6.8 の最終 `git status --porcelain` 出力

---

## 10. 記録するが、この修正計画書では直さない指摘

haiku はこれらに手を出さない。

- **`next` パラメータが元のクエリ文字列を落としている**（Opus・info）: `proxy.ts` は
  `loginUrl.searchParams.set('next', pathname)` としており、元URLのクエリ文字列は引き継がれない。
  計画 §9.1 は `/admin/login?next=...` としか書いておらず仕様違反ではない。ログイン後の復帰先に
  クエリが要るかは task_004b でログイン画面を作るときに判断する。
- **401レスポンスに `Cache-Control: no-store` が無い**（Opus・info）: 現状 401 が中間キャッシュに
  保存される実害は確認していない。task_004b で API を実装するときに、管理API全体のキャッシュ方針
  としてまとめて判断する。

## 11. 却下した指摘

なし。gemini-3.5-flash は完了の定義・仕様整合・スコープの3つの判定すべてで「指摘事項なし」と回答し、
codex の3件と Opus の1件はすべて採用した。
