import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionCookie } from '@/lib/admin/auth';

/**
 * Admin proxy - handles authentication for admin routes and API endpoints.
 * Does not depend on shared modules, globals, or database access.
 * Can be deployed to CDN for fast request handling.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow unauthenticated access to login routes
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  // Get admin session cookie
  const sessionCookie = request.cookies.get('aff_admin');

  if (!sessionCookie) {
    // No session cookie - require authentication
    return handleUnauthenticated(request, pathname);
  }

  // Verify session cookie signature and expiration
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!sessionSecret) {
    // Secret not available - deny access
    return handleUnauthenticated(request, pathname);
  }

  const payload = await verifySessionCookie(sessionCookie.value, sessionSecret);

  if (!payload) {
    // Cookie is invalid or expired - require authentication
    return handleUnauthenticated(request, pathname);
  }

  // Session is valid - allow request to proceed
  return NextResponse.next();
}

/**
 * Handle unauthenticated requests based on route type
 */
function handleUnauthenticated(request: NextRequest, pathname: string): NextResponse | Response {
  // API requests return 401
  if (pathname.startsWith('/api/admin/')) {
    return Response.json(
      { error: 'unauthorized' },
      { status: 401 }
    );
  }

  // Page requests redirect to login with return URL
  const loginUrl = new URL('/admin/login', request.url);
  loginUrl.searchParams.set('next', pathname);

  return NextResponse.redirect(loginUrl, { status: 307 });
}

/**
 * Proxy configuration - apply authentication to admin and admin API routes
 */
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
