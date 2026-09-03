import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

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
