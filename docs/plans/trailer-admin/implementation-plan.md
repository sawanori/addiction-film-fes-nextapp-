# Implementation Plan: 管理画面から予告編URLを登録できるようにする

> **配置について**: このリポジトリの `docs/implementation-plan.md` / `docs/task-list.json` /
> `docs/acceptance-checks.json` は **/admin 管理画面構築（v2）の正典**で、コード注釈から
> 「計画 §5」「§8.4」「§9.1」「§9.2」として参照されている（`lib/content/manifest-core.ts`、
> `lib/admin/ops.ts`、`app/api/admin/login/route.ts` ほか）。上書きすると参照が壊れるため、
> 後続案件は `docs/takeover-plan.md` と同じ流儀で**別名・別ディレクトリ**に置く。
> 本計画一式は `docs/plans/trailer-admin/` に置く。

> **版**: v2.1（2026-08-27）
> v2.1 は実装中の実測で v2 の想定が1つ外れたため追記した。`always` だけでは
> 「`trailer` キーが全作品から消えた版へ revert した場合」を救えず、manifest を
> 正典との「形の和」から導出する変更を足した（詳細は §9.3）。
>
> **版**: v2（2026-08-27）
> v1 を gemini 2.5 Pro と codex に敵対的レビューさせ、採否を §16 に記録して改訂した。
> v2 の主な変更: 不正な動画IDを **422 で拒否**する方針へ転換（v1 は「そのまま保存」）、
> URL→ID変換を **PUT だけでなく PATCH にも**適用、欠落キー問題をデータ埋めではなく
> **manifest の `always` フラグ**で根本から塞ぐ、検証から `tsx` 依存を排除。
> 前提コミット: `4ab25cc`

## 1. Overview

2026-08-27 に静的HTML版から移植した予告編モーダルは、動画ID・開始秒・読み上げ文・帯の文字を
`content/films.json` の `trailer` に持たせ、管理画面（`/admin/docs/films`）から編集できる形にした。
しかし実運用で2つの穴が見つかった。

1. **予告編URLをそのまま貼れない。** 欄が受け付けるのは動画ID（`Ml8xEePJGoo`）だけで、
   利用者が持っているのは URL（`https://www.youtube.com/watch?v=Ml8xEePJGoo`）である。
2. **予告編がまだ無い4作品には、管理画面から予告編を追加できない。**
   グループの入力欄は「値が `undefined` でない子項目」しか描画されないため、
   `trailer` キーを持たない 01・02・03・06 は見出しだけが出て入力欄が0個になる。
   04 も `start` キーを持たないため「再生開始位置（秒）」欄が出ない。

本計画は、この2点を塞いで「**予告編URLを貼って保存すれば、その作品に予告編が出る**」状態にする。

## 2. Goal

**利用者の目標**: 新しい予告編URLをもらったとき、開発者を通さず管理画面だけで公開できる。
URLをコピーして貼り、保存を押すだけで済む（動画IDの取り出し方を知らなくてよい）。
入力を間違えたときは、**公開ページが壊れる前に管理画面で教えてもらえる**。

**プロジェクトの目標**: 予告編の追加を「コンテンツ編集」の範囲に収め、コード変更・再デプロイを
不要にする。`docs/implementation-plan.md` §5 の編集網羅性を予告編についても実質的に満たす。

## 3. Current State

以下はすべて本セッションで**実測して確認した事実**である。

### 3.1 データ（`content/films.json`）

- `trailer` を持つのは 04「一瞬の楽園」と 05「アディクトを待ちながら」の2件のみ。
- 04 は `{id, aria, label}` の3キー、05 は `{id, start, aria, label}` の4キー。
- 01・02・03・06 には `trailer` キーそのものが無い。

### 3.2 manifest（自動導出）

`createManifestBuilder` は配列要素の**キーの和**を `unify()` で取るため、manifest には既に
`items[].trailer.{id, aria, label, start}` があり、新規作品用 `template` にも4キーが入っている
（manifest を出力して確認）。**manifest 側に不足はない。**

### 3.3 保存経路

- 管理画面フォームは **PUT `/api/admin/documents/[key]`**（ドキュメント全体を送る）。
  検証は `validateDocument()`（`lib/admin/ops.ts:165`）で、送られてきた値を走査して
  manifest と突き合わせる方式。**事前にパスが存在する必要はない**。
- 実測: 01 に `trailer.id` だけ足したドキュメントは **エラー0件**で通る。
  manifest に無いキーを混ぜたときだけ拒否される。→ **保存は塞がっていない。**
- **PATCH の ops 経路**（プログラム用）は存在しないパスへ `set` できない（`ops.ts:276`）。
- **revert 経路**（`revert/route.ts:40`）は `target.data` を**検証も変換もせず**書き戻す。

### 3.4 フォーム描画（真の原因）

`FieldEditor.tsx:93-98` は、値が `undefined` / `null` の子項目を**入力欄ごと落とす**。
本番の管理画面HTMLで裏を取った: 「YouTube の動画ID」は2回（04・05のみ）、
「再生開始位置（秒）」は1回（05のみ）しか現れない。

### 3.5 これは予告編だけの問題ではない（v2 で判明）

全11ドキュメントを走査したところ、**同じ理由で描画されない入力欄が125件**ある。
内訳は2種類で、扱いが正反対である。

- **(a) 本来あるべき任意キーが、その要素にだけ無い**（例: `films.items[0].delay`、
  `programme.guide.rows[0].id`、`tickets.price.boxes[0].delay`、`site.footer.columns[4].items[].base`）。
  → 入力欄が出るべきなのに出ていない。予告編と同じ問題。
- **(b) 要素ごとに形が違う多態な配列**（`privacy.sections[].blocks[]`・`terms` の
  `blocks[]` は `{t:"p", value}` か `{t:"ol", items}`）。manifest はその**和**なので、
  段落ブロックに箇条書き用の `items` 欄を出すのは**誤り**。
  → こちらは今の挙動が正しい。

したがって「undefined の子も一律に描画する」という一般化はできない。**パスを指定して
明示的に開ける仕組み**が要る（§7.2）。予告編以外の (a) は本計画のスコープ外とし、§5 に残す。

### 3.6 公開ページの描画

`components/Films.tsx` は `film.trailer?.id` が真のときだけ `.film__play` を描画し、
`aria` と `label` を**そのまま**出す。IDだけ入れて保存すると、読み上げ文が空・帯の文字が
空（`.film__play-label` は背景色と padding を持つので、黒い小さな矩形だけが出る）になる。

### 3.7 文字列の扱いに関する既存方針

`lib/admin/ops.ts` 冒頭に明記されている: **「文字列を trim・正規化・全角半角変換しない
（`docs/implementation-plan.md` §8.4）。唯一の例外は改行コード」**。

## 4. Scope

- **A. 入力欄を必ず出す**: manifest に「値が無くても入力欄を出すパス」を宣言できるようにし
  （`always`）、予告編の4欄に付ける。あわせて `content/films.json` の全作品に4キーを揃える。
- **B. URL→動画ID変換**: 共有パーサを新設し、`items[].trailer.id` にだけ適用する。
  **PUT と PATCH の両方**（＝すべての書き込み経路）で変換する。
- **C. 動画IDの検証**: `items[].trailer.id` は **空文字か11文字の動画ID**だけを保存可とし、
  URL は変換し、**変換できない非空の値は 422 で拒否**する。
- **D. 公開ページの堅牢化**: `aria` / `label` が空でも成立するよう `Films.tsx` に既定値を置く。
- **E. 文言**: 「URLをそのまま貼れる」「空欄なら Trailer と出る」ことを hint に書く。
- **F. 反映と検証**: 型・lint・ビルド・編集網羅性・8ルート回帰、管理画面の実操作、
  デプロイ、本番/dev 両DBへの seed。

## 5. Non-Scope

- **§3.5 (a) の予告編以外の欠落入力欄（残り約100件）。** 同じ `always` の仕組みで開けられるが、
  対象ごとに「空文字を保存して公開DOMが変わらないか」を個別に確かめる必要があり、
  回帰面積が大きい。**別案件として §17 に申し送る。**
- **§3.5 (b) の多態ブロック。** 現在の挙動が正しいので触らない。
- 画像・動画ファイルのアップロード機能（元計画でフェーズ2扱い）。
- **URL の `t=` / `start=` から「再生開始位置（秒）」を自動入力すること。**
  1つの欄への入力が別の欄を書き換える挙動は予測できないため採らない。
- YouTube 以外（Vimeo 等）への対応。現行モーダルは YouTube 埋め込み専用。
- **revert 経路のコード変更**（理由は §9.3 の帰納法による）。
- **iframe への `sandbox` 追加**（不採用の理由は §16-6）。
- 予告編以外の欄への文字列正規化の拡大。§8.4 の方針は維持する。

## 6. Assumptions

- YouTube の動画IDは11文字の `[A-Za-z0-9_-]`。この形に合わないものはIDとして扱わない。
- 01・02・03・06 の予告編は**まだ公開されていない**。空欄のまま＝ボタン非表示で、
  公開出力は現行と1バイトも変わらない（検証で担保する）。
- 本番DB・dev DB とも、直近の seed 以降に管理画面からの編集が入っていない
  （入っていた場合は seed 前の差分確認で検出し、作業を止める）。
- 利用者が貼るURLは通常の視聴URL・共有URL・埋め込みURLのいずれか。短縮URLは展開しない。
- Node 22 が `.ts` を型剥がしで直接 import できる（`scripts/verify-coverage.mjs` が
  `../lib/content/manifest-core.ts` を import している実績がある）。

## 7. Architecture Impact

| 層 | 影響 |
|---|---|
| フロントエンド（公開） | `components/Films.tsx` に既定値の分岐が1つ増える。DOM出力は現行と不変 |
| フロントエンド（管理） | `FieldEditor.tsx` に「always な子は値が無くても描画」と「blur で変換」の2点 |
| API | PUT に整形が1段入る。PATCH は ops 検証前に整形。エンドポイント・リクエスト形は不変 |
| manifest | `Field` 型に任意プロパティ `format` / `always` が増える。既存パス・型は不変 |
| データベース | **スキーマ変更なし。** `content_documents.data`（JSON）の中身のみ |
| 認証・ストレージ・インフラ | 変更なし |

### 7.2 `always`（値が無くても入力欄を出す）

`PATH_LABELS` と同じく**正規化パスで宣言**する。`FieldEditor` の絞り込みを
`!isEmptyValue(値) || child.always` に変える。これにより:

- 予告編を持たない作品でも4欄が出る（データの状態に依存しない）
- **revert で古いリビジョン（`trailer` キーが無い時代のもの）を復元しても再発しない**
- 多態ブロック（§3.5(b)）には付けないので、誤った欄は増えない

データ側の空文字埋め（A）は、これとは役割が違う。`always` が「フォームが必ず開くこと」を
保証し、データ側は「保存済みの形を全作品でそろえて、DBとJSONの差分を読みやすくする」。
**どちらか一方でも動くが、両方あると壊れ方が浅くなる。**

## 8. UI Plan

### 8.1 管理画面 `/admin/docs/films`

- 「上映作品」→ 各作品に「予告編」グループが出る（**6作品すべて**、4欄）。
- 「YouTube の動画ID」欄:
  - hint: 「**動画のURLをそのまま貼れます**（保存時に動画IDへ変換します）。空欄なら再生ボタンを出しません」
  - 入力欄からフォーカスが外れた時点でURL→IDに変わる（その場で見える）
  - **変換できない非空の値は保存時に 422**。フォーム上部の既存のエラー一覧に
    「YouTube の動画URLか、11文字の動画IDを入れてください」と出る（入力は消えない）
- 「再生ボタンの帯の文字」欄の hint: 「例: Trailer。**空欄なら Trailer と表示します**」
- 「再生ボタンの読み上げ文」欄の hint: 「画面には出ません。**空欄なら『作品名』の予告編を再生 と読み上げます**」
- レスポンシブ: 既存の `.adm__row` / `.adm__nest` をそのまま使うため変更なし。

### 8.2 公開ページ（index / programme）

- 見た目の変更なし。予告編を持たない作品は静止画のまま。
- IDを入れた作品には、既存4作品と同じ黒丸の再生ボタンと「TRAILER」帯が出る。
- `aria` が空なら `『<作品タイトル>』の予告編を再生`、`label` が空なら `Trailer` を使う。

## 9. API Plan

新規エンドポイントなし。

### 9.1 PUT `/api/admin/documents/films`（管理画面フォーム）

| 項目 | 内容 |
|---|---|
| 認証 | 既存のまま（Cookie セッション + `x-aff-admin: 1`） |
| リクエスト | `{ baseRevision, data, note }`（既存のまま） |
| 追加処理 | `normalizeDocument` の後、`validateDocument` の**前**に `formatDocument` |
| 変換 | manifest で `format: "youtube-id"` が付いたリーフだけ（下表） |
| 検証 | 変換後の値が「空文字」か「11文字の動画ID」でなければ 422 |
| レスポンス | `{ data, revision }`。`data` は**変換後**の値（フォームに反映される） |

### 9.2 PATCH（プログラム用の ops 経路）

`applyOps` の中で、`set` の値に同じ変換と検証を適用する。**すべての書き込み経路で
「保存されている値は必ず空文字か11文字のID」という不変条件が成り立つ**ようにするため。

### 9.3 revert（コード変更なし。ただし v2 の想定は実測で覆った）

`revert` は過去リビジョンをそのまま書き戻す。ここに変換・検証を足さない理由:

1. 9.1・9.2 により、**今後書かれるリビジョンはすべて空文字か11文字のID**になる。
2. 既存のリビジョン（本改修より前）は seed と PUT 由来で、いずれも `content/films.json` の
   IDが入っている。実測で全リビジョンを確認済み（URL を含むものは存在しない）。

**v2 の想定が外れた点（実測で判明・v2.1 で修正）**: 「`always` があるので、`trailer` キーの
無い版へ revert しても入力欄は消えない」と書いたが、**これは誤りだった**。
`always` は manifest に**そのフィールドが存在するとき**にだけ効く。ところが manifest は
`buildManifest(key, stored.data)` のとおり**保存されているデータの形**から導出されるので、
全作品から `trailer` が消えた版に戻すと **manifest からフィールドごと落ち**、`always` は
出番なく入力欄が0個になる。実測: その状態で編集画面を取得したところ、4つのラベルすべてが
**0回**だった（期待は6回）。

**採った対処**: `lib/content/manifest.ts` の `buildManifest` を、
**同梱JSON（正典）と保存データの「形の和」**から導出するよう変えた（`unify` を再利用）。
manifest は形の導出にしか使わない（値は `initialData` として別に渡す）ので、
和をとってもフォームに出る値は変わらない。保存時の許可リストが正典のぶんだけ広がるのは、
まさに「消えた項目を入れ直せる」ために必要な広がりである。

再実測: 全作品から `trailer` を消した状態でも4つのラベルが**6回ずつ**出て、
その状態から動画URLを貼った PUT が 200 で通り、IDへ変換されて保存された。

### 9.4 変換規則

| 入力 | 結果 |
|---|---|
| `https://www.youtube.com/watch?v=ID`（`&t=` 等の付随パラメータ可） | `ID` |
| `https://youtu.be/ID` | `ID` |
| `https://www.youtube.com/embed/ID` / `youtube-nocookie.com/embed/ID` | `ID` |
| `https://www.youtube.com/shorts/ID` / `/live/ID` / `/v/ID` | `ID` |
| `m.youtube.com` / `music.youtube.com` の同形式 | `ID` |
| `youtu.be/ID`（スキーム省略。**既知ホスト名で始まる場合だけ** `https://` を補う） | `ID` |
| `ID`（11文字。前後に空白があっても可） | `ID` |
| 空文字 | 空文字（＝予告編なし） |
| 上記以外（他サービスのURL・書き損じ） | 変換せずそのまま → **検証で 422** |

## 10. Database Plan

- **スキーマ変更・マイグレーションなし。** 変更は `films` キーの JSON のみ。
- 反映手順（2026-08-27 の作業で確立した順序）:
  1. 本番・dev 両DBを `backups/` へ退避（`.gitignore` 済み）
  2. DB と `content/*.json` の全キー差分を取り、管理画面での編集が失われないことを確認
  3. **先にデプロイ**（新コードは旧データでも落ちない。逆順は避ける）
  4. 本番 → dev の順に `db-seed.mjs --force`
- ロールバック: 退避 JSON から書き戻す。公開側は `trailer` が無くても落ちない
  （`film.trailer?.id` の任意連鎖）。

## 11. File-by-File Plan

| ファイル | 種別 | 目的 | 変更内容 | リスク |
|---|---|---|---|---|
| `lib/content/youtube.ts` | 新規 | URL→動画IDの共有パーサ | `extractYouTubeId` / `isYouTubeId` を公開。既知ホストで始まる場合だけスキームを補う | 低 |
| `content/films.json` | 変更 | 保存済みの形をそろえる | 6作品すべてに `trailer: {id, start, aria, label}`（未設定は `""`）。既存2作品の値は変えない | 中（公開出力に影響しないことを回帰検証で担保） |
| `lib/content/types.ts` | 変更 | 型を実データに合わせる | `FilmTrailer` のコメント追記。`start?` は任意のまま（DBが旧形でも壊さない） | 低 |
| `lib/content/manifest-core.ts` | 変更 | 欄の性格を宣言する | `Field` に `format?: "youtube-id"` と `always?: true` を追加。`PATH_FORMATS` / `ALWAYS_SHOWN` 表を追加し `inferField` で付与。hint 3件を更新。`unify` を export | 中（**何も import しない**制約を守ること。破ると `verify-coverage` が壊れる） |
| `lib/content/manifest.ts` | 変更 | 項目定義が消えないようにする（v2.1・§9.3） | `buildManifest` を「同梱JSON（正典）と保存データの形の和」から導出するよう変更 | 中（保存時の許可リストが正典のぶん広がる。意図した広がりであることをコメントに残す） |
| `lib/admin/ops.ts` | 変更 | 変換と検証 | `formatDocument(doc, manifest)` を追加。`validateDocument` と `applyOps` に動画IDの形式検証を追加。§8.4 の例外である理由をコメントで明示 | 中 |
| `app/api/admin/documents/[key]/route.ts` | 変更 | 変換を保存経路へ | PUT で `formatDocument` を挟む | 低 |
| `app/(admin)/admin/docs/[key]/FieldEditor.tsx` | 変更 | 欄を出す／その場で変換 | `always` な子は値が無くても描画。`format === "youtube-id"` の欄に `onBlur` 変換。グループの描画契約をコメントで明示 | 中 |
| `components/Films.tsx` | 変更 | IDだけでも成立させる | `aria` 空欄時と `label` 空欄時の既定値 | 低（既存2作品は値があるため出力不変） |
| `scripts/verify-youtube-id.mjs` | 新規 | パーサの回帰テスト | §9.4 の全パターンを検証。`node` で直接動く（`tsx` に依存しない） | 低 |
| `CLAUDE.md` / `README.md` / `docs/PROGRESS.md` | 変更 | 仕様と経緯の記録 | 予告編の登録方法、§8.4 の例外、§3.5 の申し送り | 低 |

## 12. Implementation Order

1. `task_001` パーサ `lib/content/youtube.ts` ＋ `scripts/verify-youtube-id.mjs`
2. `task_002` manifest に `format` / `always` と hint（`manifest-core.ts`）
3. `task_003` 変換と検証（`ops.ts` ＋ PUT ルート）
4. `task_004` 管理UI（`FieldEditor.tsx`）
5. `task_005` データ `content/films.json` の4キー統一
6. `task_006` 公開側の既定値（`Films.tsx`）
7. `task_007` 検証（機械検証＋管理画面の実操作＋revert）
8. `task_008` ドキュメント追随とコミット
9. `task_009` デプロイと両DBへの反映

## 13. Verification Commands

リポジトリに実在するものだけを挙げる。

```bash
npx tsc --noEmit                     # 型チェック
npm run lint                         # ESLint（既存の指摘6件から増えないこと）
npm run build                        # 本番ビルド
npm run verify:coverage              # 編集網羅性
npm run verify:text                  # 公開8ルートの DOM パス比較（baseline と完全一致）
node scripts/verify-youtube-id.mjs   # 本計画で追加するパーサの回帰テスト
npm start                            # 本番ビルドの起動（手動確認用）
npm run deploy                       # Cloudflare Workers へデプロイ
node scripts/db-seed.mjs --force     # DB へ投入（接続先は環境変数で切り替え）
```

**`verify:text` の baseline は更新しない。** 公開出力が変わらないことが要件のため、
現行 baseline に対して合格させる。`verify:text` は dev DB を読むので、
**実操作の試し書きを戻してから**実行すること。

## 14. Acceptance Criteria

1. 管理画面で**6作品すべて**に「予告編」の4欄が表示される。
2. 動画ID欄に `https://www.youtube.com/watch?v=Ml8xEePJGoo` を貼って保存すると `Ml8xEePJGoo` になる。
3. 予告編を持たない作品（例: 01）にIDを入れて保存すると、公開ページに再生ボタンが出て再生できる。
4. 読み上げ文・帯の文字が空でも、`aria-label` が `『<作品タイトル>』の予告編を再生`、帯が `Trailer` になる。
5. **YouTube と解釈できない非空の値は 422 で拒否され、入力は消えない。**
6. 予告編を入れていない状態で、公開出力が現行 baseline と**完全一致**する。
7. `npx tsc --noEmit` / `npm run build` / `npm run verify:coverage` / `node scripts/verify-youtube-id.mjs` が通る。
8. `npm run lint` の指摘が既存6件から増えない。
9. 既存の 04・05 が従来どおり再生でき、05 は3秒から始まる。
10. **版1へ revert しても、6作品に4欄が出る**（§9.3 の仮説の検証）。
11. 本番・dev 両DBが `content/films.json` と一致し、本番URLで 1〜10 が成立する。

## 15. Repair Loop

1. 検証コマンドを実行する（§13）
2. エラー出力を**そのまま**記録する（要約しない）
3. エラーを `task-list.json` の `task_id` に対応づける
4. **対応するタスクの `files_to_modify` に挙がっているファイルだけ**を直す
5. 検証コマンドを再実行する
6. 実装が計画と食い違ったら、コードではなく**本計画書を先に更新**してから進める

注意する分岐:

- `verify:text` に差分 → **空の `trailer` が DOM に漏れている**か、**dev DB に試し書きが残っている**。
  baseline を更新して通してはいけない。
- `verify:coverage` が落ちた → `manifest-core.ts` に import を足していないか、
  `PATH_FORMATS` / `ALWAYS_SHOWN` の付与位置が `inferField` の分岐に合っているか。
- 管理画面が500 → `manifest-core.ts` の import 制約に触れた可能性。

## 16. 敵対的レビューの結果と採否（v1 → v2）

gemini 2.5 Pro（以下 G）と codex（以下 C）に v1 をレビューさせた。

| # | 指摘 | 出所 | 採否 | 対応 |
|---|---|---|---|---|
| 1 | PATCH 経路で URL→ID 変換が効かない（高） | C1, G1 | **採用** | §9.2。`applyOps` の `set` にも適用 |
| 2 | revert で未変換値・欠落キーが復活する（高） | C2, G1 | **採用（別解）** | revert を触らず、§7.2 の `always` で根本を塞ぐ。理由は §9.3、検証は check_014 |
| 3 | 不正な動画IDを保存でき、壊れた iframe が出る（高） | C3, G3 | **採用** | v1 の「そのまま保存」を撤回し、422 で拒否（§9.1・§4-C） |
| 4 | 生IDの trim は §8.4 違反（中） | C4 | **一部採用** | この欄は散文ではなく機械形式であり、貼り付け運用で前後空白は日常的に混ざる。**この欄に限った例外**として trim を明記し（§9.4）、コードにも理由を残す。他の欄は従来どおり一切加工しない |
| 5 | 空文字埋めは seed 依存で恒久的でない（中） | C5, G5 | **採用** | §7.2 の `always`。データ埋めとは役割を分けて記載 |
| 6 | スキーム省略URLの仕様と手順が矛盾（中） | C6 | **採用** | 既知ホスト名で始まる場合だけ `https://` を補う（§9.4） |
| 7 | 検証が devDependency に無い `tsx` に依存（低） | C7 | **採用** | `scripts/verify-youtube-id.mjs` を追加し `node` だけで動かす |
| 8 | `FieldEditor` の描画契約が暗黙（低） | G5 | **採用** | コンポーネントにコメントを残す（§11） |
| 9 | `aria`/`label` を空にすると verify:text が落ちる（高） | G2 | **不採用** | 管理画面での編集で公開出力が変わるのは設計どおりで、baseline は `content/*.json` から作り直す前提。C も「既存04・05に値があるため公開DOMは壊れない」と結論しており、実測（check_008）でも担保する。ただし「空欄なら既定値が出る」ことは hint に明記する（§8.1） |
| 10 | iframe に `sandbox` を付ける（低） | G6 | **不採用** | 再生には `allow-scripts` と `allow-same-origin` が要り、両方許すと sandbox の意味がほぼ失われる。埋め込み先は `youtube-nocookie.com` に固定、`src` は `encodeURIComponent` 経由で、動画IDは11文字に検証（本改修）。加えて**姉妹サイト2つと挙動を揃える**必要があり、変換元 `script.js` にも sandbox は無い。C も「直ちに保存型XSSになる根拠はない」と結論 |

C が「問題なし」と明示した項目（v2 でも変更しない）: 空文字 `trailer` 追加による
`unify` / `stringFieldType` / `blankTemplate` / `manifestPaths` / `verify:coverage` への副作用、
`itemTitle`、新規追加 `template`、`Films.tsx` の既定値による公開DOMへの影響、保存型XSS。

## 17. 予告編以外の欠落入力欄（v3・2026-08-27 に対応済み）

§3.5 (a) は当初「約100件」と書いたが、**分類して数え直すと35件**だった
（残り85件は §3.5 (b) の多態ブロックで、出さないのが正しい）。この35件も同日に開いた。

### 17.1 内訳（26パス・35欄）

| 項目 | パス | 欄数 |
|---|---|---|
| 表示アニメの遅れ | `quick.cards[]` / `approach.cards[]` / `format.boxes[]` / `format.rows[]` / `news.items[]` / `items[]` / `background.boxes[]` / `approach.items[]` / `org.boxes[]` / `partner.boxes[]` / `archive.items[]` / `latest.articles[]` / `guide.rows[]` / `venue.boxes[]` / `price.boxes[]` の `.delay` | 17 |
| 見た目の種類 | `background.boxes[]` / `approach.cards[]` / `format.boxes[]` / `hero.actions[]` / `latest.articles[]` / `venue.boxes[]` の `.variant` | 7 |
| programme 用クレジット | `items[].metaProgramme` | 5 |
| フッターのリンク先 | `footer.columns[].items[].base` / `.hash` | 4 |
| リンク用のID | `guide.rows[].id` | 1 |
| 本文2の見た目 | `venue.boxes[].p2Cls` | 1 |

### 17.2 開ける前に必要だったコード側の手当て（2件）

`ALWAYS_SHOWN` に足すだけでは済まない項目が2つあった。いずれも**空欄で保存されたときに
公開DOMが変わってしまう**もので、先に描画側を直した。

- **`components/Films.tsx` の `metaProgramme`**: `film.metaProgramme ? … : film.meta` は
  **空配列を真と判定する**。書きかけて消すと `[]` が保存され、programme のクレジットが
  丸ごと消える。`?.length` で見るよう変更した。
- **`components/SiteFooter.tsx` の `hasLink`**: `"base" in item` という**キーの有無**だけの
  判定だったため、空文字の `base` が `href=""` のリンクになる。`base` に中身があるかで
  判定するよう変更した。既存リンクのリンク先を空にした場合にも効く（元からあった穴）。

`delay` / `variant` / `id` / `p2Cls` は、描画側が `x ? … : {}` か等値比較のため手当て不要だった。

### 17.3 検証

「新しく開けた35欄をすべて空欄のまま保存した状態」を dev DB に直接作り、公開8ルートを
baseline と突き合わせて**完全一致**を確認した（`空欄＝未設定` が DOM 上で等価であることの証明）。
そのうえで実際に値を入れて機能することも実測した:

- フッターのテキスト項目「よみうりホール」に `base=/programme` `hash=#venue` を入れて保存 →
  公開ページが `<a href="/programme#venue">よみうりホール</a>` になった
- 04 の programme 用クレジットを空配列にして保存 → 詳細クレジットが消え、短縮版（`meta`）に戻った

### 17.4 残り（対応しない）

`privacy` / `terms` の多態ブロック **85件**は、manifest が形の和であるがゆえに出ているだけで、
段落ブロックに箇条書き用の欄を出すのは誤り。**現在の挙動が正しいので開けない。**
