import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Only intercept /api proxy paths
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const apiKey = process.env.POLYMER_API_KEY;
  if (!apiKey) return NextResponse.next();

  // Clone headers, add API key
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('X-API-Key', apiKey);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: '/api/:path*',
};
