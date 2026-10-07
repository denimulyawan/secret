'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { open } from '@/lib/crypto'
import { getRepo } from '@/lib/repo'
import { canSeeCategory } from '@/lib/roles'
import { requireUser } from '@/lib/session'
import { verifyTotp } from '@/lib/totp'
import { failed, succeeded, text, type ActionState } from './types'

/** Batas percobaan membuka password, supaya tidak bisa dicoba terus-menerus. */
const REVEAL_LIMIT = 20
const REVEAL_WINDOW_MS = 15 * 60 * 1000

/** Berapa lama satu kode berlaku sebelum diminta lagi. */
const STEP_UP_VALID_MS = 5 * 60 * 1000

/**
 * Catatan jujur soal dua peta di bawah: keduanya hidup di ingatan proses, jadi
 * hanya berlaku untuk satu salinan aplikasi yang berjalan. Untuk satu pengguna
 * itu memadai. Kalau nanti dipakai banyak orang sekaligus, tempatnya dipindah ke
 * penyimpanan bersama.
 */
const revealAttempts = new Map<string, number[]>()
const stepUpUntil = new Map<string, number>()

function allowReveal(email: string): boolean {
  const now = Date.now()
  const history = (revealAttempts.get(email) ?? []).filter((t) => now - t < REVEAL_WINDOW_MS)
  if (history.length >= REVEAL_LIMIT) {
    revealAttempts.set(email, history)
    return false
  }
  history.push(now)
  revealAttempts.set(email, history)
  return true
}

/**
 * Sisa waktu verifikasi yang masih berlaku untuk pengguna ini.
 * Tidak diekspor: berkas aksi server hanya boleh mengekspor fungsi async.
 */
function stepUpRemaining(email: string): number {
  const until = stepUpUntil.get(email) ?? 0
  return Math.max(0, until - Date.now())
}

// ---------- Menyimpan kredensial ----------

/**
 * Menyimpan atau mengganti kredensial sebuah perangkat.
 *
 * Plaintext hanya hidup sesaat di dalam fungsi ini, lalu langsung dienkripsi.
 * Isi password TIDAK PERNAH masuk ke catatan audit, log, atau pesan galat.
 */
export async function saveCredential(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const repo = getRepo()

  const deviceId = text(formData, 'device_id')
  const username = text(formData, 'username')
  const secret = text(formData, 'secret')
  const port = Number(text(formData, 'port')) || 0
  const notes = text(formData, 'notes')

  const device = await repo.getDevice(deviceId)
  if (!device) return failed({}, 'Perangkat tidak ditemukan.')

  if (!canSeeCategory(user.role, device.asset_category)) {
    await repo.appendAudit({
      actor_email: user.email,
      action: 'access_denied',
      object_type: 'credential',
      object_id: deviceId,
      result: 'denied',
      detail: 'Mencoba menyimpan kredensial perangkat yang tidak boleh diakses',
    })
    return failed({}, 'Role Anda tidak punya akses ke perangkat ini.')
  }

  const errors: Record<string, string> = {}
  if (!secret) errors.secret = 'Password wajib diisi'
  else if (secret.length < 4) errors.secret = 'Password terlalu pendek'
  if (port && (port < 1 || port > 65535)) errors.port = 'Nomor port harus antara 1 dan 65535'
  if (Object.keys(errors).length > 0) return failed(errors)

  await repo.putCredential(
    {
      device_id: deviceId,
      cred_type: 'login',
      username,
      secret,
      port,
      notes,
    },
    user.email,
  )

  revalidatePath(`/asset/${deviceId}`)
  return succeeded(
    'Kredensial disimpan dalam keadaan terenkripsi. Jangan lupa diuji dengan mencoba masuk ke perangkatnya, lalu tandai terverifikasi.',
  )
}

// ---------- Membuka kredensial ----------

export interface RevealState {
  ok: boolean
  /** Diisi hanya kalau berhasil. */
  username?: string
  secret?: string
  /** true kalau aplikasi meminta kode 6 digit. */
  needCode?: boolean
  message?: string
  /** Sisa waktu verifikasi yang masih berlaku, dalam detik. */
  stepUpSeconds?: number
}

/**
 * Membuka password sebuah kredensial.
 *
 * Urutan pemeriksaan — dan urutannya penting:
 *   1. Sesi ada
 *   2. Perangkatnya boleh diakses role ini
 *   3. Belum melewati batas percobaan
 *   4. Kode 6 digit sah (atau verifikasi sebelumnya masih berlaku)
 *   5. Baru dibuka, lalu dicatat ke audit
 */
export async function revealCredential(
  _prev: RevealState,
  formData: FormData,
): Promise<RevealState> {
  const user = await requireUser()
  const repo = getRepo()

  const credentialId = text(formData, 'credential_id')
  const code = text(formData, 'code')

  const credentials = await repo.listCredentials()
  const credential = credentials.find((c) => c.credential_id === credentialId)
  if (!credential) return { ok: false, message: 'Kredensial tidak ditemukan.' }

  const device = await repo.getDevice(credential.device_id)
  if (!device) return { ok: false, message: 'Perangkat tidak ditemukan.' }

  if (!canSeeCategory(user.role, device.asset_category)) {
    await repo.appendAudit({
      actor_email: user.email,
      action: 'access_denied',
      object_type: 'credential',
      object_id: credentialId,
      result: 'denied',
      detail: 'Mencoba membuka password perangkat yang tidak boleh diakses',
    })
    return { ok: false, message: 'Role Anda tidak punya akses ke perangkat ini.' }
  }

  if (!allowReveal(user.email)) {
    await repo.appendAudit({
      actor_email: user.email,
      action: 'reveal_secret',
      object_type: 'credential',
      object_id: credentialId,
      result: 'denied',
      detail: 'melewati batas percobaan',
    })
    return {
      ok: false,
      message:
        'Terlalu banyak percobaan membuka password. Tunggu 15 menit, lalu coba lagi.',
    }
  }

  // Verifikasi dua langkah.
  const setting = await repo.getSetting('totp_secret')
  if (!setting) {
    return {
      ok: false,
      message:
        'Langkah verifikasi belum dipasang. Buka Setting → Keamanan untuk memasang aplikasi authenticator lebih dulu.',
    }
  }

  const secretValue = setting.is_secret
    ? open(setting.value_enc, 'setting:totp_secret')
    : setting.value_enc

  const stillValid = stepUpRemaining(user.email) > 0
  if (!stillValid) {
    if (!code) {
      return { ok: false, needCode: true, message: 'Masukkan kode 6 digit dari aplikasi authenticator.' }
    }
    if (!verifyTotp(secretValue, code)) {
      await repo.appendAudit({
        actor_email: user.email,
        action: 'reveal_secret',
        object_type: 'credential',
        object_id: credentialId,
        result: 'denied',
        detail: 'kode verifikasi salah',
      })
      return {
        ok: false,
        needCode: true,
        message: 'Kode tidak cocok. Periksa kembali kode yang berlaku saat ini.',
      }
    }
    stepUpUntil.set(user.email, Date.now() + STEP_UP_VALID_MS)
  }

  const payload = await repo.getCredentialSecret(credentialId)
  if (!payload) {
    return { ok: false, message: 'Isi kredensial tidak ditemukan atau tidak bisa dibuka.' }
  }

  await repo.appendAudit({
    actor_email: user.email,
    action: 'reveal_secret',
    object_type: 'credential',
    object_id: credentialId,
    result: 'ok',
    detail: `password dibuka untuk ${device.hostname}`,
  })

  return {
    ok: true,
    username: payload.username,
    secret: payload.secret,
    stepUpSeconds: Math.floor(stepUpRemaining(user.email) / 1000),
  }
}

export async function deleteCredentialAction(formData: FormData): Promise<void> {
  const user = await requireUser()
  const repo = getRepo()

  const credentialId = text(formData, 'credential_id')
  const deviceId = text(formData, 'device_id')

  await repo.deleteCredential(credentialId, user.email)

  revalidatePath(`/asset/${deviceId}`)
}

/** Membuat password acak yang kuat, supaya tidak ada password lemah. */
export async function generatePassword(): Promise<string> {
  await requireUser()
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const symbols = '!@#$%^&*-_=+'
  const bytes = randomBytes(20)
  let out = ''
  for (let i = 0; i < 16; i++) out += alphabet[bytes[i] % alphabet.length]
  out += symbols[bytes[16] % symbols.length]
  out += symbols[bytes[17] % symbols.length]
  out += String(bytes[18] % 10)
  return out
}
