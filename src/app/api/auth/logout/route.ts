import { NextResponse } from 'next/server';
import { clearTokenCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', clearTokenCookie());

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
