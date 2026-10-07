import { getRepo } from '@/lib/repo'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Audit Log — netinv' }

const RESULT_BADGE: Record<string, string> = {
  ok: 'badge-ok',
  denied: 'badge-danger',
  error: 'badge-warn',
}

const ACTION_LABEL: Record<string, string> = {
  create: 'tambah',
  update: 'ubah',
  delete: 'hapus',
  reveal_secret: 'buka password',
  access_denied: 'akses ditolak',
  login_failed: 'login gagal',
  schema_error: 'galat skema',
}

export default async function AuditPage() {
  await requireUser()
  const repo = getRepo()
  const rows = await repo.listAudit(200)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-sub">
            Catatan aktivitas — hanya ditambah, tidak pernah diubah atau dihapus
          </p>
        </div>
      </div>

      <div className="notice notice-info">
        <span aria-hidden="true">ℹ</span>
        <div>
          Isi password <strong>tidak pernah</strong> dicatat di sini. Yang dicatat hanya bahwa
          sebuah kredensial dibuka atau diubah — supaya catatan ini sendiri tidak menjadi tempat
          kebocoran baru.
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon" aria-hidden="true">
              ◷
            </div>
            <p className="empty-title">Belum ada aktivitas tercatat</p>
            <p className="empty-text">
              Setiap penambahan, perubahan, pembukaan password, dan percobaan akses yang ditolak
              akan muncul di sini.
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pelaku</th>
                  <th>Tindakan</th>
                  <th>Objek</th>
                  <th>Hasil</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.ts}-${index}`}>
                    <td className="mono nowrap">{row.ts}</td>
                    <td className="mono">{row.actor_email || '—'}</td>
                    <td>{ACTION_LABEL[row.action] ?? row.action}</td>
                    <td className="dim">
                      {row.object_type}
                      {row.object_id ? <span className="mono"> · {row.object_id}</span> : null}
                    </td>
                    <td>
                      <span className={`badge ${RESULT_BADGE[row.result] ?? 'badge-plain'}`}>
                        {row.result}
                      </span>
                    </td>
                    <td className="dim">{row.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
