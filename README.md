# ADDICTION FILM FESTIVAL〔仮称〕— 立ち上げサイト デザイン案

新規に立ち上げる日本の映画祭のためのサイト初稿。デザイン言語は
[locarnofestival.ch](https://www.locarnofestival.ch/) を範としている。

> **デプロイと引き継ぎ**: Vercel への移行手順・環境変数・公開前チェックは
> **[`docs/deploy-vercel.md`](docs/deploy-vercel.md)** にまとめてある。
> 掲載内容の編集は `/addiction-admin`（管理画面）から行う。**保存すると
> `content/*.json` が GitHub にコミットされ、1〜2分ほどで自動デプロイされて
> 公開ページに反映される**（所要時間は暫定）。

```
index.html       トップ
about.html       映画祭について（背景・3つのアプローチ・開催概要・実行委員会・パートナー募集）
programme.html   プログラム（上映とトーク・タイムテーブル・会場）
tickets.html     チケット／FAQ（旧ノベルティ節は2026年8月、企画取り下げにより削除）
news.html        お知らせ／プレスルーム
privacy.html     プライバシーポリシー
terms.html       利用規約・来場規約（サイト／チケット／来場／取材）
legal.html       特定商取引法に基づく表記
sitemap.xml      検索エンジン向けサイトマップ（ドメイン要差し替え）
robots.txt       クロール設定（現在は全面 Disallow）
assets/films/    上映作品の宣材から書き出したWeb用画像（10点・1.8MB）
assets/hero/     ヒーローの代替イラスト（SVG 4枚・現在は未使用。差し戻し用に残置）
styles.css       デザインシステム
script.js        ハンバーガー／ヒーロースライドショー／スクロールリビール
PLACEHOLDERS.md  仮置き情報の一覧（公開前の差し替えチェックリスト）
```

ローカルで `index.html` を開けばそのまま表示できる。ビルド不要・依存パッケージなし。

## 参照元との対応

| locarnofestival.ch | 本案 |
|---|---|
| ブランドカラー #FFF200 で全面を塗る | **くすんだローズ #a37075** で全面を塗る（白地をつくらない） |
| 2段ヘッダー（ブランド+主ナビ／パートナー+ユーティリティ） | 同構成。パートナー枠は「募集中」のプレースホルダ |
| 写真カルーセルのヒーロー | 同構成のスライドショー（4枚・自動送り＋インジケーター）。写真が入るまでは SVG イラストで代替 |
| 黒箱3つのクイックリンク | チケット／作品応募／パートナー・ボランティア |
| Membership Programme（黒地＋ヒョウ柄ハーフトーン） | ステートメント帯（黒地＋ハーフトーン、朱の大文字） |
| Official Selection の非対称グリッド | 6部門のタイポカード（番号＋英名＋和名、1枚だけ縦長） |
| Pardo Editorial（黒カード3枚） | 読みもの3枚 |
| News & Updates（4カラム） | お知らせ4件 |
| プレス評の引用 | **フェスティバル・ステートメント**（新規のため第三者評は存在しない） |
| Patron 帯 → ニュースレター → 6カラムのフッター | 同構成 |

## デザイントークン

- 地色 `#a37075`（テーマカラー）／ 文字・黒箱 `#0A0A0A` ／ パネル `#111111` ／ 白 `#FFFFFF`
- 刷り物として扱うため、インキを2色足して**明度の階段**をつくっている
  （黒 0.006 → wine `#5B2F3A` 0.046 → rose `#a37075` 0.207 → bone `#EDE3D4` 0.777 → 白 1.000）。
  地色1色だけだと面が一様で澱んで見えるため
- 沈み `#8C5B60` — 白文字を載せる面（ヒーローの主ボタン等）と、明るい紙面上の小さなアクセント文字だけに使う。
  地色そのままだと白文字が 4.09:1 でAA未達のため（沈み色なら 5.55:1）
- 欧文 **Space Grotesk 700**（Locarno の Chroma に相当する幾何グロテスク）、和文 **Noto Sans JP 400/700/900**
- 見出しは `line-height .95` / `letter-spacing -.035em`。スケール差と色反転だけで階層をつくる
- **角丸ゼロ**（カード・画像枠）× **ボタンは完全なピル型** — この対比が参照元の署名
- CTA はすべて「テキスト＋→」

## ヒーローのキービジュアル（スライドショー）

ヒーローは4枚のスライドショー。**上映作品のスチールに差し替え済み**（`assets/films/hero-*.jpg`）。
文字が乗る左側が静かなカットを選び、既存のスクリム（`.hero__veil`）と網点で地の世界観に馴染ませている。
差し戻したい場合のために、繋ぎで使っていたSVGイラストは `assets/hero/` に残してある。

```
assets/hero/slide-01-projection.svg   映写機の光がスクリーンへ届く
assets/hero/slide-02-untangle.svg     もつれた線がほどけて平行に整う（＝偏見を解きほぐす）
assets/hero/slide-03-dialogue.svg     左右の波紋が中央で重なる（＝対話）
assets/hero/slide-04-audience.svg     大ホールの客席、数席だけが灯る
```

差し替え手順：

1. `index.html` の `.hero__slide` 内の `<img src="assets/hero/….svg">` を `.jpg` に変更（推奨 2000×1125・16:9）
2. `alt` を写真の内容に書き換える
3. 世界観をテーマカラーに揃えたい場合は `<div class="hero__slides" …>` に `is-duotone` を追加
4. 枚数を変える場合は `.hero__slide` を増減し、`.hero__nav` の `.hero__dot` を同数にする

仕様：6秒ごとに自動送り（クロスフェード1.1秒＋ゆっくり寄るズーム）、インジケーターのクリックで切替、
タブ非表示中は停止、`prefers-reduced-motion: reduce` では1枚目で固定。
どんな写真が入っても白文字が読めるよう、左からのスクリム（`.hero__veil`）を常時かけている。

## そのほかの写真ゼロ対応

- 巨大タイポグラフィ（ヒーローは最大156px）
- CSS のハーフトーン・ドット（黒地・朱地の2種）
- 番号を主役にしたタイポカード（3つのアプローチ・会場）

実写真が入る際は、`.scard` / `.ecard` の上部に画像枠を足すだけで成立するよう構造を組んである。

## モーション

- スクロールリビール（IntersectionObserver、`--d` で時差）
- ヒーローのドットは 26 秒周期でドリフト、同心円は 9 秒周期で微細に呼吸
- `prefers-reduced-motion: reduce` で全モーション停止

## レスポンシブ

1080px 以下でナビをハンバーガー化（フルスクリーンメニュー、作品応募・パートナー募集を追加表示）。
720px 以下でグリッドを1カラムに、同心円を画面幅いっぱいに再配置。

## 注意

**掲載情報はすべて仮置き**。名称・会期・会場・部門・賞金・料金・応募要項・記事・連絡先は
確定した事実ではない。`PLACEHOLDERS.md` に差し替え対象を全件記載している。
「ADDICTION FILM FESTIVAL／アディクション映画祭」という表記は仮であり、商標・先行使用の調査は未実施。

**未対応**：本文コピー（ステートメント・部門説明・記事タイトル等）は汎用の映画祭向けに書いたままで、
アディクション（依存症）というテーマを反映していない。テーマの捉え方が決まり次第、全文を書き直す前提。

## 法務ページと公開設定

`privacy.html` / `terms.html` / `legal.html` は**雛形**であり、法務の確認を受けていない。
未確定の項目は本文中に〔調整中〕として残してある。全ページのフッター右下からリンクしている。

- **プライバシーポリシー** — トップのニュースレターとお問い合わせでメールアドレスを取得するため、
  実運用に入る時点で必須になる。依存症をテーマとする案件のため、**要配慮個人情報を取得しない方針**を
  第5条として明記した（フォームで病歴等を尋ねない設計にすることが前提）。
- **利用規約・来場規約** — サイト利用／チケット（転売禁止・払い戻し）／来場（撮影禁止・途中入退場自由・
  写り込みへの配慮）／取材（当事者と登壇者への配慮）の4章構成。
- **特定商取引法に基づく表記** — 自社サイトで直接チケットを販売する場合に必須。外部プレイガイド経由の
  販売のみなら不要になる可能性があるため、販売方法の決定後に要判断。

`robots.txt` は**現在すべてのクロールを禁止**している。仮置きの会期・料金・登壇者が検索結果に載るのを
避けるためで、正式公開時にコメントの指示にしたがって解除する。法務3ページには `<meta name="robots"
content="noindex">` も入れてある。`sitemap.xml` のドメインは `https://example.jp/` のままなので要差し替え。

デザイン上、法務ページだけは長文の可読性を優先して明るい紙面（`.doc__sheet`）に落としている。
「白地をつくらない」という他ページの原則に対する意図的な例外。

## ポスタライゼーション（刷り物としての処理）

くすんだ地色は面が一様になりやすいので、シルクスクリーンの語彙で段差と質感を足している。

- **版ズレ（misregistration）** — 大型英字見出しに、ぼかしのない硬いオフセット影を `.055em` で入れる。
  インキは `--reg` 変数で面ごとに切り替える：明るい地色の上では bone、`.panel`（黒・wine）の上では
  rose。**暗い面の見出しは白なので、bone のままだと字面と同系色（1.27:1）で潰れる**ため。
  rose に振ると白い字面と 4.09:1、地とも 4.61:1（黒）／2.68:1（wine）で分離する。
  見出し自体をローズで組む場合は `.display--rose` を付けて bone に戻す。`.display--flat` で解除
- **網点** — ハーフトーンのドットを 13〜15px まで細かくし、不透明度を上げて「網」として見えるようにした。
  黒箱の右下にも網を回り込ませている
- **wine の帯** — `.panel--wine` を各ページに1つ置き、黒一辺倒だった帯に中間の階調を入れた。
  この帯の中だけ `--red` を `#D4A8AE` に再定義しているため、HTML側に直書きされた
  `style="color:var(--red)"` も書き換えずにコントラストが確保される（wine の上の #a37075 は 2.68:1 で読めない）
- **トンボ** — `.panel` の左上・右下に 26px のトリムマーク
- **紙の地合い** — `body::before` に SVG のノイズを敷き、`mix-blend-mode:multiply` で薄くのせている

## 上映作品の展開（Locarno の Official Selection に相当）

`assets/film/`（原本 4.5GB・git管理外）から 16:9 に切り出し、`assets/films/` に軽量版を書き出している。

- **ヒーロー** 4枚（1800px・16:9）— 『嘘つきは〇○のはじまり』（海）『一瞬の楽園』（夜の歩道橋）
  『微熱』（遊技台）『Bill W.』（B&W）。1枚目は第一印象になるので、引きで明るいカットを置く。
  ヒーローの網点は写真の可読性を優先して地の面より弱く粗い（34px・opacity .15）
- **作品カード** 6枚（1400〜1900px・16:9）— 1作品1点。合計 1.8MB

配置は index と programme の2箇所。6カラムのグリッドで、**メイン作品の Bill W. 2本を span 3 の
大カードとして先頭に横並び**、残り4作品を span 2 で並べる。並び順は上映順。

各カードの画像左上に作品番号、右上に**上映日時（DAY 1／DAY 2 ＋ 時刻）**のバッジを置く。
会期が調整中のため、カレンダー日付ではなく会期内の相対表記にしている。

世界観を保つための処理：

- 写真はカードに入れず**地色の上に直接**置く（まわりのUIを変えない）
- `filter:saturate(.9) contrast(1.03)` で6作品の発色を軽くそろえ、**ホバーで本来の色に戻す**
- 画像に網点（9px）を multiply で薄くかけ、地の刷り物感と地続きにする
- 作品番号は黒地・bone文字のバッジで画像左上に置く（角丸ゼロ）
- ラベル（FEATURE ・ 2024 ・ 82MIN）は黒。地色の上では `--red-dp` が 1.36:1 で沈むため

## 上映スケジュール

クライアント提供のタイムスケジュール案を反映している。会期は **2026年10月11日（日）・10月12日（月・祝／スポーツの日）**、会場はよみうりホール（東京・有楽町）。

| | DAY 1｜10月11日（日） | DAY 2｜10月12日（月・祝） |
|---|---|---|
| | 13:00 受付開始 ／ 13:30 オープニングセレモニー | 10:00 アディクトを待ちながら（82分） |
| | 14:45 **Bill W.**（104分） | 11:30 トークショー③ ／ 12:15 休憩 |
| | 16:30 トークショー① | 13:30 嘘つきは〇○のはじまり（30分） |
| | 18:00 微熱（30分） | 14:00 トークショー④ |
| | 18:30 一瞬の楽園（30分） | 15:00 **Bill W. Conscious Contact**（58分） |
| | 19:00 トークショー②／会場とのセッション | 16:15 特別講演 ／ 17:30 質疑応答 ／ 18:30 クロージング |

**公開しなかったもの**：ゲスト候補の実名（候補段階のため）、会場準備の時間帯（来場者向けでないため）。
トークショーは「①〜④」「特別講演」という枠だけを出している。

作品カードの表示順は「メインの Bill W. 2本を先頭」、残り4作品は上映順。日時バッジは実スケジュールを指す。
---

## 変換時の判断メモ（静的HTML → Next.js 16 App Router 移植）

### 共通化したコンポーネント（`components/`）

- **SiteHeader / SiteFooter** — 全8ページ共通のヘッダー・フッター。`app/layout.tsx` に配置。
  クライアントコンポーネント化して `usePathname()` で現在ページを判定し、変換元のページごとの差異を再現している：
  - ナビの `aria-current="page"`（about / programme / tickets / news のみ。index・法務3ページには無し）
  - そのページ自身へのフラグメント付きリンクは `#…` 形式（例：about ページの「パートナー募集」は `#partner`、他ページは `/about#partner`）。フッターも同規則（programme の `#venue`、news の `#press`）。tickets の `#novelty` は、2026年8月にノベルティ企画が取り下げられフッターのリンクごと削除した
  - ユーティリティの「JA」リンクは各ページ自身の URL（`/`・`/about`…）
- **SmartLink** — `#` 始まりの同一ページ内アンカーは素の `<a>`、それ以外の内部リンクは `next/link` に出し分けるラッパー。
- **Films** — index / programme で完全同一の上映作品グリッド。唯一の差異（04「一瞬の楽園」のクレジットが index=短縮版／programme=全文）は `variant` prop で出し分け。
- **Hero / Timetable / TrailerModal / ScrollReveal** — 下記 script.js 移植を参照。

### script.js の移植（5つの IIFE → React）

- **ハンバーガーメニュー** → `SiteHeader` 内で `useState` 管理。`is-open`・`aria-expanded`・`aria-label` を state から算出し、`html`/`body` の `nav-open` 付け外しと Escape 監視は `useEffect`。ナビ内リンクのクリックは `<nav>` の onClick で委譲して閉じる。
- **ヒーロースライドショー** → `components/Hero.tsx`。6000ms 巡回・ドット連動・`prefers-reduced-motion` で自動送り停止・`visibilitychange` で停止/再開、は変換元どおり。初期 state は0なので SSR 出力は元の静的HTMLと同じ（1枚目が `is-active`）。
- **スクロールリビール** → `components/ScrollReveal.tsx` を layout に1つ配置。`.rise` は各ページ（Server Component）側が描画するため、ここだけは `document.querySelectorAll(".rise:not(.is-in)")` で拾う共通フック相当の実装（`useRevealOnScroll` の要件どおり最上位で1回だけ動く形）。クライアント遷移のたびに再スキャンする。`rootMargin: '0px 0px -10% 0px'`・`threshold: 0.08`・IO非対応時の全件 `is-in` 付与は元どおり。
- **タイムテーブルの日付スライド** → `components/Timetable.tsx`。トラックは `useRef`、現在日は `useState`+ref。スワイプは CSS スクロールスナップ任せで、タブ/矢印/キー（←→）は `scrollTo`（reduced-motion 時 `behavior:'auto'`）、スクロール時は rAF スロットルで `scrollLeft/clientWidth` から sync、リサイズで位置合わせ直し、端で矢印 `disabled` — すべて元どおり。初期SSRで `data-dir=-1` の矢印が `disabled` 付きで出るのは、元サイトで script.js 実行直後の状態と同じ。
- **予告編モーダル** → `components/TrailerModal.tsx` を `(public)/layout.tsx` のフッター直後（変換元と同じ位置）に1つ配置。変換元で `<dialog id="trailerModal">` を持つのは index / programme だけなので、それ以外のルートでは null を返す。`.film__play` ボタンは `Films`（Server Component）が `data-trailer` / `data-trailer-start` 属性つきで描画し、リスナーはスクロールリビールと同じく DOM から拾って付ける（クライアント遷移では `pathname` を依存に付け直す）。iframe は開いたとき生成・閉じたら state を null に戻して破棄、`youtube-nocookie.com` ドメイン、`html`/`body` の `modal-open`、背景クリック・Esc で閉じる挙動 — すべて元どおり。開いたまま別ルートへ遷移した場合の後片付け（スクロールロック解除）は effect の cleanup で行う。

### CSS・フォント・メタ

- `styles.css` は **バイト単位でそのまま** `app/globals.css` にコピー（`diff` で同一確認済み）。CSS 内に相対パスの `url()` は無く（`body::before` の data URI のみ）、パス書き換えは不要だった。雛形の `page.module.css` は削除。
- Google Fonts は `next/font` に移し替えず、変換元と同じ `<link>` 3行を `app/layout.tsx` の `<head>` に配置（`--font-en` / `--font-jp` の当たる書体が変わらないことを優先）。
- 全ページ共通の `<meta name="robots" content="noindex, nofollow, noarchive">` は layout の `metadata.robots = { index:false, follow:false, noarchive:true }` で表現（出力文字列が `noindex, nofollow, noarchive` になることをビルド済みHTMLで確認）。
- ページ固有の `title` / `description` は各 `page.tsx` の `export const metadata` に変換元と同じ文字列で移した。charset / viewport は Next の自動出力（`utf-8`・`width=device-width, initial-scale=1`）で変換元と一致。
- `sitemap.xml` は `public/sitemap.xml` に変換元と同一内容で配置（URL 一覧は `…/about.html` 等の表記も変換元のまま）。`PLACEHOLDERS.md`・`README.md`（このファイル）も変換元からコピー。`.pptx`・原本素材（`/public/assets/film/`・`/public/assets/nagigater/`）は `.gitignore` に除外を追記。

### 変換元と挙動が変わった箇所

- **ページ遷移がクライアントサイド化**（再読み込みではなくなる）。これに伴い：
  - ハンバーガーメニューは遷移後に開きっぱなしにならないよう、`pathname` 変化時に閉じる処理を追加（元はページ再読み込みで結果的に閉じていた）。
  - スクロールリビールは遷移のたびに新しい `.rise` を拾い直す。
- **フレームワーク由来の追加要素**（見た目・文言には影響なし）：`app/favicon.ico` 由来の `<link rel="icon">`、`loading="lazy"` でない `<img>` への `<link rel="preload" as="image">`（LCP 最適化）、Next のJS/CSSチャンク参照。
- 「Stay in the Loop」メール登録セクションは 2026年8月にチケット手売り化で変換元から削除されたため、こちらも `NewsletterForm` コンポーネントごと削除した（変換元 `5fe3163` 追随。`.newsletter` / `.social` の CSS 定義は変換元と同じく残している）。
- **予告編の動画は管理画面から登録する。** 変換元は HTML に `data-trailer="動画ID"` を直書きするが、こちらは `content/films.json` の `trailer` に持たせて `/addiction-admin/docs/films` から編集する。動画URLをそのまま貼れて、保存時に動画IDへ変換される（`lib/content/youtube.ts`）。これは「保存時に文字列を加工しない」方針（`docs/implementation-plan.md` §8.4）に対する**唯一の例外**で、`manifest-core.ts` の `PATH_FORMATS` に挙げた欄にだけ効く。YouTube と解釈できない非空の値は 422 で拒否する（壊れた埋め込みを公開ページに出さないため）。読み上げ文と帯の文字を空にしたまま登録した場合は、`components/Films.tsx` が既存2作品と同じ書式の既定値（`『作品名』の予告編を再生` と `Trailer`）で補う。
- 画像はすべて通常の `<img>`（`next/image` 不使用）。`@next/next/no-img-element` の ESLint 警告は仕様どおり許容。`npm run build`（型チェック含む）と `npx tsc --noEmit` は両方通過済み。
