import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = formData.get('password');

  if (password === 'stonks') {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('auth', 'true', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 6,
      path: '/',
    });
    return response;
  }

  return NextResponse.json({ success: false });
}
