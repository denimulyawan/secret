/**
 * Pemeriksaan lisensi harian.
 *
 * Dipanggil otomatis oleh penjadwal Vercel. Bisa juga dipanggil manual dengan
 * menambahkan ?force=1 untuk menguji tanpa menunggu jadwalnya.
 *
 * Dua pengaman yang dipegang di sini:
 *   1. Alamat ini dilindungi kunci rahasia, supaya orang lain tidak bisa
 *      memicu pengiriman pesan.
 *   2. Sebelum mengirim, diperiksa apakah kombinasi (perangkat, tanggal
 *      berakhir, ambang) sudah pernah terkirim. Tanpa pemeriksaan ini, satu
 *      lisensi akan memicu pesan yang sama SETIAP HARI selama 90 hari terakhir
 *      masa berlakunya — dan notifikasi yang membanjiri pasti diabaikan orang.
 */

import { open } from '@/lib/crypto'
import { getRepo } from '@/lib/repo'
import {
  buildDigest,
  buildSingleMessage,
  daysUntil,
  parseThresholds,
  resolveOwner,
  sendTelegramMessage,
  type AlertItem,
} from '@/lib/telegram'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Batas waktu fungsi. Pemeriksaan ini membaca beberapa tab lalu mengirim pesan.
export const maxDuration = 60

export async function GET(request: Request) {
  const url = new URL(request.url)
  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    url.searchParams.get('secret') ??
    ''

  const expected = process.env.CRON_SECRET ?? ''
  if (!expected || provided !== expected) {
    return Response.json({ ok: false, error: 'Tidak diizinkan.' }, { status: 401 })
  }

  const repo = getRepo()

  try {
    const [enabledSetting, tokenSetting, chatIdSetting, daysSetting, modeSetting] =
      await Promise.all([
        repo.getSetting('alert_enabled'),
        repo.getSetting('telegram_bot_token'),
        repo.getSetting('telegram_chat_id'),
        repo.getSetting('alert_days_before'),
        repo.getSetting('alert_mode'),
      ])

    if ((enabledSetting?.value_enc ?? '').toUpperCase() !== 'TRUE') {
      return Response.json({ ok: true, skipped: 'Saklar alert sedang dimatikan.' })
    }

    // Jam pengiriman ditentukan oleh jadwal di vercel.json, bukan dari dalam
    // aplikasi. Alasannya: paket Vercel Hobby hanya mengizinkan penjadwalan
    // sekali sehari, sehingga jam kirim tidak bisa diatur bebas dari sini.
    // Pengaman terhadap pengiriman dobel tetap dijaga oleh alert_log.

    if (!tokenSetting?.value_enc) {
      return Response.json({ ok: false, error: 'Token bot Telegram belum diisi.' }, { status: 400 })
    }

    const token = tokenSetting.is_secret
      ? open(tokenSetting.value_enc, 'setting:telegram_bot_token')
      : tokenSetting.value_enc
    const chatId = chatIdSetting?.value_enc ?? ''

    if (!chatId) {
      return Response.json({ ok: false, error: 'ID chat tujuan belum diisi.' }, { status: 400 })
    }

    const thresholds = parseThresholds(daysSetting?.value_enc || '90,60,30,7')
    const mode = modeSetting?.value_enc || 'digest'

    // Hanya aset Customer yang dikirim ke Telegram. Aset Personal milik pemilik
    // sendiri tidak perlu masuk percakapan Telegram.
    const [devices, customers, cars, log] = await Promise.all([
      repo.listDevices({ category: 'customer' }),
      repo.listCustomers(),
      repo.listCars(),
      repo.listAlertLog(10_000),
    ])

    const alreadySent = new Set(
      log
        .filter((row) => row.status === 'sent')
        .map((row) => `${row.device_id}|${row.license_end}|${row.threshold_days}`),
    )

    const items: AlertItem[] = []
    for (const device of devices) {
      if (device.status === 'retired') continue
      const days = daysUntil(device.end_license)
      if (days === null) continue

      for (const threshold of thresholds) {
        if (days > threshold) continue
        const key = `${device.device_id}|${device.end_license}|${threshold}`
        if (alreadySent.has(key)) continue
        const owner = resolveOwner(device, customers, cars)
        items.push({ device, customerName: owner.customerName, carName: owner.carName, carPhone: owner.carPhone, daysLeft: days, threshold })
      }
    }

    if (items.length === 0) {
      return Response.json({ ok: true, checked: devices.length, sent: 0, note: 'Tidak ada lisensi yang masuk ambang.' })
    }

    if (mode === 'per_license') {
      let sent = 0
      const errors: string[] = []
      for (const item of items) {
        const result = await sendTelegramMessage(token, chatId, buildSingleMessage(item))
        if (result.ok) {
          sent++
          await repo.appendAlertLog({
            device_id: item.device.device_id,
            license_end: item.device.end_license,
            threshold_days: item.threshold,
            status: 'sent',
            message_id: result.messageId ?? '',
          })
        } else {
          errors.push(result.error ?? 'gagal')
          await repo.appendAlertLog({
            device_id: item.device.device_id,
            license_end: item.device.end_license,
            threshold_days: item.threshold,
            status: 'failed',
            error: result.error ?? 'gagal',
          })
        }
      }
      return Response.json({ ok: true, mode, checked: devices.length, total: items.length, sent, failed: errors.length })
    }

    // Bentuk ringkasan: satu pesan berisi semuanya.
    const text = buildDigest(items)
    const result = await sendTelegramMessage(token, chatId, text)

    if (!result.ok) {
      // Gagal berarti BELUM terkirim: satu baris catatan saja, dan tidak ada
      // yang ditandai terkirim sehingga akan dicoba lagi pada pemeriksaan
      // berikutnya.
      await repo.appendAlertLog({
        device_id: '(ringkasan)',
        license_end: '',
        threshold_days: 0,
        status: 'failed',
        error: result.error ?? 'gagal',
      })
      return Response.json(
        { ok: false, mode, total: items.length, failed: 1, error: result.error },
        { status: 502 },
      )
    }

    for (const item of items) {
      await repo.appendAlertLog({
        device_id: item.device.device_id,
        license_end: item.device.end_license,
        threshold_days: item.threshold,
        status: 'sent',
        message_id: result.messageId ?? '',
      })
    }

    return Response.json({
      ok: true,
      mode: 'digest',
      checked: devices.length,
      total: items.length,
      sent: 1,
      messageId: result.messageId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kesalahan tidak dikenal.'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
