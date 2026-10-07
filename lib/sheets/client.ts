/**
 * Penyambung ke Google Sheets.
 *
 * Ditulis sendiri tanpa pustaka pihak ketiga: penandatanganan JWT memakai
 * modul crypto bawaan Node, lalu permintaan dikirim dengan fetch. Alasannya:
 * menghindari dependensi besar, dan seluruh alurnya jadi bisa diperiksa.
 *
 * Kredensial TIDAK PERNAH ditulis di dalam kode. Semuanya dibaca dari variabel
 * lingkungan (lihat .env.example).
 */

import { createSign } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

const TOKEN_MARGIN_SECONDS = 60

export class SheetsConfigError extends Error {}
export class SheetsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: string,
  ) {
    super(message)
    this.name = 'SheetsApiError'
  }
}

interface ServiceAccount {
  clientEmail: string
  privateKey: string
}

let cachedToken: { value: string; expiresAtMs: number } | null = null

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Membaca kredensial akun layanan dari variabel lingkungan.
 *
 * Isi GOOGLE_PRIVATE_KEY_BASE64 boleh salah satu dari dua bentuk:
 *   1. Seluruh isi berkas JSON akun layanan yang di-encode base64
 *   2. Hanya kunci privatnya saja (PEM), di-encode base64
 * Bentuk base64 dipakai supaya baris baru di dalam kunci tidak rusak saat
 * disalin ke kolom variabel lingkungan.
 */
function loadServiceAccount(): ServiceAccount {
  const emailEnv = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? ''
  const blob = process.env.GOOGLE_PRIVATE_KEY_BASE64?.trim() ?? ''

  if (!blob) {
    throw new SheetsConfigError(
      'GOOGLE_PRIVATE_KEY_BASE64 belum diisi. Isi dengan isi berkas JSON akun layanan dalam bentuk base64.',
    )
  }

  let decoded = ''
  try {
    decoded = Buffer.from(blob, 'base64').toString('utf8')
  } catch {
    throw new SheetsConfigError('GOOGLE_PRIVATE_KEY_BASE64 bukan base64 yang sah.')
  }

  // Bentuk 1: seluruh berkas JSON.
  if (decoded.trimStart().startsWith('{')) {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(decoded) as Record<string, unknown>
    } catch {
      throw new SheetsConfigError(
        'Isi GOOGLE_PRIVATE_KEY_BASE64 terlihat seperti JSON tetapi tidak bisa dibaca.',
      )
    }
    const clientEmail = String(parsed.client_email ?? emailEnv)
    const privateKey = String(parsed.private_key ?? '')
    if (!clientEmail || !privateKey) {
      throw new SheetsConfigError(
        'Berkas JSON akun layanan tidak memuat client_email atau private_key.',
      )
    }
    return { clientEmail, privateKey }
  }

  // Bentuk 2: hanya kunci privatnya.
  if (!emailEnv) {
    throw new SheetsConfigError(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL belum diisi. Kalau yang disimpan hanya kunci privatnya, email akun layanan wajib diisi terpisah.',
    )
  }
  return { clientEmail: emailEnv, privateKey: decoded }
}

function buildJwt(account: ServiceAccount): string {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: account.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  const signature = signer.sign(account.privateKey)
  return `${unsigned}.${base64Url(signature)}`
}

async function fetchAccessToken(): Promise<{ value: string; expiresAtMs: number }> {
  const account = loadServiceAccount()
  const assertion = buildJwt(account)

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  })

  const text = await response.text()
  if (!response.ok) {
    throw new SheetsApiError(
      'Gagal meminta token akses ke Google. Periksa apakah akun layanan dan kuncinya cocok, dan apakah Google Sheets API sudah diaktifkan.',
      response.status,
      text,
    )
  }

  const payload = JSON.parse(text) as { access_token?: string; expires_in?: number }
  if (!payload.access_token) {
    throw new SheetsApiError('Google tidak mengembalikan token akses.', response.status, text)
  }

  return {
    value: payload.access_token,
    expiresAtMs: Date.now() + (payload.expires_in ?? 3600) * 1000,
  }
}

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAtMs - TOKEN_MARGIN_SECONDS * 1000 > now) {
    return cachedToken.value
  }
  cachedToken = await fetchAccessToken()
  return cachedToken.value
}

export function spreadsheetId(): string {
  const id = process.env.SHEET_ID?.trim()
  if (!id) {
    throw new SheetsConfigError('SHEET_ID belum diisi. Ambil dari alamat spreadsheet Anda.')
  }
  return id
}

/** Nama tab di-encode supaya tanda kutip dan spasi tetap aman di dalam rentang. */
function encodeRange(range: string): string {
  return encodeURIComponent(range)
}

interface ValuesResponse {
  range?: string
  values?: string[][]
}

/** Membaca beberapa rentang sekaligus — satu permintaan untuk banyak tab. */
export async function batchGetValues(
  ranges: string[],
): Promise<Map<string, string[][]>> {
  const token = await getAccessToken()
  const id = spreadsheetId()
  const query = ranges.map((r) => `ranges=${encodeRange(r)}`).join('&')
  const url = `${API_BASE}/${id}/values:batchGet?${query}&majorDimension=ROWS`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const text = await response.text()
  if (!response.ok) {
    throw new SheetsApiError(
      'Gagal membaca spreadsheet. Periksa apakah spreadsheet sudah dibagikan ke akun layanan dengan akses Editor.',
      response.status,
      text,
    )
  }

  const payload = JSON.parse(text) as { valueRanges?: ValuesResponse[] }
  const result = new Map<string, string[][]>()
  for (const item of payload.valueRanges ?? []) {
    if (item.range) result.set(item.range, item.values ?? [])
  }
  return result
}

export async function appendValues(range: string, values: string[][]): Promise<void> {
  const token = await getAccessToken()
  const id = spreadsheetId()
  const url = `${API_BASE}/${id}/values/${encodeRange(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new SheetsApiError(
      'Gagal menambah baris ke spreadsheet.',
      response.status,
      await response.text(),
    )
  }
}

export async function updateValues(range: string, values: string[][]): Promise<void> {
  const token = await getAccessToken()
  const id = spreadsheetId()
  const url = `${API_BASE}/${id}/values/${encodeRange(range)}?valueInputOption=RAW`

  const response = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new SheetsApiError(
      'Gagal menyimpan perubahan ke spreadsheet.',
      response.status,
      await response.text(),
    )
  }
}

/** Daftar nama tab yang benar-benar ada di spreadsheet. */
export async function listSheetTitles(): Promise<string[]> {
  const token = await getAccessToken()
  const id = spreadsheetId()
  const url = `${API_BASE}/${id}?fields=sheets.properties.title`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const text = await response.text()
  if (!response.ok) {
    throw new SheetsApiError('Gagal membaca daftar tab spreadsheet.', response.status, text)
  }
  const payload = JSON.parse(text) as {
    sheets?: { properties?: { title?: string } }[]
  }
  return (payload.sheets ?? [])
    .map((s) => s.properties?.title ?? '')
    .filter((title) => title.length > 0)
}

/**
 * Memeriksa bahwa koneksi benar-benar bisa dipakai, tanpa menulis apa pun.
 * Dipakai oleh halaman Sistem untuk memberi jawaban pasti, bukan dugaan.
 */
export async function checkConnection(): Promise<{
  ok: boolean
  message: string
  titles: string[]
}> {
  try {
    const titles = await listSheetTitles()
    return {
      ok: true,
      message: `Terhubung. ${titles.length} tab ditemukan.`,
      titles,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Kesalahan tidak dikenal saat menghubungi Google.'
    return { ok: false, message, titles: [] }
  }
}
