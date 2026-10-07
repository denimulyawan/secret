import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  callbackUrl,
  createSessionToken,
  exchangeCodeForIdentity,
  sessionTtlSeconds,
} from '@/lib/auth'
import { getRepo } from '@/lib/repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Balikan dari Google.
 *
 * Urutan pemeriksaannya penting:
 *   1. Nilai acak cocok — memastikan balikan ini memang untuk permintaan kita
 *   2. Kode ditukar ke Google, identitas diambil dari Google langsung
 *   3. Emailnya terdaftar DAN aktif di daftar pengguna
 *   4. Baru sesi dibuat
 *
 * Langkah 3 yang membuat daftar pengguna menjadi gerbang sebenarnya: login
 * Google bisa saja berhasil, tetapi akses tetap ditolak kalau emailnya tidak
 * terdaftar atau sudah dinonaktifkan.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, origin))

  const params = url.searchParams
  if (params.get('error')) return fail('dibatalkan')

  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) return fail('balikan-tidak-lengkap')

  const cookieStore = await cookies()
  const storedState = cookieStore.get(STATE_COOKIE)?.value
  if (!storedState || storedState !== state) return fail('nilai-acak-tidak-cocok')

  let identity
  try {
    identity = await exchangeCodeForIdentity(code, callbackUrl(origin))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal masuk.'
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, origin),
    )
  }

  const repo = getRepo()

  try {
    // Akun administrator pertama ditulis otomatis dari konfigurasi, sekali saja.
    const initialAdmin = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
    if (initialAdmin && identity.email === initialAdmin) {
      const existing = await repo.getUser(identity.email)
      if (!existing) {
        await repo.putUser(
          {
            email: identity.email,
            full_name: identity.name,
            role: 'administrator',
            is_active: true,
          },
          identity.email,
        )
      }
    }

    const user = await repo.getUser(identity.email)

    if (!user || !user.is_active) {
      await repo.appendAudit({
        actor_email: identity.email,
        action: 'login_failed',
        object_type: 'user',
        object_id: identity.email,
        result: 'denied',
        detail: user
          ? 'akun dinonaktifkan'
          : 'email tidak terdaftar di daftar pengguna',
      })
      return fail(
        user
          ? 'Akun Anda sedang dinonaktifkan.'
          : 'Email Anda belum terdaftar sebagai pengguna aplikasi ini.',
      )
    }

    await repo.putUser(
      { ...user, full_name: user.full_name || identity.name, last_login_at: new Date().toISOString() },
      user.email,
    )

    await repo.appendAudit({
      actor_email: user.email,
      action: 'login',
      object_type: 'user',
      object_id: user.email,
      result: 'ok',
    })

    const token = createSessionToken({
      email: user.email,
      name: user.full_name || identity.name,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds(),
    })

    const response = NextResponse.redirect(new URL('/', origin))
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: sessionTtlSeconds(),
    })
    // Nilai acak tidak diperlukan lagi.
    response.cookies.delete(STATE_COOKIE)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menyelesaikan login.'
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, origin))
  }
}
