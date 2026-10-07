/**
 * Pemilihan penyimpanan.
 *
 * Seluruh aplikasi memanggil getRepo() dan tidak pernah tahu penyimpanan apa
 * yang dipakai di baliknya. Itulah yang membuat penyimpanan bisa ditukar tanpa
 * menyentuh tampilan maupun alur kerja.
 *
 * Dua mode:
 *   - "spreadsheet" : data disimpan di Google Sheets. Dipakai kalau konfigurasi
 *                     lengkap. Ini mode yang sebenarnya.
 *   - "sementara"   : penyimpanan di ingatan, mulai dari KOSONG. Dipakai supaya
 *                     aplikasi tetap bisa dibuka dan dilihat sebelum
 *                     penyimpanan dikonfigurasi. Isinya hilang saat dihentikan.
 */

import { MemoryRepo } from './memory'
import { SheetsRepo } from './sheets'
import type { Repo } from './types'

export type RepoMode = 'spreadsheet' | 'sementara'

let cached: Repo | null = null
let cachedMode: RepoMode = 'sementara'

export function spreadsheetConfigured(): boolean {
  return (
    Boolean(process.env.SHEET_ID?.trim()) &&
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()) &&
    Boolean(process.env.GOOGLE_PRIVATE_KEY_BASE64?.trim())
  )
}

export function repoMode(): RepoMode {
  return spreadsheetConfigured() ? 'spreadsheet' : 'sementara'
}

export function getRepo(): Repo {
  const mode = repoMode()
  if (cached && cachedMode === mode) return cached

  cached = mode === 'spreadsheet' ? new SheetsRepo() : new MemoryRepo()
  cachedMode = mode
  return cached
}

export function isPersistent(): boolean {
  return repoMode() === 'spreadsheet'
}

export type { Repo }
