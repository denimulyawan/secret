import { NextResponse } from 'next/server'
import { STATE_COOKIE, authConfigured, buildAuthUrl, callbackUrl, randomState } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Memulai alur login Google.
 *
 * Sebelum mengalihkan ke Google, sebuah nilai acak disimpan di cookie. Nilai itu
 * diminta kembali saat Google membalikkan pengguna, untuk memastikan balikannya
 * memang berasal dari permintaan yang kita mulai sendiri.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin

  if (!authConfigured()) {
    return NextResponse.redirect(new URL('/login?error=belum-dikonfigurasi', origin))
  }

  const state = randomState()
  const response = NextResponse.redirect(buildAuthUrl(callbackUrl(origin), state))

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  })

  return response
}
