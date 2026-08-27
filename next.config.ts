import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare 向けの回避策。Turso クライアント(@libsql/client/http 経由)を workerd 向けに
  // バンドルする際、esbuild が @libsql/isomorphic-ws の workerd 条件(web.mjs)を解決できず
  // `Could not resolve "@libsql/isomorphic-ws"` で opennextjs-cloudflare build が
  // 失敗する。standalone 出力に同ファイルを明示的に含めることで解決する(実測済み)。
  // Vercel では不要だが、含めても数KBのファイルがトレースに増えるだけで害はない。
  outputFileTracingIncludes: {
    "**": ["./node_modules/@libsql/isomorphic-ws/web.mjs"],
  },
};

export default nextConfig;

// Cloudflare のローカル開発用フック（wrangler の getPlatformProxy を立ち上げ、
// バインディングを `next dev` から見えるようにする）。
//
// **開発時だけに絞っている。** 素で呼ぶと `next build` の最中にも miniflare が起動し、
// wrangler.jsonc を読みにいく。Cloudflare 以外（Vercel など）でのビルドでは無駄なうえ、
// 失敗する余地を作るため、NODE_ENV で囲う。Cloudflare へのデプロイは
// `npm run deploy:cf` が別途 opennextjs-cloudflare build を通すので影響しない。
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
