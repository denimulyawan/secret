/**
 * Pemetaan antara baris spreadsheet dan objek di aplikasi.
 *
 * Selalu berdasarkan NAMA kolom, tidak pernah berdasarkan nomor kolom. Ini
 * penting: kalau seseorang menyisipkan satu kolom di tengah, pemetaan
 * berdasarkan nomor akan menulis ke kolom yang salah tanpa pesan galat apa pun.
 */

import { REQUIRED_HEADERS, TABS, type TabName } from './schema'
import { SheetsConfigError } from './client'

export type ColumnMap = Record<string, number>
export type Row = Record<string, string>

/** Membaca baris judul menjadi peta nama kolom ke nomornya (0-based). */
export function buildColumnMap(headerRow: string[]): ColumnMap {
  const map: ColumnMap = {}
  headerRow.forEach((name, index) => {
    const clean = name.trim()
    if (clean) map[clean] = index
  })
  return map
}

/**
 * Memastikan seluruh kolom wajib ada. Melempar error yang menyebutkan persis
 * kolom mana yang hilang, supaya bisa langsung diperbaiki.
 */
export function assertRequiredHeaders(tab: TabName, map: ColumnMap): void {
  const missing = REQUIRED_HEADERS[tab].filter((name) => !(name in map))
  if (missing.length > 0) {
    throw new SheetsConfigError(
      `Kolom pada tab "${tab}" tidak lengkap. Yang hilang: ${missing.join(', ')}. ` +
        `Perbaiki nama kolom di baris pertama tab "${tab}" — baris pertama harus berisi nama kolom, ` +
        `dan tidak boleh diubah urutannya tanpa menyesuaikan aplikasi.`,
    )
  }
}

/** Memeriksa seluruh struktur sekaligus, untuk pesan galat yang lengkap. */
export function assertSchema(tables: Partial<Record<TabName, string[][]>>): void {
  const problems: string[] = []

  for (const tab of Object.keys(TABS) as TabName[]) {
    const rows = tables[tab]
    if (!rows || rows.length === 0) {
      problems.push(`tab "${tab}" kosong atau tidak ditemukan`)
      continue
    }
    const map = buildColumnMap(rows[0])
    const missing = REQUIRED_HEADERS[tab].filter((name) => !(name in map))
    if (missing.length > 0) {
      problems.push(`tab "${tab}" kehilangan kolom: ${missing.join(', ')}`)
    }
  }

  if (problems.length > 0) {
    throw new SheetsConfigError(
      'Susunan spreadsheet belum sesuai. Yang perlu diperbaiki:\n- ' +
        problems.join('\n- ') +
        '\n\nLihat panduan susunan tab dan kolom di berkas SETUP.md.',
    )
  }
}

/** Mengubah satu baris spreadsheet menjadi objek. Kolom yang kosong jadi "". */
export function rowToObject(row: string[], map: ColumnMap): Row {
  const result: Row = {}
  for (const [name, index] of Object.entries(map)) {
    result[name] = (row[index] ?? '').toString().trim()
  }
  return result
}

/** Mengubah objek menjadi baris spreadsheet, urut sesuai peta kolom. */
export function objectToRow(data: Row, map: ColumnMap, width: number): string[] {
  const row = new Array<string>(width).fill('')
  for (const [name, index] of Object.entries(map)) {
    if (index < width) row[index] = data[name] ?? ''
  }
  return row
}

/**
 * Mengubah seluruh isi tab menjadi daftar objek.
 * Baris yang kosong seluruhnya dilewati — supaya baris kosong di bawah data
 * tidak menjadi catatan palsu.
 */
export function rowsToObjects(rows: string[][]): { map: ColumnMap; items: Row[] } {
  if (rows.length === 0) return { map: {}, items: [] }
  const map = buildColumnMap(rows[0])
  const items: Row[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    if (row.every((cell) => !cell || !cell.toString().trim())) continue
    items.push(rowToObject(row, map))
  }
  return { map, items }
}

// ---------- Pembantu tipe ----------

export function asBool(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase()
  return v === 'true' || v === 'ya' || v === '1' || v === 'y'
}

export function toBool(value: boolean | undefined): string {
  return value ? 'TRUE' : 'FALSE'
}

export function asNumber(value: string | undefined, fallback = 0): number {
  const n = Number((value ?? '').trim())
  return Number.isFinite(n) ? n : fallback
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** Bentuk pemilihan kolom untuk mengambil satu nilai dari sebuah baris. */
export function pick(row: Row, ...names: string[]): string {
  for (const name of names) {
    const value = row[name]
    if (value !== undefined && value !== null) return value
  }
  return ''
}
