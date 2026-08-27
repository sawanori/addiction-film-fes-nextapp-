// ローカル用の環境変数を読んで process.env に流し込む。
//
// 読む順番は `.dev.vars` → `.env.local`。前者は Cloudflare Workers（wrangler）の規約、
// 後者は Next.js / Vercel の規約で、どちらの流儀で開発していてもスクリプトが動くようにする。
// **先に読んだほうが勝つ**（既に process.env にあるキーは上書きしない）ので、
// 環境変数を直接渡した場合はそれが最優先になる。
//
// dotenv 等を新規依存に足す代わりに、両方の規約に合わせた最小のローダーを自前で書いている。
import { readFileSync, existsSync } from "node:fs";

const DEFAULT_FILES = [".dev.vars", ".env.local"];

/**
 * @param {string | string[]} [paths] 読み込むファイル。省略すると `.dev.vars` → `.env.local`。
 * @returns {string[]} 実際に読み込めたファイルのパス
 */
export function loadDevVars(paths = DEFAULT_FILES) {
  const files = Array.isArray(paths) ? paths : [paths];
  const loaded = [];

  for (const path of files) {
    if (!existsSync(path)) continue;
    loaded.push(path);
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      // `.env.local` では値を引用符で囲む書き方が一般的なので、対になっていれば外す
      if (value.length >= 2 && value[0] === value[value.length - 1] && (value[0] === '"' || value[0] === "'")) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }

  return loaded;
}
