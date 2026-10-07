import AccessDenied from '@/components/access-denied'
import UserForm from '@/components/user-form'
import { changeUserRole, toggleUserActive } from '@/lib/actions/users'
import { getRepo } from '@/lib/repo'
import { ROLE_DESCRIPTION, ROLE_LABEL, canManageUsers } from '@/lib/roles'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Pengguna — netinv' }

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ pesan?: string }>
}) {
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

  const params = await searchParams
  const users = await repo.listUsers()

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pengguna</h1>
          <p className="page-sub">Siapa yang boleh masuk, dan sebatas apa aksesnya</p>
        </div>
      </div>

      {params.pesan ? (
        <div className="notice notice-info">
          <span aria-hidden="true">ℹ</span>
          <div>{params.pesan}</div>
        </div>
      ) : null}

      <div className="notice notice-info">
        <span aria-hidden="true">ℹ</span>
        <div>
          <strong>Dua role.</strong> <strong>Administrator</strong> — {ROLE_DESCRIPTION.administrator}.{' '}
          <strong>Engineer</strong> — {ROLE_DESCRIPTION.engineer}. Menyembunyikan menu bukan
          pengamanan: batas aksesnya ditegakkan di server pada setiap permintaan, termasuk saat
          alamatnya diketik langsung.
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Tambah pengguna</h2>
        <UserForm />
      </div>

      <div className="card">
        <h2 className="section-title">Pengguna terdaftar ({users.length})</h2>
        {users.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 14 }}>
            Belum ada pengguna terdaftar. Akun Administrator pertama dibuat otomatis dari
            konfigurasi <code>INITIAL_ADMIN_EMAIL</code> saat akun itu pertama kali masuk.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Nama</th>
                  <th>Role</th>
                  <th>Keadaan</th>
                  <th>Login terakhir</th>
                  <th className="right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => {
                  const isSelf = row.email.toLowerCase() === user.email.toLowerCase()
                  return (
                    <tr key={row.email}>
                      <td className="mono">
                        {row.email}
                        {isSelf ? <span className="badge badge-plain" style={{ marginLeft: 8 }}>Anda</span> : null}
                      </td>
                      <td>{row.full_name || <span className="faint">—</span>}</td>
                      <td>
                        <form action={changeUserRole} style={{ display: 'flex', gap: 8 }}>
                          <input type="hidden" name="email" value={row.email} />
                          <select
                            name="role"
                            defaultValue={row.role}
                            aria-label="Role"
                            disabled={isSelf}
                          >
                            <option value="engineer">{ROLE_LABEL.engineer}</option>
                            <option value="administrator">{ROLE_LABEL.administrator}</option>
                          </select>
                          <button className="btn" type="submit" disabled={isSelf}>
                            Simpan
                          </button>
                        </form>
                      </td>
                      <td>
                        {row.is_active ? (
                          <span className="badge badge-ok">aktif</span>
                        ) : (
                          <span className="badge badge-danger">dinonaktifkan</span>
                        )}
                      </td>
                      <td className="dim mono">{row.last_login_at || '—'}</td>
                      <td className="right">
                        <form action={toggleUserActive}>
                          <input type="hidden" name="email" value={row.email} />
                          <button
                            className={row.is_active ? 'btn btn-danger' : 'btn'}
                            type="submit"
                            disabled={isSelf}
                          >
                            {row.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Tiga pengaman yang berlaku</h2>
        <ul className="dim" style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
          <li>Administrator <strong>tidak bisa mengubah role dirinya sendiri</strong> — mencegah terkunci dari aplikasi sendiri karena salah klik.</li>
          <li>Administrator <strong>tidak bisa menonaktifkan akunnya sendiri</strong> — alasan yang sama.</li>
          <li>Pengguna <strong>tidak dihapus, melainkan dinonaktifkan</strong> — supaya catatan audit lama yang menyebut emailnya tetap bisa ditelusuri.</li>
        </ul>
        <p className="dim" style={{ fontSize: 14, marginBottom: 0 }}>
          Setiap perubahan role dan penonaktifan tercatat di <strong>Audit Log</strong>. Sesi orang
          yang dinonaktifkan langsung berhenti berlaku pada permintaan berikutnya — tidak perlu
          menunggu sesinya habis.
        </p>
      </div>
    </>
  )
}
