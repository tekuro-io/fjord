import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const isLoginPage = req.nextUrl.pathname === '/login';
  const authCookie = req.cookies.get('auth');

  if (authCookie?.value === 'true') {
    if (isLoginPage) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next(); // allow access
  }

  if (!isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next(); // allow access to /login
}
