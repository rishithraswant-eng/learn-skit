import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protected paths that require authentication and must not be indexed
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/s/') ||
    pathname.startsWith('/tools') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/onboarding')
  ) {
    const response = NextResponse.redirect(
      new URL(`/#/?next=${encodeURIComponent(pathname)}`, request.url)
    );
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Match only non-public routes:
   * Excludes:
   * - / (landing page)
   * - /privacy, /terms
   * - /robots.txt, /sitemap.xml
   * - /favicon.ico, /icon*, /apple-icon*, /opengraph-image*
   * - /manifest.webmanifest, /manifest.json
   * - static assets (_next/static, css, js, icons, etc.)
   */
  matcher: [
    '/((?!_next/static|_next/image|css/|js/|icons/|privacy|terms|robots\\.txt|sitemap\\.xml|favicon\\.ico|opengraph-image.*|icon.*|apple-icon.*|manifest\\.webmanifest|manifest\\.json|$).*)',
  ],
};
