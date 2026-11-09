import { NextResponse, type NextRequest } from 'next/server';
import { detectPreferredLocale, resolveLocale, SUPPORTED_LOCALES } from '@/lib/i18n';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function middleware(request: NextRequest) {
  const locale = detectRequestLocale(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locale', locale);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  if (!request.cookies.get('device_id')) {
    response.cookies.set('device_id', crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: ONE_YEAR_SECONDS,
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
  }

  if (request.cookies.get('locale')?.value !== locale) {
    response.cookies.set('locale', locale, {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: ONE_YEAR_SECONDS,
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
  }

  return response;
}

function detectRequestLocale(request: NextRequest) {
  const pathLocale = request.nextUrl.pathname.split('/').filter(Boolean)[0];
  if (pathLocale && SUPPORTED_LOCALES.includes(pathLocale as (typeof SUPPORTED_LOCALES)[number])) {
    return resolveLocale(pathLocale);
  }

  return detectPreferredLocale(request.headers.get('accept-language'));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|mock-results|api/v1/health).*)']
};
