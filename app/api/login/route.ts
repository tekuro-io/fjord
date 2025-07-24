// app/api/login/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = formData.get('password');

  if (password === 'stonks') {
    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: 'auth',
      value: 'true',
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      maxAge: 60 * 60 * 6, // 6 hours
      path: '/',
    });
    return response;
  }

  return NextResponse.json({ success: false });
}
