# レビュー指摘の修正依頼

Codex（gpt-5.2-codex）によるコードレビューで挙がった指摘です。以下5件を修正してください。

**大前提: 画面に出る見た目・日本語の文言・DOM構造・class名は一切変えないこと。**
実測で「変換元の8ページと可視テキスト・class集合・title/descriptionが完全一致」であることを確認済みです。
この一致を壊す変更は不可です。修正はすべて内部実装の話に限定してください。

---

## 1. components/SiteHeader.tsx — `nav-open` の後始末（Major）

変換元 `script.js` の `setOpen()` は、`gnav`・ボタン・`html`/`body` の `nav-open`・`aria-*` を
1つの関数の中で同時に更新している。React 版は `html`/`body` の `nav-open` だけが
passive な `useEffect` による後追い更新になっている。さらに、メニューを開いた状態で
`SiteHeader` がアンマウントされると `nav-open` が付いたまま残る。
`styles.css:713` の `html.nav-open,body.nav-open{overflow:hidden;}` が効き続け、
ページがスクロール不能のままになる。

修正:
- class の反映を `useLayoutEffect` に変え、描画前に確定させる。
- その effect の cleanup で、`document.documentElement` と `document.body` の両方から
  `nav-open` を必ず remove する。

補足: `SiteHeader` は `app/layout.tsx` に置かれているためルート遷移では再マウントされず、
実際にこの漏れを踏むのはアプリ全体のアンマウント時に限られる。緊急度は高くないが、正しく直すこと。

## 2. components/SiteHeader.tsx — クリック判定の型アサーション（Major）

ナビ内リンクのクリック検出が `(e.target as HTMLElement).closest("a")` になっており、
`EventTarget` が `Element` である保証を型アサーションで潰している。

修正: `e.target instanceof Element && e.target.closest("a")` のように実体を確認してから閉じる。
挙動（ナビ内のリンクをクリックしたらメニューを閉じる）は変えないこと。

## 3. components/Timetable.tsx — rAF の後始末（Minor）

スクロールの requestAnimationFrame スロットルで、rAF の id を保持しておらず
アンマウント時に `cancelAnimationFrame` していない。

修正: rAF の id を ref に保持し、effect の cleanup で `cancelAnimationFrame` する。
スロットルの挙動自体は変えないこと。

## 4. components/Timetable.tsx — タブとシートを1つの配列から生成する（Minor）

変換元 `script.js` は `.timetable__sheet` の枚数を DOM から数えていた（HTML側でシートを
増減するだけで動く設計）。React 版は `TABS.length` で clamp し、シートのマークアップは
別に直書きされているため、日を増やしたときに同期しない。

修正: 日付・見出し・その日の行データを1つの配列（例 `DAYS`）にまとめ、
タブとシートの両方をその配列から生成する。clamp もその配列の長さを使う。

**重要**: 出力される HTML は現状と完全に同一でなければならない。
時刻・プログラム名・`<strong>` の位置・class名・`aria-pressed`・`data-dir` などを
1つも変えずに、データ駆動へ組み替えること。作業後に必ず出力を突き合わせて確認すること。

## 5. `as CSSProperties` の範囲を絞る（Minor）

`components/Films.tsx:144`、`app/page.tsx:34` ほかで `{ "--d": ... } as CSSProperties` と
オブジェクト全体をアサートしている箇所が多数ある。カスタムプロパティを通す意図は妥当だが、
通常のCSSプロパティを混ぜた object 全体をアサートしている箇所では typo が型チェックをすり抜ける。

修正: `type StyleWithVars = CSSProperties & { "--d"?: string }` のような局所型を1つ定義し、
アサーションではなくその型で受ける形に置き換える。出力される style 属性の値は変えないこと。

---

## 完了条件

修正後、このディレクトリで以下をすべて実行し、通ることを自分で確認すること。

```
npx tsc --noEmit
npm run build
```

さらに、修正で画面が変わっていないことを自分で検証すること。
`npm start` で本番ビルドを起動し、`/`, `/about`, `/programme`, `/tickets`, `/news`,
`/privacy`, `/terms`, `/legal` の8ルートを取得して、修正前後で可視テキストと
class 集合が変化していないことを確認する。変わっていたら直すこと。
