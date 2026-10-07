import { authConfigured } from '@/lib/auth'
import { devBypassActive } from '@/lib/session'

export const metadata = { title: 'Masuk — netinv' }

/** Pesan yang bisa muncul saat balikan dari Google. */
const ERROR_MESSAGES: Record<string, string> = {
  'belum-dikonfigurasi':
    'Login Google belum dikonfigurasi. Isi konfigurasi OAuth lebih dulu (lihat panduan setup).',
  dibatalkan: 'Login dibatalkan.',
  'balikan-tidak-lengkap': 'Balikan dari Google tidak lengkap. Coba masuk sekali lagi.',
  'nilai-acak-tidak-cocok':
    'Pemeriksaan keamanan login tidak cocok. Ini bisa terjadi kalau halaman dibuka terlalu lama. Coba masuk sekali lagi.',
}

/**
 * Halaman masuk.
 *
 * Tidak ada kolom username dan password di sini. Masuk memakai akun Google,
 * sehingga tidak ada password aplikasi yang perlu dibuat, dihafal, atau bocor.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const configured = authConfigured()
  const dev = devBypassActive()

  const rawMessage = params.error ? ERROR_MESSAGES[params.error] ?? params.error : ''

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 className="login-title">netinv</h1>
        <p className="login-sub">Pencatatan aset perangkat jaringan</p>

        {rawMessage ? (
          <div className="notice notice-warn" style={{ textAlign: 'left' }}>
            <span aria-hidden="true">⚠</span>
            <div>{rawMessage}</div>
          </div>
        ) : null}

        {configured ? (
          <a className="btn btn-primary" href="/api/auth/login" style={{ width: '100%' }}>
            Masuk dengan Google
          </a>
        ) : (
          <>
            <button type="button" className="btn btn-primary" disabled style={{ width: '100%' }}>
              Masuk dengan Google
            </button>
            <p className="faint" style={{ marginTop: 18 }}>
              Login Google belum dikonfigurasi. Setelah kredensial OAuth dipasang, tombol ini
              berfungsi dan hanya akun yang terdaftar di daftar pengguna yang bisa masuk.
            </p>
          </>
        )}

        <p className="faint" style={{ marginTop: 18 }}>
          Hanya akun yang terdaftar sebagai pengguna aplikasi ini yang bisa masuk. Login Google yang
          berhasil tetapi emailnya belum terdaftar akan ditolak.
        </p>

        {dev ? (
          <div className="notice notice-warn" style={{ marginTop: 18, textAlign: 'left' }}>
            <span aria-hidden="true">⚠</span>
            <div>
              <strong>Mode pengembangan aktif.</strong> Halaman bisa dibuka tanpa login karena
              <code> DEV_AUTH_BYPASS=1</code>. Jangan pernah mengisi variabel itu di Vercel.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
