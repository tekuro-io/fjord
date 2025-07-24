'use server';

import { headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

const PASSWORD = 'stonks';

export async function login(formData: FormData) {
  const password = formData.get('password');

  if (password === PASSWORD) {
    const response = NextResponse.redirect('/'); // or wherever

    response.cookies.set({
      name: 'auth',
      value: 'true',
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 6, // 6 hours
    });

    return response;
  }

  return NextResponse.json({ success: false });
}
