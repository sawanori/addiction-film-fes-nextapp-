import { NextResponse, type NextRequest } from "next/server";

/**
 * 管理APIのリクエスト検証ヘルパー。
 * CSRF 3条件（`docs/implementation-plan.md` §9）は mutation 系の全エンドポイントで同じものを使う。
 */

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });
}

export function jsonOk(body: Record<string, unknown>) {
  return NextResponse.json(body, { headers: NO_STORE });
}

/**
 * CSRF の3条件を確かめる。満たさなければ 400 の Response、満たせば null。
 * (a) Content-Type が application/json
 * (b) カスタムヘッダ x-aff-admin: 1（クロスサイトの単純フォームPOSTはプリフライトで失敗する）
 * (c) Origin があれば Host と一致
 */
export function checkCsrf(request: NextRequest): NextResponse | null {
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().startsWith("application/json")) {
    return jsonError("bad_request", 400);
  }

  if (request.headers.get("x-aff-admin") !== "1") {
    return jsonError("bad_request", 400);
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get("host")) {
        return jsonError("bad_request", 400);
      }
    } catch {
      return jsonError("bad_request", 400);
    }
  }

  return null;
}

/** JSON body を読む。壊れていれば null。 */
export async function readJsonObject(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}
