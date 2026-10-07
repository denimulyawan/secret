import AccessDenied from '@/components/access-denied'
import AlertForm from '@/components/alert-form'
import { getRepo } from '@/lib/repo'
import { canManageAlert } from '@/lib/roles'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Alert — netinv' }

const DEFAULT_DAYS = '90,60,30,7'

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

  const [tokenSetting, chatId, days, time, mode, enabled, alertLog] = await Promise.all([
    repo.getSetting('telegram_bot_token'),
    repo.getSetting('telegram_chat_id'),
    repo.getSetting('alert_days_before'),
    repo.getSetting('alert_time'),
    repo.getSetting('alert_mode'),
    repo.getSetting('alert_enabled'),
    repo.listAlertLog(50),
  ])

  const hasToken = Boolean(tokenSetting?.value_enc)
  const failures = alertLog.filter((row) => row.status === 'failed')

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Alert</h1>
          <p className="page-sub">Pengingat lisensi yang akan berakhir, lewat Telegram</p>
        </div>
      </div>

      <div className="notice notice-info">
        <span aria-hidden="true">ℹ</span>
        <div>
          Hanya aset <strong>Customer</strong> yang dikirim ke Telegram. Aset Personal tetap
          tercatat lengkap, tetapi tidak masuk notifikasi — sehingga nama dan alamat perangkat
          pribadi tidak pernah muncul di percakapan Telegram.
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Pengaturan</h2>
        <AlertForm
          values={{
            chatId: chatId?.value_enc ?? '',
            daysBefore: days?.value_enc || DEFAULT_DAYS,
            time: time?.value_enc || '08:00',
            mode: mode?.value_enc || 'digest',
            enabled: (enabled?.value_enc ?? '').toUpperCase() === 'TRUE',
            hasToken,
          }}
        />
      </div>

      <div className="card">
        <h2 className="section-title">Keadaan sekarang</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <td className="dim" style={{ width: 220 }}>Token bot Telegram</td>
                <td>
                  {hasToken ? (
                    <span className="badge badge-ok">tersimpan &amp; terenkripsi</span>
                  ) : (
                    <span className="badge badge-warn">belum diisi</span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="dim">ID chat tujuan</td>
                <td className="mono">{chatId?.value_enc || <span className="faint">belum diisi</span>}</td>
              </tr>
              <tr>
                <td className="dim">Saklar alert</td>
                <td>
                  {(enabled?.value_enc ?? '').toUpperCase() === 'TRUE' ? (
                    <span className="badge badge-ok">aktif</span>
                  ) : (
                    <span className="badge badge-plain">mati</span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="dim">Alert terkirim tercatat</td>
                <td className="mono">{alertLog.length}</td>
              </tr>
              <tr>
                <td className="dim">Pengiriman gagal</td>
                <td>
                  {failures.length > 0 ? (
                    <span className="badge badge-danger">{failures.length}</span>
                  ) : (
                    <span className="badge badge-ok">tidak ada</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {failures.length > 0 ? (
        <div className="card">
          <h2 className="section-title">Pengiriman yang gagal</h2>
          <p className="dim" style={{ fontSize: 14, marginTop: 0 }}>
            Pengiriman yang gagal <strong>tidak</strong> dianggap sudah terkirim — akan dicoba lagi
            pada pemeriksaan berikutnya. Ditampilkan di sini supaya tidak hilang diam-diam.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Perangkat</th>
                  <th>Ambang</th>
                  <th>Penyebab</th>
                </tr>
              </thead>
              <tbody>
                {failures.slice(0, 15).map((row, index) => (
                  <tr key={`${row.ts}-${index}`}>
                    <td className="mono nowrap">{row.ts}</td>
                    <td className="mono">{row.device_id}</td>
                    <td className="dim">{row.threshold_days} hari</td>
                    <td className="dim">{row.error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2 className="section-title">Kenapa ringkasan harian lebih disarankan</h2>
        <p className="dim" style={{ margin: 0, fontSize: 14 }}>
          Dengan 300 perangkat pelanggan dan empat ambang pengingat, satu pesan per lisensi berarti
          sekitar <strong>1.200 pesan per tahun</strong> — dan bisa menumpuk puluhan dalam satu hari
          ketika banyak lisensi jatuh tempo bersamaan. Notifikasi yang membanjiri akan diabaikan
          orang, dan justru yang penting yang terlewat. Ringkasan harian mengirim{' '}
          <strong>paling banyak satu pesan per hari</strong>, dan tidak mengirim apa pun kalau tidak
          ada lisensi yang masuk ambang.
        </p>
      </div>
    </>
  )
}
