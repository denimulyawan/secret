/** Bentuk hasil sebuah aksi formulir. Dipakai oleh seluruh form di aplikasi. */
export interface ActionState {
  /** true kalau berhasil disimpan. */
  ok: boolean
  /** Pesan ringkas untuk ditampilkan di atas form. */
  message?: string
  /** Pesan per kolom, ditampilkan tepat di bawah kolom yang bermasalah. */
  errors?: Record<string, string>
}

export const EMPTY_ACTION: ActionState = { ok: false }

/** Mengambil nilai teks dari formulir, sudah dirapikan. */
export function text(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

/** Mengambil nilai kotak centang. */
export function checked(formData: FormData, name: string): boolean {
  const value = formData.get(name)
  return value === 'on' || value === 'true' || value === '1'
}

export function failed(errors: Record<string, string>, message?: string): ActionState {
  return { ok: false, errors, message }
}

export function succeeded(message: string): ActionState {
  return { ok: true, message }
}
