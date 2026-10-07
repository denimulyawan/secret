/**
 * Login Google.
 *
 * Tidak ada username dan password khusus aplikasi ini. Masuk memakai akun
 * Google, sehingga tidak ada password aplikasi yang perlu dibuat, dihafal, atau
 * bocor. Keamanan login sepenuhnya mengikuti akun Google pemiliknya — termasuk
 * verifikasi dua langkah yang sudah aktif di sana.
 *
 * Ditulis dengan modul crypto bawaan Node, tanpa pustaka tambahan.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Role } from './repo/types'

export const SESSION_COOKIE = 'netinv_session'
export const STATE_COOKIE = 'netinv_oauth_state'

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

export class AuthConfigError extends Error {}

export interface SessionPayload {
  email: string
  name: string
  /**
   * Role ikut disimpan di dalam sesi yang sudah ditandatangani, sebagai
   * cadangan kalau daftar pengguna sedang tidak bisa dibaca. Nilai yang
   * sebenarnya tetap diambil dari daftar pengguna pada setiap permintaan.
   */
  role: Role
  /** Waktu kedaluwarsa dalam detik Unix. */
  exp: number
}

export function authConfigured(): boolean {
  return (
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()) &&
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()) &&
    Boolean(process.env.AUTH_SECRET?.trim())
  )
}

export function sessionTtlSeconds(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS ?? '8')
  return (Number.isFinite(hours) && hours > 0 ? hours : 8) * 3600
}

function secretBuffer(): Buffer {
  const value = process.env.AUTH_SECRET?.trim()
  if (!value) {
    throw new AuthConfigError(
      'AUTH_SECRET belum diisi. Isi dengan rangkaian acak yang panjang — dipakai untuk menandatangani sesi login.',
    )
  }
  return Buffer.from(value, 'utf8')
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string): string {
  return createHmac('sha256', secretBuffer()).update(payload).digest('base64url')
}

/** Membuat isi cookie sesi: data + tanda tangan, dipisah titik. */
export function createSessionToken(payload: SessionPayload): string {
  const body = base64Url(JSON.stringify(payload))
  return `${body}.${sign(body)}`
}

/**
 * Membaca cookie sesi dan memastikan tanda tangannya sah.
 * Mengembalikan null kalau cookie tidak ada, diubah orang lain, atau kedaluwarsa.
 */
export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, signature] = parts
  if (!body || !signature) return null

  let expected: string
  try {
    expected = sign(body)
  } catch {
    return null
  }

  const a = Buffer.from(signature, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (!payload.email || typeof payload.exp !== 'number') return null
    if (payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function randomState(): string {
  return randomBytes(24).toString('base64url')
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  if (!clientId) throw new AuthConfigError('GOOGLE_OAUTH_CLIENT_ID belum diisi.')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    // Memaksa pemilihan akun, supaya tidak diam-diam memakai akun yang salah
    // saat seseorang punya beberapa akun Google di perambannya.
    prompt: 'select_account',
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

/** Alamat balikan yang didaftarkan di Google Cloud Console. */
export function callbackUrl(origin: string): string {
  return new URL('/api/auth/callback', origin).toString()
}

export interface GoogleIdentity {
  email: string
  name: string
  emailVerified: boolean
}

/**
 * Menukar kode otorisasi menjadi identitas pengguna.
 *
 * Dua langkah: kode ditukar menjadi token akses, lalu token itu dipakai untuk
 * menanyakan identitas ke Google. Identitasnya diambil dari Google langsung,
 * bukan dari data yang dikirim peramban — supaya tidak bisa dipalsukan.
 */
export async function exchangeCodeForIdentity(
  code: string,
  redirectUri: string,
): Promise<GoogleIdentity> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new AuthConfigError('Konfigurasi OAuth Google belum lengkap.')
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  })

  const tokenText = await tokenResponse.text()
  if (!tokenResponse.ok) {
    throw new Error(
      'Gagal menukar kode otorisasi ke Google. Periksa kembali ID klien, rahasia klien, dan alamat balikan yang didaftarkan.',
    )
  }

  const tokenPayload = JSON.parse(tokenText) as { access_token?: string }
  if (!tokenPayload.access_token) {
    throw new Error('Google tidak mengembalikan token akses.')
  }

  const infoResponse = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    cache: 'no-store',
  })

  const infoText = await infoResponse.text()
  if (!infoResponse.ok) {
    throw new Error('Gagal membaca identitas pengguna dari Google.')
  }

  const info = JSON.parse(infoText) as {
    email?: string
    name?: string
    email_verified?: boolean
  }

  if (!info.email) {
    throw new Error('Google tidak mengembalikan alamat email.')
  }

  return {
    email: info.email.toLowerCase(),
    name: info.name ?? '',
    emailVerified: info.email_verified === true,
  }
}
