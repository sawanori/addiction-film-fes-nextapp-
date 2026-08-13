#!/usr/bin/env node
// 管理画面のパスワードを PBKDF2-SHA256 でハッシュ化し、
// `pbkdf2-sha256$<iterations>$<salt_base64>$<hash_base64>` の形式で出力する。
//
// Web Crypto (`crypto.subtle`) のみを使う。Cloudflare Workers 上でも
// 同じ API で検証できるようにするため、Node 固有の `crypto` モジュールは使わない。
//
// 反復回数は固定しない（計画 §9.1）。Cloudflare Workers にはリクエストあたりの
// CPU時間上限があるため、`opennextjs-cloudflare preview` で実測してから
// 本番用の回数を決める。ここではローカル検証用の暫定値を既定にしている。
//
// パスワードは標準入力から読む（コマンド引数にすると `ps` やシェル履歴に残るため）。
//
// 使い方:
//   echo -n 'パスワード' | node scripts/hash-password.mjs
//   echo -n 'パスワード' | node scripts/hash-password.mjs --iterations 100000

const args = process.argv.slice(2);
const iterFlag = args.indexOf("--iterations");
const iterations = iterFlag !== -1 ? Number(args[iterFlag + 1]) : 100_000;

if (!Number.isInteger(iterations) || iterations < 1000) {
  console.error("--iterations は1000以上の整数で指定してください");
  process.exit(2);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data.replace(/\r?\n$/, "")));
    process.stdin.on("error", reject);
  });
}

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function main() {
  const password = await readStdin();
  if (!password) {
    console.error("標準入力からパスワードを渡してください（例: echo -n 'pw' | node scripts/hash-password.mjs）");
    process.exit(2);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    32 * 8
  );

  const formatted = `pbkdf2-sha256$${iterations}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
  console.log(formatted);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
