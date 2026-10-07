import Link from 'next/link'
import { getRepo, isPersistent } from '@/lib/repo'
import type { Device } from '@/lib/repo/types'
import { ROLE_LABEL, visibleCategories } from '@/lib/roles'
import { requireUser } from '@/lib/session'

/** Sisa hari sampai tanggal berakhir lisensi. Negatif berarti sudah lewat. */
function daysUntil(dateIso: string): number | null {
  if (!dateIso) return null
  const target = Date.parse(`${dateIso}T00:00:00Z`)
  if (Number.isNaN(target)) return null
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((target - today) / 86_400_000)
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  )
}

export default async function DashboardPage() {
  const user = await requireUser()
  const repo = getRepo()

  const categories = visibleCategories(user.role)
  const all = await repo.listDevices()
  const devices = all.filter((d) => categories.includes(d.asset_category))
  const credentials = await repo.listCredentials()
  const customers = await repo.listCustomers()

  const deviceIds = new Set(devices.map((d) => d.device_id))
  const creds = credentials.filter((c) => deviceIds.has(c.device_id))
  const withCred = new Set(creds.filter((c) => c.verified_at).map((c) => c.device_id))

  const personal = devices.filter((d) => d.asset_category === 'personal')
  const customer = devices.filter((d) => d.asset_category === 'customer')

  const soon = devices
    .map((d: Device) => ({ device: d, days: daysUntil(d.end_license) }))
    .filter((row): row is { device: Device; days: number } => row.days !== null && row.days <= 90)
    .sort((a, b) => a.days - b.days)

  const overdue = soon.filter((row) => row.days < 0)
  const verifiedCount = devices.filter((d) => withCred.has(d.device_id)).length
  const withoutCred = devices.length - creds.length

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            Masuk sebagai {ROLE_LABEL[user.role]}
            {user.role === 'engineer' ? ' — aset Personal tidak ditampilkan' : ''}
          </p>
        </div>
      </div>

      {!isPersistent() ? (
        <div className="notice notice-warn">
          <span aria-hidden="true">⚠</span>
          <div>
            <strong>Penyimpanan belum dikonfigurasi.</strong> Aplikasi berjalan tanpa penyimpanan
            tetap: isi yang Anda masukkan hanya bertahan selama aplikasi berjalan, dan hilang saat
            dihentikan. Isi konfigurasi di berkas <code>.env.local</code> untuk mulai menyimpan.
          </div>
        </div>
      ) : null}

      {devices.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon" aria-hidden="true">
              ▤
            </div>
            <p className="empty-title">Belum ada perangkat tercatat</p>
            <p className="empty-text">
              Aplikasi ini mulai dari kosong — tidak ada data bawaan apa pun. Tambahkan perangkat
              pertama Anda, atau siapkan katalog brand dan jenis perangkat lebih dulu supaya
              pengisian berikutnya lebih cepat.
            </p>
            <div className="actions" style={{ justifyContent: 'center' }}>
              <Link className="btn btn-primary" href="/setting/catalog">
                Siapkan katalog
              </Link>
              <Link className="btn" href="/setting/customers">
                Tambah pelanggan &amp; CAR
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid">
            <Stat label="Total perangkat" value={devices.length} />
            <Stat
              label="Personal"
              value={personal.length}
              hint={user.role === 'engineer' ? 'tidak dihitung untuk role Anda' : undefined}
            />
            <Stat label="Customer" value={customer.length} />
            <Stat
              label="Kredensial terverifikasi"
              value={`${verifiedCount} / ${devices.length}`}
              hint="sudah diuji benar-benar bisa dipakai"
            />
            <Stat
              label="Belum ada kredensial"
              value={withoutCred}
              hint="perangkat tanpa kredensial tercatat"
            />
            <Stat
              label="Lisensi jatuh tempo ≤ 90 hari"
              value={soon.length - overdue.length}
              hint={overdue.length > 0 ? `${overdue.length} sudah lewat` : undefined}
            />
            <Stat label="Pelanggan" value={customers.length} />
          </div>

          {soon.length > 0 ? (
            <div className="card">
              <h2 className="section-title">Lisensi yang perlu perhatian</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Hostname</th>
                      <th>Berakhir</th>
                      <th>Sisa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soon.slice(0, 10).map(({ device, days }) => (
                      <tr key={device.device_id}>
                        <td className="mono">{device.hostname}</td>
                        <td className="mono">{device.end_license}</td>
                        <td>
                          {days < 0 ? (
                            <span className="badge badge-danger">lewat {Math.abs(days)} hari</span>
                          ) : (
                            <span className="badge badge-warn">{days} hari</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}
