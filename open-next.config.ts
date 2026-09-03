// @opennextjs/cloudflare の設定。
//
// 公開ページは全ルートが同梱JSON（content/*.json）でビルド時に静的生成され
// （docs/plans/git-backed-cms/implementation-plan.md §3.5 / §7.3）、ISR は使わない。
// したがって R2 の incremental cache は不要なので既定の構成から外している
// （未使用の R2 バケットを本番に用意しなくて済む）。
// ISR を使う設計へ変える場合は r2IncrementalCache と wrangler.jsonc の
// r2_buckets / WORKER_SELF_REFERENCE を戻すこと。
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
