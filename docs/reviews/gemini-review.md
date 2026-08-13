[致命的] JSX空白処理の無視によるDOM構造完全一致の破壊
  該当: docs/implementation-plan.md 7.3 および components/Films.tsx 118行目付近
  何が起きるか: 現行の `meta` JSX内に存在する改行やインデント起因の空白テキストノードが、文字列配列化とLinesレンダラでの再構築により失われ、CLAUDE.mdの「DOM構造の完全一致」に即座に違反する。
  修正案: インデントや空白を正確に維持するレンダリングロジックを再設計するか、空白を維持できる別手法を採る。

[致命的] force-dynamicによるNext.js特有のDOM構造変化
  該当: docs/implementation-plan.md 7.2 および app/layout.tsx
  何が起きるか: `app/layout.tsx` に `force-dynamic` を付与すると、Next.jsが注入する `<head>` 内の preload や body 末尾のタグ等がSSG時から変化し、変換元との一致が根本から崩れる。
  修正案: 毎リクエストのDB参照ではなく、JSON更新時にビルドを回す静的生成(SSG)アプローチを維持する。

[重大] CLAUDE.mdの不変条件を計画書内で勝手に緩和している
  該当: docs/implementation-plan.md 14. Acceptance Criteria
  何が起きるか: 「SSR HTMLのバイト一致・<!-- --> コメントノードの位置は条件に含めない」と宣言しているが、CLAUDE.mdは「DOM構造...は完全一致」と規定しており、ReactNodeの配列化によるコメント挿入はDOM構造の差分である。
  修正案: Fragmentによる `<!-- -->` 挿入を回避する（単一文字列化等）実装を義務付けるか、前提をCLAUDE.md通りに直す。

[重大] AST抽出によるベタ書きJSXのリファクタリングリスク
  該当: docs/implementation-plan.md 10.4 および app/tickets/page.tsx 44-59行目
  何が起きるか: TicketsPageの表などのベタ書きJSXをTSコンパイラAPIで自動抽出し、ループ処理へ書き換えるとしているが、自動化の難易度が高すぎ、バグやDOM差異の温床になる。
  修正案: コンポーネントのリファクタリング（ループ化等）と初期データJSONの作成は、機械抽出に頼らず手動で安全に行う。

[重大] 条件付きstyle属性の抽出・復元漏れ
  該当: docs/implementation-plan.md 8.3 および app/tickets/page.tsx 68行目付近
  何が起きるか: TicketsPageのボックス等にある `style={styleVars({ "--d": ".08s" })}` などの遅延属性がJSON定義に言及されておらず、データ駆動化の過程で失われアニメーションの一致が壊れる。
  修正案: 繰り返し項目のスキーマ定義に `delay` 等の属性を持たせるフィールドを明記し、レンダリング時に復元する。

[重大] Films.tsx 04の三項演算子の機械抽出の破綻
  該当: docs/implementation-plan.md 7.3 および components/Films.tsx 71行目
  何が起きるか: `Films.tsx` 04の `meta` には `variant === "programme" ? ... : ...` という条件分岐が含まれるため、抽出スクリプトがこれを自動パースして分離できる保証がない。
  修正案: AST抽出の限界を認め、この条件分岐箇所のデータ化ロジックを手動で記述する例外処理を設ける。

[重大] Turso無料枠とパフォーマンスの崩壊
  該当: docs/implementation-plan.md 7.2
  何が起きるか: 完全に静的だったサイトがCloudflare WorkersからTursoへ毎リクエスト通信する仕様になり、レイテンシが悪化する上、Botアクセス等でTursoの無料枠（読み取り数）が容易に枯渇する。
  修正案: Cloudflare KV等のエッジキャッシュを併用するか、静的ビルド時の取得へ回帰する。

[重大] 管理画面CSSのNested Layout経由での混入リスク
  該当: docs/implementation-plan.md 8 および app/admin/layout.tsx
  何が起きるか: App Routerで `app/admin/layout.tsx` から `admin.css` をインポートすると、公開側（Root Layout）のCSSバンドルに影響を与えたりロード順が変わり、バイト完全一致が壊れる可能性がある。
  修正案: 管理画面は公開側と完全にルートを分ける Route Group (`app/(admin)`) を使用し、CSSの影響を遮断する。

[軽微] package.json依存性追加時の環境破壊リスク
  該当: docs/implementation-plan.md 11.2
  何が起きるか: `@libsql/client` 等を追加する際、現行環境で `npm install` 時にpeer警告やバージョンの自動変更が起き、既存のビルド環境が壊れる可能性がある。
  修正案: インストール時に `--legacy-peer-deps` やバージョン固定指定を行う手順を明記する。

計画全体の判定
SSGによる静的DOM構造の完全一致という大前提を、SSR化（force-dynamic）やJSXの機械抽出による構造変形によって破壊する致命的な欠陥が含まれています。
インフラの都合でCloudflare・Turso・Next.jsの相性を無視しており、稼働時のパフォーマンスや運用枠枯渇の考慮も不十分です。
不変条件を順守するため、動的SSRへの移行を破棄し、静的ビルドベース（またはエッジキャッシュ併用）のアーキテクチャへの全面改訂を要求します。
