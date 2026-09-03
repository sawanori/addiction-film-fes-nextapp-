import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireAdminApi } from "@/lib/admin/session";

export async function POST(request: NextRequest): Promise<Response> {
  const cacheControlHeader = { "Cache-Control": "no-store" };

  // 1. CSRF検証(既存ロジックのまま変更しない)
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

  // 2. 認証チェック(proxy.ts 廃止に伴い、このハンドラ自身が行う)
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  // 3. Cookie失効
  const cookieStore = await cookies();
  cookieStore.set("aff_admin", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ ok: true }, { headers: cacheControlHeader });
}
