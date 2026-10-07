import { redirect } from 'next/navigation'
import type { User } from './repo/types'

/**
 * Sesi pengguna.
 *
 * Alur sebenarnya memakai Google OAuth: setelah masuk, email diperiksa terhadap
 * daftar pengguna yang aktif. Kalau tidak terdaftar atau dinonaktifkan, akses
 * ditolak meski login Google-nya berhasil.
 *
 * Berkas ini menentukan BENTUK sesinya dan menyediakan satu jalur khusus
 * pengembangan. Jalur itu mati total di produksi — lihat pemeriksaannya.
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

/** Benar hanya di komputer sendiri, dan hanya kalau diminta secara eksplisit. */
export function devBypassActive(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === '1'
}

export async function getCurrentUser(): Promise<User | null> {
  if (devBypassActive()) return DEV_USER
  // OAuth Google dipasang di sini.
  return null
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
