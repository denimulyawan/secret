import AccessDenied from '@/components/access-denied'
import { getRepo } from '@/lib/repo'
import { canManageAlert } from '@/lib/roles'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Alert — netinv' }

/** Kunci pengaturan yang akan tersedia. Hanya nama — tidak ada nilai di sini. */
const SETTING_ROWS = [
  { key: 'telegram_bot_token', label: 'Token bot Telegram', secret: true, hint: 'Dari @BotFather. Disimpan terenkripsi.' },
  { key: 'telegram_chat_id', label: 'ID chat / grup tujuan', secret: false, hint: 'Tempat ringkasan dikirim.' },
  { key: 'alert_enabled', label: 'Saklar alert', secret: false, hint: 'Mematikan sementara tanpa menghapus pengaturan.' },
  { key: 'alert_days_before', label: 'Ambang hari', secret: false, hint: 'Daftar, misalnya 90,60,30,7.' },
  { key: 'alert_time', label: 'Jam kirim', secret: false, hint: 'Satu kali sehari.' },
  { key: 'alert_mode', label: 'Bentuk pengiriman', secret: false, hint: 'digest (satu ringkasan harian) atau per_license.' },
]

export default async function AlertPage() {
  const user = await requireUser()
  const repo = getRepo()

  if (!canManageAlert(user.role)) {
    await repo.appendAudit({
      actor_email: user.email,
      action: 'access_denied',
      object_type: 'menu',
      object_id: 'alert',
      result: 'denied',
      detail: 'Mencoba membuka pengaturan alert tanpa hak akses',
    })
    return (
      <AccessDenied
        message="Pengaturan alert hanya bisa dibuka oleh Administrator. Percobaan membuka halaman ini sudah dicatat."
        backHref="/"
        backLabel="Ke Dashboard"
      />
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Alert</h1>
          <p className="page-sub">Pengingat lisensi yang akan berakhir</p>
        </div>
      </div>

      <div className="notice notice-info">
        <span aria-hidden="true">ℹ</span>
        <div>
          Hanya aset <strong>Customer</strong> yang dikirim ke Telegram. Aset Personal tetap
          tercatat, tetapi tidak masuk notifikasi — sehingga nama dan alamat perangkat pribadi
          tidak pernah muncul di percakapan Telegram.
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Pengaturan</h2>
        <p className="dim" style={{ marginTop: 0, fontSize: 14 }}>
          Formulir pengisian belum dipasang. Yang berikut ini adalah pengaturan yang akan tersedia,
          beserta keterangannya.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pengaturan</th>
                <th>Keterangan</th>
                <th>Sifat</th>
              </tr>
            </thead>
            <tbody>
              {SETTING_ROWS.map((row) => (
                <tr key={row.key}>
                  <td>
                    {row.label}
                    <div className="faint mono">{row.key}</div>
                  </td>
                  <td className="dim">{row.hint}</td>
                  <td>
                    {row.secret ? (
                      <span className="badge badge-warn">rahasia</span>
                    ) : (
                      <span className="badge badge-plain">biasa</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Kenapa satu ringkasan harian</h2>
        <p className="dim" style={{ margin: 0, fontSize: 14 }}>
          Dengan 300 perangkat pelanggan dan empat ambang pengingat, pengiriman satu pesan per
          lisensi berarti sekitar <strong>1.200 pesan per tahun</strong> — dan bisa menumpuk
          puluhan dalam satu hari ketika banyak lisensi jatuh tempo bersamaan. Notifikasi yang
          membanjiri akan diabaikan orang, dan justru yang penting yang terlewat.
        </p>
      </div>
    </>
  )
}
