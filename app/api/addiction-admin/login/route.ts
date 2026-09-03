import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  verifyPasswordPBKDF2,
  generateSessionCookie,
} from "@/lib/admin/auth";
import { getClientIp, checkRateLimit, recordLoginFailure, clearLoginAttempts } from "@/lib/admin/rate-limit";

export async function POST(request: NextRequest) {
  const cacheControlHeader = { "Cache-Control": "no-store" };

  // 1. CSRF検証
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { error: "bad_request" },
      { status: 400, headers: cacheControlHeader }
    );
  }

  const xAffAdmin = request.headers.get("x-aff-admin");
  if (xAffAdmin !== "1") {
    return NextResponse.json(
      { error: "bad_request" },
      { status: 400, headers: cacheControlHeader }
    );
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const hostHeader = request.headers.get("host");
      if (originUrl.host !== hostHeader) {
        return NextResponse.json(
          { error: "bad_request" },
          { status: 400, headers: cacheControlHeader }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "bad_request" },
        { status: 400, headers: cacheControlHeader }
      );
    }
  }

  // 2. 環境変数チェック
  const adminPasswordPbkdf2 = process.env.ADMIN_PASSWORD_PBKDF2;
  const adminSessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!adminPasswordPbkdf2 || !adminSessionSecret) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500, headers: cacheControlHeader }
    );
  }

  // 3. body解析
  let bodyData: unknown;
  try {
    bodyData = await request.json();
  } catch {
    return NextResponse.json(
      { error: "bad_request" },
      { status: 400, headers: cacheControlHeader }
    );
  }

  if (typeof bodyData !== "object" || bodyData === null) {
    return NextResponse.json(
      { error: "bad_request" },
      { status: 400, headers: cacheControlHeader }
    );
  }

  const password = (bodyData as Record<string, unknown>).password;
  if (typeof password !== "string") {
    return NextResponse.json(
      { error: "bad_request" },
      { status: 400, headers: cacheControlHeader }
    );
  }

  // 4. IP決定
  const ip = getClientIp(request);

  // 5. レート制限チェック
  const rateLimitStatus = await checkRateLimit(ip);
  if (rateLimitStatus.locked) {
    return NextResponse.json(
      { error: "locked", retryAfter: rateLimitStatus.retryAfter },
      { status: 429, headers: cacheControlHeader }
    );
  }

  // 6. パスワード検証
  const isPasswordValid = await verifyPasswordPBKDF2(password, adminPasswordPbkdf2);
  if (!isPasswordValid) {
    const failureStatus = await recordLoginFailure(ip);
    if (failureStatus.locked) {
      return NextResponse.json(
        { error: "locked", retryAfter: failureStatus.retryAfter },
        { status: 429, headers: cacheControlHeader }
      );
    }
    return NextResponse.json(
      { error: "invalid" },
      { status: 401, headers: cacheControlHeader }
    );
  }

  // 7. Cookie発行
  // セッション版はコード上の定数 1。DB を撤去したので `admin_settings.session_version`
  // は読まない（計画書 §7.5。全端末のログアウトが要るときは ADMIN_SESSION_SECRET を替える）。
  const sessionCookie = await generateSessionCookie(1, 43200, adminSessionSecret);

  const cookieStore = await cookies();
  cookieStore.set("aff_admin", sessionCookie, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 43200,
    secure: process.env.NODE_ENV === "production",
  });

  // 8. クリーンアップ
  await clearLoginAttempts(ip);

  // 9. 成功レスポンス
  return NextResponse.json({ ok: true }, { headers: cacheControlHeader });
}
