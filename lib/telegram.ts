/**
 * Pengirim pesan Telegram dan penyusun ringkasan lisensi.
 *
 * Token bot TIDAK PERNAH ditulis di dalam kode — dibaca dari penyimpanan
 * pengaturan dalam keadaan terenkripsi, di sisi server saja.
 */

import type { Car, Customer, Device } from './repo/types'

const API_BASE = 'https://api.telegram.org'

export interface AlertItem {
  device: Device
  customerName: string
  carName: string
  carPhone: string
  daysLeft: number
  threshold: number
}

export interface SendResult {
  ok: boolean
  messageId?: string
  error?: string
}

/** Mengubah stempel waktu menjadi tanggal yang mudah dibaca orang. */
function readableDate(iso: string): string {
  if (!iso) return '—'
  const parsed = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed)) return iso
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(parsed))
}

/**
 * Menyusun satu ringkasan dari sekumpulan peringatan.
 *
 * Dikelompokkan menurut CAR, karena satu bagian pesan = satu orang yang harus
 * dihubungi. Dengan begitu pesannya bisa langsung diteruskan ke orang itu tanpa
 * perlu diedit dulu.
 */
export function buildDigest(items: AlertItem[]): string {
  if (items.length === 0) return ''

  const byThreshold = new Map<number, Map<string, AlertItem[]>>()

  for (const item of items) {
    if (!byThreshold.has(item.threshold)) byThreshold.set(item.threshold, new Map())
    const byCar = byThreshold.get(item.threshold)!
    const key = item.carName || 'Tanpa CAR'
    if (!byCar.has(key)) byCar.set(key, [])
    byCar.get(key)!.push(item)
  }

  const thresholds = [...byThreshold.keys()].sort((a, b) => b - a)
  const lines: string[] = [`⚠️ ${items.length} lisensi akan berakhir`, '']

  for (const threshold of thresholds) {
    lines.push(`── ${threshold} hari lagi ──────────────────`)
    const byCar = byThreshold.get(threshold)!
    const carNames = [...byCar.keys()].sort()

    for (const carName of carNames) {
      const carItems = byCar.get(carName)!.sort((a, b) => a.daysLeft - b.daysLeft)
      const phone = carItems[0]?.carPhone ?? ''
      lines.push(phone ? `${carName} — ${phone}` : carName)
      for (const item of carItems) {
        const model = item.device.device_model || item.device.brand_code
        lines.push(
          `  • ${item.device.hostname}  ${model}  ${item.customerName}  ${readableDate(item.device.end_license)}`,
        )
      }
      lines.push('')
    }
  }

  lines.push('Buka aplikasi untuk melihat rinciannya.')
  return lines.join('\n')
}

/** Satu pesan untuk satu lisensi. Dipakai kalau bentuk pengiriman diubah. */
export function buildSingleMessage(item: AlertItem): string {
  const model = item.device.device_model || item.device.brand_code
  return [
    `⚠️ Lisensi akan berakhir dalam ${item.threshold} hari`,
    '',
    `Perangkat : ${item.device.hostname} (${model})`,
    `Pelanggan : ${item.customerName || '—'}`,
    `CAR       : ${item.carName || '—'}${item.carPhone ? ` — ${item.carPhone}` : ''}`,
    `Lisensi   : berakhir ${readableDate(item.device.end_license)} (${item.daysLeft} hari lagi)`,
  ].join('\n')
}

/** Mengirim pesan teks lewat bot Telegram. */
export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<SendResult> {
  if (!token) return { ok: false, error: 'Token bot belum diisi.' }
  if (!chatId) return { ok: false, error: 'ID chat tujuan belum diisi.' }

  try {
    const response = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      cache: 'no-store',
    })

    const raw = await response.text()

    if (!response.ok) {
      // Pesan galat dari Telegram bisa memuat token; hanya bagian keterangannya
      // yang diambil, lalu dipotong supaya tidak membocorkan apa pun.
      let description = raw.slice(0, 200)
      try {
        const parsed = JSON.parse(raw) as { description?: string }
        if (parsed.description) description = parsed.description
      } catch {
        /* biarkan apa adanya, sudah dipotong */
      }
      return { ok: false, error: `${response.status}: ${description}` }
    }

    let messageId: string | undefined
    try {
      const parsed = JSON.parse(raw) as { result?: { message_id?: number } }
      if (parsed.result?.message_id) messageId = String(parsed.result.message_id)
    } catch {
      /* tidak wajib ada */
    }

    return { ok: true, messageId }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Gagal menghubungi Telegram.',
    }
  }
}

/** Mencari CAR dan nama pelanggan untuk sebuah perangkat. */
export function resolveOwner(
  device: Device,
  customers: Customer[],
  cars: Car[],
): { customerName: string; carName: string; carPhone: string } {
  const customer = customers.find((c) => c.customer_id === device.customer_id)
  const car = customer?.car_id ? cars.find((c) => c.car_id === customer.car_id) : undefined
  return {
    customerName: customer?.customer_name ?? '',
    carName: car?.car_name ?? '',
    carPhone: car?.car_phone ?? '',
  }
}

/** Selisih hari dari hari ini ke sebuah tanggal. */
export function daysUntil(dateIso: string): number | null {
  if (!dateIso) return null
  const target = Date.parse(`${dateIso}T00:00:00Z`)
  if (Number.isNaN(target)) return null
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((target - today) / 86_400_000)
}

/** Mengurai daftar ambang hari, misalnya "90,60,30,7". */
export function parseThresholds(raw: string): number[] {
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a)
}
