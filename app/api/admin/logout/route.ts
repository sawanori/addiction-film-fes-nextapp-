import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const cacheControlHeader = { "Cache-Control": "no-store" };

  // CSRF検証
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

  // Cookie失効
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
