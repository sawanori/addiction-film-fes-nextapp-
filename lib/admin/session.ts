import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionCookie, type SessionPayload } from "@/lib/admin/auth";
import { getDbClient } from "@/lib/db";

/**
 * 管理認証の Data Access Layer（DAL）。
 *
 * なぜレイアウト（app/(admin)/layout.tsx）で認証しないのか:
 * Next 16 の authentication ガイド
 * （node_modules/next/dist/docs/01-app/02-guides/authentication.md 1348-1354行）が、
 * 「レイアウトはクライアント遷移で再レンダリングされないため毎回セッションを
 * チェックできるとは限らず、また配下のルートセグメントのレンダリングを
 * 止める手段も持たない。認証チェックはレイアウトではなく、データソースに
 * 近い場所（DAL）で行うべき」と明記している。そのため認証チェックは
 * 各ページ・各 API ハンドラの先頭でこの DAL の関数を呼ぶことで行う。
 */
export const getAdminSession = cache(async (): Promise<SessionPayload | null> => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("aff_admin");
  if (!sessionCookie) {
    return null;
  }

  const payload = await verifySessionCookie(sessionCookie.value, secret);
  if (!payload) {
    return null;
  }

  // session_version の DB 照合(fail-closed: DB未設定・行なし・例外はすべて null)
  const client = getDbClient();
  if (!client) {
    return null;
  }

  let currentVersion: number;
  try {
    const { rows } = await client.execute({
      sql: "SELECT session_version FROM admin_settings WHERE id = 1",
      args: [],
    });
    if (rows.length === 0) {
      return null;
    }
    currentVersion = Number(rows[0].session_version);
  } catch {
    return null;
  }

  if (payload.ver !== currentVersion) {
    return null;
  }

  return payload;
});

/** ページ用。セッションが無ければ /addiction-admin/login?next=... へリダイレクトする。 */
export async function requireAdminSession(nextPath: string): Promise<SessionPayload> {
  const session = await getAdminSession();
  if (!session) {
    redirect(`/addiction-admin/login?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}

/** API ハンドラ用。セッションが無ければ 401 の Response を返す。 */
export async function requireAdminApi(): Promise<
  { ok: true; session: SessionPayload } | { ok: false; response: Response }
> {
  const session = await getAdminSession();
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { error: "unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }
  return { ok: true, session };
}
