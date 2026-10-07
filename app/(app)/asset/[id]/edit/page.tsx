import Link from 'next/link'
import { notFound } from 'next/navigation'
import DeviceForm from '@/components/device-form'
import { getRepo } from '@/lib/repo'
import { canSeeCategory } from '@/lib/roles'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Ubah perangkat — netinv' }

export default async function EditDevicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const repo = getRepo()
  const { id } = await params

  const device = await repo.getDevice(id)
  if (!device) notFound()

  // Penjagaan role: Engineer tidak boleh membuka formulir aset Personal.
  if (!canSeeCategory(user.role, device.asset_category)) {
    await repo.appendAudit({
      actor_email: user.email,
      action: 'access_denied',
      object_type: 'device',
      object_id: id,
      result: 'denied',
      detail: 'Mencoba membuka formulir ubah perangkat tanpa hak akses',
    })
    notFound()
  }

  const [brands, types, customers] = await Promise.all([
    repo.listBrands(),
    repo.listDeviceTypes(),
    repo.listCustomers(),
  ])

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Ubah perangkat</h1>
          <p className="page-sub mono">{device.hostname}</p>
        </div>
        <Link className="btn" href={`/asset/${device.device_id}`}>
          Kembali
        </Link>
      </div>

      <DeviceForm
        device={device}
        brands={brands}
        types={types}
        customers={customers}
        isAdmin={canSeeCategory(user.role, 'personal')}
        defaultCategory={device.asset_category}
      />
    </>
  )
}
