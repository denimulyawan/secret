/**
 * Pemilihan penyimpanan.
 *
 * Seluruh aplikasi memanggil getRepo() dan tidak pernah tahu penyimpanan apa yang
 * dipakai di baliknya. Itulah yang membuat penyimpanan bisa ditukar tanpa
 * menyentuh tampilan maupun alur kerja.
 */

import { MemoryRepo } from './memory'
import type { Repo } from './types'

let cached: Repo | null = null
let cachedMode = ''

export type RepoMode = 'spreadsheet' | 'sementara'

export function repoMode(): RepoMode {
  const configured =
    Boolean(process.env.SHEET_ID?.trim()) &&
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()) &&
    Boolean(process.env.GOOGLE_PRIVATE_KEY_BASE64?.trim())
  return configured ? 'spreadsheet' : 'sementara'
}

export function getRepo(): Repo {
  const mode = repoMode()
  if (cached && cachedMode === mode) return cached

  if (mode === 'spreadsheet') {
    // Penyimpanan spreadsheet dipasang di sini. Selama belum ada, aplikasi
    // memakai penyimpanan sementara supaya tetap bisa dibuka dan dilihat.
    //
    //   const { SheetsRepo } = await import('./sheets')
    //   cached = new SheetsRepo()
  }

  cached = new MemoryRepo()
  cachedMode = mode
  return cached
}

export function isPersistent(): boolean {
  return repoMode() === 'spreadsheet'
}
