import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'netinv — Pencatatan Aset',
  description: 'Pencatatan aset perangkat jaringan dan kredensialnya',
  // Halaman ini tidak boleh diindeks mesin pencari.
  robots: { index: false, follow: false, nocache: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
