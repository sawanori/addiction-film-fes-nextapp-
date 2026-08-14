import { getDbClient } from "@/lib/db";

export type RateLimitStatus =
  | { locked: false }
  | { locked: true; retryAfter: number };

const MAX_FAILURES = 5;
const LOCK_DURATION_SECONDS = 15 * 60;

/** cf-connecting-ip → x-forwarded-for の先頭 → "unknown" の順で IP を決める。 */
export function getClientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/**
 * ログイン試行の前に呼ぶ。ロック中かどうかだけを判定する（カウンタは変更しない）。
 * DB に接続できない場合は fail-closed でロック扱いにする。
 */
export async function checkRateLimit(ip: string): Promise<RateLimitStatus> {
  const client = getDbClient();
  if (!client) {
    return { locked: true, retryAfter: LOCK_DURATION_SECONDS };
  }
  const { rows } = await client.execute({
    sql: "SELECT locked_until FROM login_attempts WHERE ip = ?",
    args: [ip],
  });
  if (rows.length === 0) {
    return { locked: false };
  }
  const lockedUntilRaw = rows[0].locked_until;
  if (!lockedUntilRaw) {
    return { locked: false };
  }
  const lockedUntilMs = new Date(String(lockedUntilRaw)).getTime();
  const nowMs = Date.now();
  if (lockedUntilMs > nowMs) {
    return { locked: true, retryAfter: Math.ceil((lockedUntilMs - nowMs) / 1000) };
  }
  // ロック期限切れ: カウンタをリセットする
  await client.execute({ sql: "DELETE FROM login_attempts WHERE ip = ?", args: [ip] });
  return { locked: false };
}

/**
 * パスワード検証が失敗した直後に呼ぶ。失敗回数を+1し、5回目に達したらロックする。
 * DB に接続できない場合は fail-closed でロック扱いにする。
 */
export async function recordLoginFailure(ip: string): Promise<RateLimitStatus> {
  const client = getDbClient();
  if (!client) {
    return { locked: true, retryAfter: LOCK_DURATION_SECONDS };
  }
  const { rows } = await client.execute({
    sql: "SELECT failures FROM login_attempts WHERE ip = ?",
    args: [ip],
  });
  const currentFailures = rows.length > 0 ? Number(rows[0].failures) : 0;
  const nextFailures = currentFailures + 1;

  if (nextFailures >= MAX_FAILURES) {
    const lockedUntilIso = new Date(Date.now() + LOCK_DURATION_SECONDS * 1000).toISOString();
    await client.execute({
      sql: `INSERT INTO login_attempts (ip, failures, locked_until, updated_at)
            VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            ON CONFLICT(ip) DO UPDATE SET
              failures = excluded.failures,
              locked_until = excluded.locked_until,
              updated_at = excluded.updated_at`,
      args: [ip, nextFailures, lockedUntilIso],
    });
    return { locked: true, retryAfter: LOCK_DURATION_SECONDS };
  }

  await client.execute({
    sql: `INSERT INTO login_attempts (ip, failures, locked_until, updated_at)
          VALUES (?, ?, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          ON CONFLICT(ip) DO UPDATE SET
            failures = excluded.failures,
            locked_until = excluded.locked_until,
            updated_at = excluded.updated_at`,
    args: [ip, nextFailures],
  });
  return { locked: false };
}

/** ログイン成功時に呼ぶ。対象 IP の行を削除する。 */
export async function clearLoginAttempts(ip: string): Promise<void> {
  const client = getDbClient();
  if (!client) return;
  await client.execute({ sql: "DELETE FROM login_attempts WHERE ip = ?", args: [ip] });
}
