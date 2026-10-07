import { devBypassActive } from '@/lib/session'

export const metadata = { title: 'Masuk — netinv' }

/**
 * Halaman masuk.
 *
 * Tidak ada kolom username dan password di sini. Masuk memakai akun Google,
 * sehingga tidak ada password aplikasi yang perlu dibuat, dihafal, atau bocor.
 */
export default function LoginPage() {
  const dev = devBypassActive()

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 className="login-title">netinv</h1>
        <p className="login-sub">Pencatatan aset perangkat jaringan</p>

        <button type="button" className="btn btn-primary" disabled style={{ width: '100%' }}>
          Masuk dengan Google
        </button>

        <p className="faint" style={{ marginTop: 18 }}>
          Login Google belum dikonfigurasi. Setelah kredensial OAuth dipasang, tombol ini akan
          berfungsi dan hanya akun yang terdaftar di daftar pengguna yang bisa masuk.
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
