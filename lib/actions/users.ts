'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getRepo } from '@/lib/repo'
import { requireUser } from '@/lib/session'
import { failed, succeeded, text, type ActionState } from './types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function backWith(message: string): never {
  redirect(`/setting/users?pesan=${encodeURIComponent(message)}`)
}

/** Menambah pengguna baru. Hanya Administrator. */
export async function saveUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser()
  if (actor.role !== 'administrator') {
    return failed({}, 'Hanya Administrator yang bisa menambah pengguna.')
  }

  const repo = getRepo()
  const email = text(formData, 'email').toLowerCase()
  const fullName = text(formData, 'full_name')
  const role = text(formData, 'role') === 'administrator' ? 'administrator' : 'engineer'

  const errors: Record<string, string> = {}
  if (!email) errors.email = 'Alamat email wajib diisi'
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Bentuk alamat email tidak benar'
  if (Object.keys(errors).length > 0) return failed(errors)

  const existing = await repo.getUser(email)
  if (existing) {
    return failed(
      { email: `Pengguna dengan email ${email} sudah terdaftar` },
      'Email itu sudah ada di daftar. Kalau akunnya sedang dinonaktifkan, aktifkan kembali dari daftar di bawah.',
    )
  }

  await repo.putUser(
    { email, full_name: fullName, role, is_active: true },
    actor.email,
  )

  revalidatePath('/setting/users')
  return succeeded(
    `${email} ditambahkan sebagai ${role === 'administrator' ? 'Administrator' : 'Engineer'}. Orang itu bisa langsung masuk memakai akun Google-nya.`,
  )
}

/**
 * Mengubah role pengguna.
 *
 * Administrator tidak boleh mengubah role dirinya sendiri — supaya tidak ada
 * kemungkinan terkunci dari aplikasi sendiri karena salah klik.
 */
export async function changeUserRole(formData: FormData): Promise<void> {
  const actor = await requireUser()
  if (actor.role !== 'administrator') backWith('Hanya Administrator yang bisa mengubah role.')

  const repo = getRepo()
  const email = text(formData, 'email').toLowerCase()
  const role = text(formData, 'role') === 'administrator' ? 'administrator' : 'engineer'

  if (email === actor.email.toLowerCase()) {
    backWith('Role akun Anda sendiri tidak bisa diubah dari halaman ini. Itu pengaman supaya Anda tidak terkunci dari aplikasi sendiri.')
  }

  const target = await repo.getUser(email)
  if (!target) backWith('Pengguna itu tidak ditemukan.')

  await repo.putUser({ ...target, role }, actor.email)
  revalidatePath('/setting/users')
  backWith(`Role ${email} diubah menjadi ${role === 'administrator' ? 'Administrator' : 'Engineer'}.`)
}

/**
 * Mengaktifkan atau menonaktifkan pengguna.
 *
 * Pengguna TIDAK dihapus, hanya dinonaktifkan — supaya catatan audit lama yang
 * menyebut emailnya tetap bisa ditelusuri. Sesi orang itu langsung berhenti
 * berlaku pada permintaan berikutnya.
 */
export async function toggleUserActive(formData: FormData): Promise<void> {
  const actor = await requireUser()
  if (actor.role !== 'administrator') backWith('Hanya Administrator yang bisa mengubah pengguna.')

  const repo = getRepo()
  const email = text(formData, 'email').toLowerCase()

  if (email === actor.email.toLowerCase()) {
    backWith('Akun Anda sendiri tidak bisa dinonaktifkan. Itu pengaman supaya Anda tidak terkunci dari aplikasi sendiri.')
  }

  const target = await repo.getUser(email)
  if (!target) backWith('Pengguna itu tidak ditemukan.')

  const next = !target.is_active
  await repo.putUser({ ...target, is_active: next }, actor.email)
  revalidatePath('/setting/users')
  backWith(next ? `${email} diaktifkan kembali.` : `${email} dinonaktifkan. Sesi orang itu langsung berhenti berlaku.`)
}
