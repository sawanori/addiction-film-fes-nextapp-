#!/usr/bin/env bash
# 公開8ルートのHTMLを取得してディレクトリに保存する。
#
# 使い方: scripts/snapshot.sh <出力ディレクトリ> [ベースURL]
#   例: scripts/snapshot.sh verification/current http://localhost:4311
set -euo pipefail

OUT="${1:?usage: snapshot.sh <outdir> [baseUrl]}"
BASE="${2:-http://localhost:3000}"
mkdir -p "$OUT"

# 変換元の静的HTMLと1対1で対応する8ルート。増減させないこと。
ROUTES=(/ /about /programme /tickets /news /privacy /terms /legal)
NAMES=(index about programme tickets news privacy terms legal)

# サーバの起動待ち。起動していなければここで失敗する。
curl -sS --retry 40 --retry-delay 1 --retry-all-errors --max-time 60 \
  -o /dev/null -w "server: %{http_code} ${BASE}\n" "${BASE}/"

for i in "${!ROUTES[@]}"; do
  route="${ROUTES[$i]}"
  name="${NAMES[$i]}"
  code=$(curl -sS -o "${OUT}/${name}.html" -w "%{http_code}" "${BASE}${route}")
  if [ "$code" != "200" ]; then
    echo "  ${name} (${route}): HTTP ${code} — 期待は200" >&2
    exit 1
  fi
  printf "  %-10s %8s bytes\n" "$name" "$(wc -c < "${OUT}/${name}.html" | tr -d ' ')"
done
