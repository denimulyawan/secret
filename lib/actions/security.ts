'use server'

import { revalidatePath } from 'next/cache'
import { open } from '@/lib/crypto'
import { getRepo } from '@/lib/repo'
import { requireUser } from '@/lib/session'
import { generateTotpSecret, otpauthUrl, verifyTotp } from '@/lib/totp'
import { failed, text, type ActionState } from './types'

export interface TotpSetupState {
  ok: boolean
  message?: string
  /** Kunci untuk diketik manual ke aplikasi authenticator. */
  secret?: string
  /** Alamat otpauth, untuk dimasukkan lewat menu "masukkan kunci secara manual". */
  url?: string
  /** true kalau verifikasi sudah dicoba tetapi kodenya salah. */
  wrongCode?: boolean
}

const PENDING_KEY = 'totp_secret_pending'
const ACTIVE_KEY = 'totp_secret'

/**
 * Langkah 1: membuat kunci baru, tetapi BELUM diaktifkan.
 *
 * Kunci disimpan sebagai "menunggu" sampai pemilik membuktikan bahwa kuncinya
 * sudah benar-benar masuk ke aplikasi authenticator-nya. Kalau langsung
 * diaktifkan, ada kemungkinan terkunci di luar aplikasi sendiri karena kuncinya
 * tidak pernah tersalin dengan benar.
 */
export async function startTotpSetup(): Promise<TotpSetupState> {
  const user = await requireUser()
  const repo = getRepo()

  const secret = generateTotpSecret()
  await repo.putSetting(PENDING_KEY, secret, true, user.email)

  return {
    ok: true,
    secret,
    url: otpauthUrl(secret, user.email),
    message:
      'Masukkan kunci di bawah ke aplikasi authenticator Anda, lalu isi kode 6 digit yang muncul untuk memastikan kuncinya benar.',
  }
}

/** Langkah 2: membuktikan kuncinya sudah masuk, lalu mengaktifkannya. */
export async function confirmTotpSetup(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const repo = getRepo()
  const code = text(formData, 'code')

  const pending = await repo.getSetting(PENDING_KEY)
  if (!pending) {
    return failed({}, 'Belum ada kunci yang menunggu. Mulai ulang pemasangan.')
  }

  const secret = pending.is_secret
    ? open(pending.value_enc, `setting:${PENDING_KEY}`)
    : pending.value_enc

  if (!verifyTotp(secret, code)) {
    return failed(
      { code: 'Kode tidak cocok' },
      'Kode yang dimasukkan tidak cocok. Pastikan aplikasi authenticator menampilkan kode untuk netinv, lalu coba lagi.',
    )
  }

  await repo.putSetting(ACTIVE_KEY, secret, true, user.email)
  await repo.putSetting(PENDING_KEY, '', false, user.email)
  await repo.appendAudit({
    actor_email: user.email,
    action: 'update',
    object_type: 'setting',
    object_id: ACTIVE_KEY,
    result: 'ok',
    detail: 'verifikasi dua langkah diaktifkan',
  })

  revalidatePath('/setting/security')
  revalidatePath('/')
  return { ok: true, message: 'Verifikasi dua langkah aktif. Password kini memerlukan kode 6 digit saat dibuka.' }
}

/** Mematikan verifikasi dua langkah. */
export async function disableTotp(): Promise<void> {
  const user = await requireUser()
  const repo = getRepo()

  await repo.putSetting(ACTIVE_KEY, '', false, user.email)
  await repo.putSetting(PENDING_KEY, '', false, user.email)

  await repo.appendAudit({
    actor_email: user.email,
    action: 'update',
    object_type: 'setting',
    object_id: ACTIVE_KEY,
    result: 'ok',
    detail: 'verifikasi dua langkah dimatikan',
  })

  revalidatePath('/setting/security')
}

/** Menyimpan pengaturan alert. Nilai rahasia disimpan terenkripsi. */
export async function saveAlertSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const repo = getRepo()

  const token = text(formData, 'telegram_bot_token')
  const chatId = text(formData, 'telegram_chat_id')
  const days = text(formData, 'alert_days_before')
  const mode = text(formData, 'alert_mode') || 'digest'
  const enabled = text(formData, 'alert_enabled') === 'on'

  const errors: Record<string, string> = {}

  if (days) {
    const parts = days.split(',').map((p) => Number(p.trim()))
    if (parts.some((n) => !Number.isFinite(n) || n < 1 || n > 3650)) {
      errors.alert_days_before = 'Isi angka hari yang dipisahkan koma, misalnya: 90,60,30,7'
    }
  }
  if (Object.keys(errors).length > 0) return failed(errors)

  // Token hanya ditulis kalau benar-benar diisi, supaya membuka halaman ini
  // tanpa mengganti token tidak menghapus token yang sudah ada.
  if (token) await repo.putSetting('telegram_bot_token', token, true, user.email)
  await repo.putSetting('telegram_chat_id', chatId, false, user.email)
  await repo.putSetting('alert_days_before', days, false, user.email)
  await repo.putSetting('alert_mode', mode, false, user.email)
  await repo.putSetting('alert_enabled', enabled ? 'TRUE' : 'FALSE', false, user.email)

  revalidatePath('/setting/alert')
  return { ok: true, message: 'Pengaturan alert disimpan.' }
}
