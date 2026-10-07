import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, readSessionToken } from './auth'
import { getRepo } from './repo'
import type { User } from './repo/types'

/**
 * Sesi pengguna.
 *
 * Isi cookie sudah ditandatangani, jadi tidak bisa dipalsukan. Meski begitu,
 * daftar pengguna tetap dibaca ulang pada setiap permintaan — supaya akun yang
 * dinonaktifkan langsung berhenti bekerja, tanpa menunggu sesinya habis.
 */

const DEV_USER: User = {
  email: 'mode-pengembangan@localhost',
  full_name: 'Mode Pengembangan',
  role: 'administrator',
  is_active: true,
  created_at: '',
  created_by: '',
  last_login_at: '',
  version: 0,
}

/**
 * Benar hanya di komputer sendiri, dan hanya kalau diminta secara eksplisit.
 * Jalur ini mati total di produksi karena memeriksa NODE_ENV.
 */
export function devBypassActive(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === '1'
}

export async function getCurrentUser(): Promise<User | null> {
  if (devBypassActive()) return DEV_USER

  const store = await cookies()
  const payload = readSessionToken(store.get(SESSION_COOKIE)?.value)
  if (!payload) return null

  try {
    const user = await getRepo().getUser(payload.email)
    // Tidak terdaftar atau dinonaktifkan → sesi langsung tidak berlaku.
    if (!user || !user.is_active) return null
    return user
  } catch (error) {
    // Daftar pengguna tidak bisa dibaca — misalnya penyimpanan sedang tidak
    // terjangkau. Daripada mengunci pemilik keluar dari aplikasinya sendiri,
    // sesi yang sudah ditandatangani tetap dipercaya pada keadaan ini.
    // Keadaannya dicatat supaya tidak lolos dari perhatian.
    console.error(
      '[netinv] Daftar pengguna tidak bisa dibaca; memakai isi sesi yang sudah ditandatangani.',
      error,
    )
    return {
      email: payload.email,
      full_name: payload.name,
      role: payload.role,
      is_active: true,
      created_at: '',
      created_by: '',
      last_login_at: '',
      version: 0,
    }
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
