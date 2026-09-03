/**
 * ログイン試行のレート制限（プロセス内メモリ実装。計画書 §7.4）。
 *
 * 共有ストアが無いため複数インスタンスにまたがる総当たりは止められない。
 * 主たる守りは Vercel WAF のレート制限ルール（docs/deploy-vercel.md）とパスワードの強さ。
 * 関数インスタンスが生きている間だけ有効で、コールドスタートで消える。
 */

export type RateLimitStatus =
  | { locked: false }
  | { locked: true; retryAfter: number };

const MAX_FAILURES = 5;
const LOCK_DURATION_SECONDS = 15 * 60;

/** 未認証のリクエストで際限なく増やせる領域なので上限を設ける。超えたら最も古い挿入から捨てる。 */
const MAX_ENTRIES = 1000;

interface Attempt {
  failures: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, Attempt>();

function evictOldestIfOverCapacity(): void {
  if (attempts.size <= MAX_ENTRIES) return;
  const oldestKey = attempts.keys().next().value;
  if (oldestKey !== undefined) {
    attempts.delete(oldestKey);
  }
}

/** x-forwarded-for の先頭 → cf-connecting-ip → "unknown" の順で IP を決める（Vercel が x-forwarded-for を設定する）。 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  return "unknown";
}

/**
 * ログイン試行の前に呼ぶ。ロック中かどうかだけを判定する（カウンタは変更しない）。
 */
export async function checkRateLimit(ip: string): Promise<RateLimitStatus> {
  const record = attempts.get(ip);
  if (!record) {
    return { locked: false };
  }

  if (record.lockedUntil !== null) {
    const nowMs = Date.now();
    if (record.lockedUntil > nowMs) {
      return { locked: true, retryAfter: Math.ceil((record.lockedUntil - nowMs) / 1000) };
    }
    // ロック期限切れ: カウンタをリセットする
    attempts.delete(ip);
    return { locked: false };
  }

  return { locked: false };
}

/**
 * パスワード検証が失敗した直後に呼ぶ。失敗回数を+1し、MAX_FAILURES に達したらロックする。
 *
 * 読んで書くまでの間に await を挟まない（並行した誤パスワードリクエストが同じ failures を
 * 読んで同じ値を書き戻し、失敗回数が失われてロックを回避されるのを防ぐため）。
 */
export async function recordLoginFailure(ip: string): Promise<RateLimitStatus> {
  const existing = attempts.get(ip);
  const failures = (existing?.failures ?? 0) + 1;

  if (failures >= MAX_FAILURES) {
    const lockedUntil = Date.now() + LOCK_DURATION_SECONDS * 1000;
    attempts.set(ip, { failures, lockedUntil });
    evictOldestIfOverCapacity();
    return { locked: true, retryAfter: LOCK_DURATION_SECONDS };
  }

  attempts.set(ip, { failures, lockedUntil: null });
  evictOldestIfOverCapacity();
  return { locked: false };
}

/** ログイン成功時に呼ぶ。対象 IP の記録を削除する。 */
export async function clearLoginAttempts(ip: string): Promise<void> {
  attempts.delete(ip);
}
