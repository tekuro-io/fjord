
import { NextResponse } from 'next/server';

const PASSWORD = 'stonks';

export async function POST(req: Request) {
  const formData = await req.formData();
  const password = formData.get('password');

  if (password === PASSWORD) {
    const response = NextResponse.json({ success: true });
    response.headers.append('Set-Cookie', `auth=true; Path=/; HttpOnly; SameSite=Strict; Max-Age=21600; Secure`);
    return response;
  }

  return NextResponse.json({ success: false });
}
