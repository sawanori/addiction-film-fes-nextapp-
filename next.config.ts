import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turso クライアント(@libsql/client/http 経由)を workerd 向けにバンドルする際、
  // esbuild が @libsql/isomorphic-ws の workerd 条件(web.mjs)を解決できず
  // `Could not resolve "@libsql/isomorphic-ws"` で opennextjs-cloudflare build が
  // 失敗する。standalone 出力に同ファイルを明示的に含めることで解決する(実測済み)。
  outputFileTracingIncludes: {
    "**": ["./node_modules/@libsql/isomorphic-ws/web.mjs"],
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
