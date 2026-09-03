#!/usr/bin/env bash
# 公開8ルートの出力が verification/baseline.fingerprint.json と一致するか検証する。
#
# 本番ビルドを起動 → 8ルート取得 → 指紋抽出 → baseline と比較 → サーバ停止、まで自動で行う。
# 既にサーバが動いている場合は BASE_URL を渡せばそれを使う（ビルド・起動をスキップ）。
#
# 使い方:
#   npm run verify:text                       # ビルド済み .next を起動して検証
#   BASE_URL=http://localhost:8787 npm run verify:text   # 起動済みサーバ(preview等)を検証
#   npm run verify:text -- --update           # baseline を現在の出力で作り直す
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASELINE_DIR="verification/baseline"
BASELINE_FP="verification/baseline.fingerprint.json"
CURRENT_DIR="verification/current"
CURRENT_FP="verification/current.fingerprint.json"

UPDATE=0
[ "${1:-}" = "--update" ] && UPDATE=1

SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [ -n "${BASE_URL:-}" ]; then
  echo "起動済みサーバを検証: ${BASE_URL}"
else
  PORT="${PORT:-4399}"
  BASE_URL="http://localhost:${PORT}"
  if [ ! -d .next ]; then
    echo ".next が無いのでビルドします"
    npm run build
  fi
  echo "本番サーバを起動: ${BASE_URL}"
  npx next start -p "$PORT" > /tmp/verify-text-server.log 2>&1 &
  SERVER_PID=$!
fi

if [ "$UPDATE" = "1" ]; then
  echo "baseline を作り直します"
  rm -rf "$BASELINE_DIR"
  bash scripts/snapshot.sh "$BASELINE_DIR" "$BASE_URL"
  node scripts/fingerprint.mjs "$BASELINE_DIR" > "$BASELINE_FP"
  echo "baseline を更新しました: $BASELINE_FP"
  exit 0
fi

if [ ! -f "$BASELINE_FP" ]; then
  echo "baseline がありません。先に scripts/verify-text.sh --update を実行してください" >&2
  exit 2
fi

rm -rf "$CURRENT_DIR"
bash scripts/snapshot.sh "$CURRENT_DIR" "$BASE_URL"
node scripts/fingerprint.mjs "$CURRENT_DIR" > "$CURRENT_FP"
node scripts/fingerprint.mjs --compare "$BASELINE_FP" "$CURRENT_FP"
