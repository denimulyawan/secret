import { getRepo, isPersistent } from '@/lib/repo'
import { devBypassActive, requireUser } from '@/lib/session'

export const metadata = { title: 'Sistem — netinv' }

/** Menampilkan ada/tidaknya sebuah rahasia — TANPA pernah menampilkan isinya. */
function Presence({ label, present, hint }: { label: string; present: boolean; hint: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td>
        {present ? (
          <span className="badge badge-ok">terpasang</span>
        ) : (
          <span className="badge badge-warn">belum</span>
        )}
      </td>
      <td className="dim">{hint}</td>
    </tr>
  )
}

export default async function SystemPage() {
  const user = await requireUser()
  const repo = getRepo()
  const auditCount = (await repo.listAudit(1000)).length

  const hasSheetId = Boolean(process.env.SHEET_ID?.trim())
  const hasServiceAccount = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim())
  const hasPrivateKey = Boolean(process.env.GOOGLE_PRIVATE_KEY_BASE64?.trim())
  const hasMasterKey = Boolean(process.env.APP_MASTER_KEY?.trim())

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Sistem</h1>
          <p className="page-sub">Keadaan konfigurasi dan penyimpanan</p>
        </div>
      </div>

      <div className={isPersistent() ? 'notice notice-info' : 'notice notice-warn'}>
        <span aria-hidden="true">{isPersistent() ? 'ℹ' : '⚠'}</span>
        <div>
          <strong>Penyimpanan: {isPersistent() ? 'spreadsheet' : 'sementara'}.</strong>{' '}
          {isPersistent()
            ? 'Data disimpan di luar repo, pada penyimpanan yang Anda konfigurasi.'
            : 'Belum dikonfigurasi — isi yang dimasukkan hanya bertahan selama aplikasi berjalan, dan tidak disimpan ke mana pun.'}
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Konfigurasi</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bagian</th>
                <th>Keadaan</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <Presence
                label="ID spreadsheet"
                present={hasSheetId}
                hint="Tempat data aset disimpan."
              />
              <Presence
                label="Akun layanan Google"
                present={hasServiceAccount}
                hint="Akun yang diberi izin membaca dan menulis spreadsheet."
              />
              <Presence
                label="Kunci akun layanan"
                present={hasPrivateKey}
                hint="Disimpan dalam bentuk base64 agar baris barunya tidak rusak."
              />
              <Presence
                label="Kunci enkripsi kredensial"
                present={hasMasterKey}
                hint="Pembuka password. Tanpa kunci ini, kredensial tidak bisa disimpan maupun dibuka."
              />
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Rincian</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <td>Masuk sebagai</td>
                <td className="mono">{user.email}</td>
              </tr>
              <tr>
                <td>Role</td>
                <td className="mono">{user.role}</td>
              </tr>
              <tr>
                <td>Baris audit tercatat</td>
                <td className="mono">{auditCount}</td>
              </tr>
              <tr>
                <td>Mode pengembangan</td>
                <td>
                  {devBypassActive() ? (
                    <span className="badge badge-danger">AKTIF — jangan dipakai di Vercel</span>
                  ) : (
                    <span className="badge badge-ok">mati</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Pengingat penting</h2>
        <p className="dim" style={{ margin: 0, fontSize: 14 }}>
          Kunci enkripsi tidak bisa dipulihkan. Kalau kunci itu hilang, seluruh password yang
          tersimpan menjadi tidak bisa dibuka selamanya dan harus dicatat ulang satu per satu dari
          perangkatnya. Simpan di dua tempat aman.
        </p>
      </div>
    </>
  )
}
