import Link from 'next/link'
import { notFound } from 'next/navigation'
import CredentialPanel from '@/components/credential-panel'
import { deleteDevice } from '@/lib/actions/devices'
import { getRepo } from '@/lib/repo'
import { canSeeCategory } from '@/lib/roles'
import { requireUser } from '@/lib/session'

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  maintenance: 'Perawatan',
  spare: 'Cadangan',
  retired: 'Disimpan',
}

function LicenseInfo({ start, end }: { start: string; end: string }) {
  if (!start && !end) {
    return <span className="faint">Belum dicatat</span>
  }
  const days = end
    ? Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000)
    : null

  return (
    <span>
      <span className="mono">{start || '—'}</span>
      <span className="faint"> sampai </span>
      <span className="mono">{end || '—'}</span>
      {days !== null && !Number.isNaN(days) ? (
        <>
          {' '}
          {days < 0 ? (
            <span className="badge badge-danger">sudah lewat {Math.abs(days)} hari</span>
          ) : days <= 30 ? (
            <span className="badge badge-warn">{days} hari lagi</span>
          ) : (
            <span className="badge badge-plain">{days} hari lagi</span>
          )}
        </>
      ) : null}
    </span>
  )
}

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const repo = getRepo()
  const { id } = await params

  const device = await repo.getDevice(id)
  if (!device) notFound()

  // Penjagaan role: Engineer tidak boleh melihat aset Personal, sekalipun
  // alamatnya diketik langsung.
  if (!canSeeCategory(user.role, device.asset_category)) {
    await repo.appendAudit({
      actor_email: user.email,
      action: 'access_denied',
      object_type: 'device',
      object_id: id,
      result: 'denied',
      detail: 'Mencoba membuka perangkat tanpa hak akses',
    })
    notFound()
  }

  const [credentials, customers, cars, brands, types, totpSetting, audit] = await Promise.all([
    repo.listCredentials(device.device_id),
    repo.listCustomers(),
    repo.listCars(),
    repo.listBrands(),
    repo.listDeviceTypes(),
    repo.getSetting('totp_secret'),
    repo.listAudit(400),
  ])

  const customer = customers.find((c) => c.customer_id === device.customer_id)
  const car = customer?.car_id ? cars.find((c) => c.car_id === customer.car_id) : undefined
  const brand = brands.find((b) => b.brand_code === device.brand_code)
  const type = types.find((t) => t.type_code === device.device_type_code)

  const stepUpReady = Boolean(totpSetting?.value_enc)
  const canReveal = canSeeCategory(user.role, device.asset_category)

  const deviceAudit = audit
    .filter((row) => row.object_id === device.device_id || credentials.some((c) => c.credential_id === row.object_id))
    .slice(0, 20)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title mono">{device.hostname}</h1>
          <p className="page-sub">
            {brand?.brand_name ?? device.brand_code}
            {device.device_model ? ` · ${device.device_model}` : ''}
            {type ? ` · ${type.type_name}` : ''}
            {' · '}
            <span className="badge badge-plain">{STATUS_LABEL[device.status] ?? device.status}</span>
            {' '}
            <span className="badge badge-plain">
              {device.asset_category === 'personal' ? 'Personal' : 'Customer'}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href={`/asset/${device.device_id}/edit`}>
            Ubah
          </Link>
          <Link className="btn" href={device.asset_category === 'personal' ? '/asset/personal' : '/asset/customer'}>
            Kembali
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Data perangkat</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <td className="dim" style={{ width: 190 }}>Alamat IP</td>
                <td className="mono">{device.ip_address || '—'}</td>
              </tr>
              {device.url ? (
                <tr>
                  <td className="dim">URL</td>
                  <td className="mono">{device.url}</td>
                </tr>
              ) : null}
              <tr>
                <td className="dim">Pelanggan</td>
                <td>{customer?.customer_name ?? <span className="faint">—</span>}</td>
              </tr>
              <tr>
                <td className="dim">CAR</td>
                <td>
                  {car ? (
                    <>
                      {car.car_name} <span className="faint mono">{car.car_phone}</span>
                    </>
                  ) : (
                    <span className="faint">—</span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="dim">Lokasi</td>
                <td>{device.lokasi || <span className="faint">—</span>}</td>
              </tr>
              <tr>
                <td className="dim">Nomor seri</td>
                <td className="mono">{device.serial_number || '—'}</td>
              </tr>
              <tr>
                <td className="dim">Versi perangkat lunak</td>
                <td className="mono">{device.software_version || '—'}</td>
              </tr>
              <tr>
                <td className="dim">Masa lisensi</td>
                <td>
                  <LicenseInfo start={device.start_license} end={device.end_license} />
                </td>
              </tr>
              <tr>
                <td className="dim">Catatan</td>
                <td>{device.notes || <span className="faint">—</span>}</td>
              </tr>
              <tr>
                <td className="dim">Terakhir diubah</td>
                <td className="dim mono">
                  {device.updated_at || '—'} {device.updated_by ? `· ${device.updated_by}` : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CredentialPanel
        deviceId={device.device_id}
        credentials={credentials}
        canReveal={canReveal}
        stepUpReady={stepUpReady}
      />

      {deviceAudit.length > 0 ? (
        <div className="card">
          <h2 className="section-title">Riwayat perangkat ini</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pelaku</th>
                  <th>Tindakan</th>
                  <th>Hasil</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {deviceAudit.map((row, index) => (
                  <tr key={`${row.ts}-${index}`}>
                    <td className="mono nowrap">{row.ts}</td>
                    <td className="mono">{row.actor_email || '—'}</td>
                    <td>{row.action}</td>
                    <td>
                      <span
                        className={
                          row.result === 'ok'
                            ? 'badge badge-ok'
                            : row.result === 'denied'
                              ? 'badge badge-danger'
                              : 'badge badge-warn'
                        }
                      >
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
      ) : null}

      <div className="card">
        <h2 className="section-title">Hapus perangkat</h2>
        <p className="dim" style={{ fontSize: 14, marginTop: 0 }}>
          Menghapus perangkat juga menghapus kredensialnya. Tindakan ini tidak bisa dibatalkan.
          Kalau perangkatnya masih ada tetapi tidak dipakai lagi, lebih baik ubah keadaannya
          menjadi <strong>Disimpan</strong>.
        </p>
        <form action={deleteDevice}>
          <input type="hidden" name="device_id" value={device.device_id} />
          <button className="btn btn-danger" type="submit">
            Hapus perangkat ini
          </button>
        </form>
      </div>
    </>
  )
}
