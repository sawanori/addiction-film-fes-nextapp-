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
 * DB に接続できない場合・クエリが例外を投げた場合は fail-closed でロック扱いにする
 * （例外をそのまま投げると Route Handler まで伝播して 500 になり、レート制限が
 * 素通りしたのと同じ扱いになるため）。
 */
export async function checkRateLimit(ip: string): Promise<RateLimitStatus> {
  const client = getDbClient();
  if (!client) {
    return { locked: true, retryAfter: LOCK_DURATION_SECONDS };
  }

  try {
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
  } catch {
    return { locked: true, retryAfter: LOCK_DURATION_SECONDS };
  }
}

/**
 * パスワード検証が失敗した直後に呼ぶ。失敗回数を+1し、5回目に達したらロックする。
 * DB に接続できない場合・クエリが例外を投げた場合は fail-closed でロック扱いにする。
 *
 * 加算とロック判定は**1文で完結**させる（SELECT してから UPDATE すると、並行した
 * 誤パスワードリクエストが同じ failures を読んで同じ値を書き戻し、失敗回数が
 * 失われてロックを回避されるため）。RETURNING で確定後の値を受け取って判定する。
 */
export async function recordLoginFailure(ip: string): Promise<RateLimitStatus> {
  const client = getDbClient();
  if (!client) {
    return { locked: true, retryAfter: LOCK_DURATION_SECONDS };
  }

  const lockedUntilIso = new Date(Date.now() + LOCK_DURATION_SECONDS * 1000).toISOString();

  try {
    const { rows } = await client.execute({
      sql: `INSERT INTO login_attempts (ip, failures, locked_until, updated_at)
            VALUES (?, 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            ON CONFLICT(ip) DO UPDATE SET
              failures = login_attempts.failures + 1,
              locked_until = CASE
                WHEN login_attempts.failures + 1 >= ? THEN ?
                ELSE NULL
              END,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            RETURNING failures, locked_until`,
      args: [ip, MAX_FAILURES, lockedUntilIso],
    });

    const failures = rows.length > 0 ? Number(rows[0].failures) : MAX_FAILURES;
    if (failures >= MAX_FAILURES) {
      return { locked: true, retryAfter: LOCK_DURATION_SECONDS };
    }
    return { locked: false };
  } catch {
    return { locked: true, retryAfter: LOCK_DURATION_SECONDS };
  }
}

/**
 * ログイン成功時に呼ぶ。対象 IP の行を削除する。
 * 失敗しても認証自体は成立しているので、例外は握りつぶす（カウンタが残るだけ）。
 */
export async function clearLoginAttempts(ip: string): Promise<void> {
  const client = getDbClient();
  if (!client) return;
  try {
    await client.execute({ sql: "DELETE FROM login_attempts WHERE ip = ?", args: [ip] });
  } catch {
    // best effort
  }
}
