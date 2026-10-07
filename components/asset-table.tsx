import Link from 'next/link'
import type { Brand, Car, CredentialMeta, Customer, Device, DeviceType } from '@/lib/repo/types'

const STATUS_LABEL: Record<string, string> = {
  active: 'aktif',
  maintenance: 'perawatan',
  spare: 'cadangan',
  retired: 'disimpan',
}

function LicenseCell({ end }: { end: string }) {
  if (!end) return <span className="faint">—</span>
  const target = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(target)) return <span className="mono">{end}</span>
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  const days = Math.round((target - today) / 86_400_000)
  return (
    <span className="nowrap">
      <span className="mono">{end}</span>{' '}
      {days < 0 ? (
        <span className="badge badge-danger">lewat</span>
      ) : days <= 30 ? (
        <span className="badge badge-warn">{days} hr</span>
      ) : null}
    </span>
  )
}

export default function AssetTable({
  devices,
  brands,
  types,
  customers,
  cars,
  credentials,
  emptyTitle,
  emptyText,
}: {
  devices: Device[]
  brands: Brand[]
  types: DeviceType[]
  customers: Customer[]
  cars: Car[]
  credentials: CredentialMeta[]
  emptyTitle: string
  emptyText: string
}) {
  if (devices.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <div className="empty-icon" aria-hidden="true">
            ◇
          </div>
          <p className="empty-title">{emptyTitle}</p>
          <p className="empty-text">{emptyText}</p>
        </div>
      </div>
    )
  }

  const brandName = new Map(brands.map((b) => [b.brand_code, b.brand_name]))
  const typeName = new Map(types.map((t) => [t.type_code, t.type_name]))
  const customerById = new Map(customers.map((c) => [c.customer_id, c]))
  const carById = new Map(cars.map((c) => [c.car_id, c]))

  const credCount = new Map<string, number>()
  const credVerified = new Set<string>()
  for (const cred of credentials) {
    credCount.set(cred.device_id, (credCount.get(cred.device_id) ?? 0) + 1)
    if (cred.verified_at) credVerified.add(cred.device_id)
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Hostname</th>
              <th>Alamat</th>
              <th>Brand / Model</th>
              <th>Jenis</th>
              <th>Pelanggan</th>
              <th>CAR</th>
              <th>Lokasi</th>
              <th>Lisensi berakhir</th>
              <th>Status</th>
              <th>Kredensial</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => {
              const customer = d.customer_id ? customerById.get(d.customer_id) : undefined
              const car = customer?.car_id ? carById.get(customer.car_id) : undefined
              const count = credCount.get(d.device_id) ?? 0
              const verified = credVerified.has(d.device_id)
              return (
                <tr key={d.device_id}>
                  <td className="mono">
                    <Link href={`/asset/${d.device_id}`}>{d.hostname}</Link>
                  </td>
                  <td className="mono">{d.ip_address}</td>
                  <td>
                    {brandName.get(d.brand_code) ?? d.brand_code}
                    {d.device_model ? <span className="faint"> · {d.device_model}</span> : null}
                  </td>
                  <td className="dim">
                    {d.device_type_code ? typeName.get(d.device_type_code) ?? d.device_type_code : '—'}
                  </td>
                  <td>{customer?.customer_name ?? <span className="faint">—</span>}</td>
                  <td>{car?.car_name ?? <span className="faint">—</span>}</td>
                  <td className="dim">{d.lokasi || '—'}</td>
                  <td>
                    <LicenseCell end={d.end_license} />
                  </td>
                  <td>
                    <span className="badge badge-plain">{STATUS_LABEL[d.status] ?? d.status}</span>
                  </td>
                  <td className="nowrap">
                    {count === 0 ? (
                      <span className="badge badge-warn">belum ada</span>
                    ) : verified ? (
                      <span className="badge badge-ok">{count} ✓</span>
                    ) : (
                      <span className="badge badge-warn">{count} belum diuji</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
