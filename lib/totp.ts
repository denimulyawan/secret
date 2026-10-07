/**
 * Kode 6 digit (TOTP) untuk langkah verifikasi tambahan saat membuka password.
 *
 * Ditulis sendiri dengan modul crypto bawaan Node — tanpa pustaka tambahan.
 * Mengikuti standar yang sama dengan aplikasi authenticator pada umumnya
 * (HMAC-SHA1, langkah 30 detik, 6 angka), sehingga bisa dimasukkan ke
 * Google Authenticator, Authy, atau aplikasi sejenis.
 *
 * Kenapa lapisan ini ada: kalau seseorang berhasil masuk ke sesi yang sedang
 * terbuka — laptop yang tidak dikunci, misalnya — dia tetap tidak bisa menguras
 * seluruh password, karena masih diminta kode dari ponsel pemiliknya.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_SECONDS = 30
const DIGITS = 6

/** Membuat kunci baru dalam bentuk base32 (20 byte, sama seperti standar). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31]
  return output
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s-]/g, '').toUpperCase().replace(/=+$/, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const character of clean) {
    const index = BASE32.indexOf(character)
    if (index < 0) continue
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

function codeForCounter(secret: string, counter: number): string {
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0)
  buffer.writeUInt32BE(counter % 2 ** 32, 4)

  const digest = createHmac('sha1', base32Decode(secret)).update(buffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0')
}

/** Kode yang berlaku pada suatu waktu. Dipakai untuk pengujian dan pemeriksaan. */
export function totpCode(secret: string, timeMs: number = Date.now()): string {
  return codeForCounter(secret, Math.floor(timeMs / 1000 / STEP_SECONDS))
}

/**
 * Memeriksa kode yang dimasukkan pengguna.
 * Memberi toleransi satu langkah ke belakang dan ke depan, karena jam ponsel dan
 * jam server sering tidak persis sama.
 */
export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const clean = (code ?? '').replace(/\D/g, '')
  if (clean.length !== DIGITS) return false
  if (!secret) return false

  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS)
  for (let offset = -window; offset <= window; offset++) {
    const expected = codeForCounter(secret, counter + offset)
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(clean, 'utf8')
    if (a.length === b.length && timingSafeEqual(a, b)) return true
  }
  return false
}

/** Sisa detik sebelum kode saat ini berganti. Ditampilkan sebagai hitungan mundur. */
export function secondsUntilNextCode(timeMs: number = Date.now()): number {
  const elapsed = Math.floor(timeMs / 1000) % STEP_SECONDS
  return STEP_SECONDS - elapsed
}

/**
 * Alamat untuk dimasukkan ke aplikasi authenticator.
 * Bisa diketik manual kalau tidak mau memindai kode batang.
 */
export function otpauthUrl(secret: string, account: string, issuer = 'netinv'): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}
