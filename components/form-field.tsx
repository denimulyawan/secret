import type { ReactNode } from 'react'

/**
 * Satu kolom isian beserta label, keterangan format, dan pesan kesalahannya.
 *
 * Dua aturan yang dipegang di sini, sesuai permintaan pemilik:
 *   1. TIDAK ADA teks abu-abu contoh di dalam kolom isian. Keterangan format
 *      ditulis di bawah kolom, bukan di dalamnya.
 *   2. Pesan kesalahan muncul tepat di bawah kolom yang bermasalah, dengan
 *      kalimat yang bisa langsung dimengerti.
 */
export default function FormField({
  label,
  name,
  hint,
  error,
  required,
  wide,
  children,
}: {
  label: string
  name: string
  hint?: string
  error?: string
  required?: boolean
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={error ? 'field has-error' : 'field'} style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <label htmlFor={name}>
        {label}
        {required ? <span className="faint"> · wajib</span> : null}
      </label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
      {error ? (
        <span className="error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
