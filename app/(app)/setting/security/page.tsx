import AccessDenied from '@/components/access-denied'
import TotpSetup from '@/components/totp-setup'
import { disableTotp } from '@/lib/actions/security'
import { getRepo } from '@/lib/repo'
import { canManageUsers } from '@/lib/roles'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Keamanan — netinv' }

export default async function SecurityPage() {
  const user = await requireUser()
  const repo = getRepo()

  if (!canManageUsers(user.role)) {
    await repo.appendAudit({
      actor_email: user.email,
      action: 'access_denied',
      object_type: 'menu',
      object_id: 'security',
      result: 'denied',
      detail: 'Mencoba membuka pengaturan keamanan tanpa hak akses',
    })
    return (
      <AccessDenied
        message="Pengaturan keamanan hanya bisa dibuka oleh Administrator. Percobaan membuka halaman ini sudah dicatat."
        backHref="/"
        backLabel="Ke Dashboard"
      />
    )
  }

  const totp = await repo.getSetting('totp_secret')
  const active = Boolean(totp?.value_enc)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Keamanan</h1>
          <p className="page-sub">Verifikasi dua langkah untuk membuka password</p>
        </div>
      </div>

      <div className="notice notice-info">
        <span aria-hidden="true">ℹ</span>
        <div>
          <strong>Kenapa perlu dua lapis.</strong> Login Google melindungi dari orang yang tidak
          punya akses ke akun Anda. Kode 6 digit melindungi dari orang yang <em>sudah berada di
          dalam</em> sesi Anda — laptop yang tidak dikunci, misalnya. Keduanya menutup celah yang
          berbeda.
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Verifikasi dua langkah</h2>
        <TotpSetup active={active} />
      </div>

      {active ? (
        <div className="card">
          <h2 className="section-title">Matikan verifikasi dua langkah</h2>
          <p className="dim" style={{ fontSize: 14, marginTop: 0 }}>
            Setelah dimatikan, siapa pun yang berhasil masuk ke sesi Anda bisa langsung membuka
            seluruh password perangkat tanpa kode tambahan.
          </p>
          <form action={disableTotp}>
            <button className="btn btn-danger" type="submit">
              Matikan
            </button>
          </form>
        </div>
      ) : null}

      <div className="card">
        <h2 className="section-title">Catatan penting</h2>
        <p className="dim" style={{ fontSize: 14, margin: 0 }}>
          Kalau ponsel Anda hilang, password tidak bisa dibuka sampai kunci verifikasi dipasang
          ulang. Karena itu <strong>kode pemulihan akun Google</strong> Anda harus tersimpan di
          tempat aman — itulah jalan masuk terakhir Anda.
        </p>
      </div>
    </>
  )
}
