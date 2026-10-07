/**
 * Enkripsi kredensial — AES-256-GCM.
 *
 * Aturan yang dipegang di sini:
 *   1. Password tidak pernah ditulis dalam bentuk teks biasa ke mana pun.
 *   2. Kunci enkripsi hidup di variabel lingkungan — TIDAK PERNAH di dalam
 *      penyimpanan data, tidak di dalam kode, tidak di dalam repo.
 *   3. Setiap penyimpanan memakai IV acak yang baru. IV yang dipakai ulang
 *      merusak keamanan GCM.
 *   4. AAD mengikat ciphertext ke satu baris tertentu. Akibatnya ciphertext yang
 *      disalin ke baris lain akan GAGAL didekripsi — bukan diam-diam terbaca.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/** Versi format. Ada supaya kunci bisa diganti nanti tanpa merusak data lama. */
const FORMAT_VERSION = 'v1'
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

export class CryptoConfigError extends Error {}

function loadMasterKey(): Buffer {
  const raw = process.env.APP_MASTER_KEY
  if (!raw) {
    throw new CryptoConfigError(
      'APP_MASTER_KEY belum diisi. Kunci ini wajib ada sebelum kredensial bisa dibuka atau disimpan.',
    )
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_BYTES) {
    throw new CryptoConfigError(
      `APP_MASTER_KEY harus ${KEY_BYTES} byte setelah di-decode base64, tetapi terbaca ${key.length} byte. ` +
        'Buat kunci baru dengan: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    )
  }
  return key
}

/** AAD untuk satu baris kredensial. Wajib sama persis saat menyimpan dan membuka. */
export function credentialAad(credentialId: string): string {
  return `credential:${credentialId}`
}

/**
 * Mengunci plaintext. Hasilnya berbentuk:
 *   v1:<IV base64>:<auth tag base64>:<ciphertext base64>
 */
export function seal(plaintext: string, aad: string): string {
  const key = loadMasterKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    FORMAT_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':')
}

/**
 * Membuka ciphertext. Melempar error kalau:
 *   - versi format tidak dikenal
 *   - AAD berbeda (ciphertext dipindah baris)
 *   - isi diubah orang lain (auth tag tidak cocok)
 *   - kunci salah
 */
export function open(sealed: string, aad: string): string {
  const parts = sealed.split(':')
  if (parts.length !== 4) {
    throw new Error('Isi kredensial rusak: bentuknya tidak dikenali.')
  }
  const [version, ivB64, tagB64, dataB64] = parts
  if (version !== FORMAT_VERSION) {
    throw new Error(
      `Versi format kredensial "${version}" tidak dikenal. Kemungkinan kunci sudah diganti tetapi data lama belum dipindahkan.`,
    )
  }
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Isi kredensial rusak: bagian IV atau auth tag tidak sesuai.')
  }
  const decipher = createDecipheriv('aes-256-gcm', loadMasterKey(), iv)
  decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new Error(
      'Kredensial gagal dibuka. Penyebab yang mungkin: kunci enkripsi berbeda, atau isinya diubah orang lain.',
    )
  }
}

/** Membuat kunci baru. Jalankan sekali, lalu simpan di dua tempat aman. */
export function generateMasterKeyBase64(): string {
  return randomBytes(KEY_BYTES).toString('base64')
}

/**
 * Bentuk tersamar untuk ditampilkan di layar.
 * Nilai aslinya tidak pernah dikirim ke tampilan kecuali lewat alur reveal.
 */
export function maskSecret(secret: string): string {
  if (secret.length <= 4) return '••••••••'
  return `••••••••${secret.slice(-2)}`
}
