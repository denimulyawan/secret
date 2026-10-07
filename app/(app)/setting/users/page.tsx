import AccessDenied from '@/components/access-denied'
import { getRepo } from '@/lib/repo'
import { ROLE_DESCRIPTION, ROLE_LABEL, canManageUsers } from '@/lib/roles'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Pengguna — netinv' }

export default async function UsersPage() {
  const user = await requireUser()
  const repo = getRepo()

  if (!canManageUsers(user.role)) {
    await repo.appendAudit({
      actor_email: user.email,
      action: 'access_denied',
      object_type: 'menu',
      object_id: 'users',
      result: 'denied',
      detail: 'Mencoba membuka pengelolaan pengguna tanpa hak akses',
    })
    return (
      <AccessDenied
        message="Pengelolaan pengguna hanya bisa dibuka oleh Administrator. Percobaan membuka halaman ini sudah dicatat."
        backHref="/"
        backLabel="Ke Dashboard"
      />
    )
  }

  const users = await repo.listUsers()

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pengguna</h1>
          <p className="page-sub">Siapa yang boleh masuk, dan sebatas apa aksesnya</p>
        </div>
      </div>

      <div className="notice notice-info">
        <span aria-hidden="true">ℹ</span>
        <div>
          <strong>Dua role.</strong> <strong>Administrator</strong> — {ROLE_DESCRIPTION.administrator}.{' '}
          <strong>Engineer</strong> — {ROLE_DESCRIPTION.engineer}. Menyembunyikan menu bukan
          pengamanan: batas aksesnya ditegakkan di server pada setiap permintaan.
        </div>
      </div>

      {users.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon" aria-hidden="true">
              ☺
            </div>
            <p className="empty-title">Belum ada pengguna terdaftar</p>
            <p className="empty-text">
              Akun Administrator pertama dibuat otomatis dari konfigurasi{' '}
              <code>INITIAL_ADMIN_EMAIL</code> saat aplikasi dijalankan. Setelah itu, penambahan
              pengguna dilakukan dari halaman ini.
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Nama</th>
                  <th>Role</th>
                  <th>Keadaan</th>
                  <th>Login terakhir</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email}>
                    <td className="mono">{u.email}</td>
                    <td>{u.full_name || <span className="faint">—</span>}</td>
                    <td>
                      <span className={u.role === 'administrator' ? 'badge badge-ok' : 'badge badge-plain'}>
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="badge badge-ok">aktif</span>
                      ) : (
                        <span className="badge badge-danger">dinonaktifkan</span>
                      )}
                    </td>
                    <td className="dim mono">{u.last_login_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="section-title">Dua pengaman yang berlaku</h2>
        <ul className="dim" style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
          <li>Administrator tidak bisa menghapus akunnya sendiri.</li>
          <li>Administrator tidak bisa menurunkan role dirinya sendiri.</li>
          <li>Pengguna tidak dihapus, melainkan dinonaktifkan — supaya catatan lama tetap bisa ditelusuri.</li>
          <li>Setiap perubahan role dan penonaktifan selalu masuk catatan audit.</li>
        </ul>
      </div>
    </>
  )
}
