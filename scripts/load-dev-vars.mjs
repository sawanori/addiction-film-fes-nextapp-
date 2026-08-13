// .dev.vars を読んで process.env に流し込む。
// Cloudflare Workers はこのファイルをローカル開発でそのまま使う（wrangler の規約）ので、
// dotenv 等を新規依存に足す代わりにこの規約に合わせた最小のローダーを自前で書く。
import { readFileSync, existsSync } from "node:fs";

export function loadDevVars(path = ".dev.vars") {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
