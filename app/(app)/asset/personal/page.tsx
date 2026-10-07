import AccessDenied from '@/components/access-denied'
import AssetTable from '@/components/asset-table'
import { getRepo } from '@/lib/repo'
import { canSeeCategory } from '@/lib/roles'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Asset Personal — netinv' }

export default async function PersonalAssetPage() {
  const user = await requireUser()
  const repo = getRepo()

  // Penjagaan dilakukan di server, bukan hanya dengan menyembunyikan menu.
  // Kalau hanya menunya yang disembunyikan, orang yang tahu alamatnya bisa
  // membuka langsung lewat URL ini.
  if (!canSeeCategory(user.role, 'personal')) {
    await repo.appendAudit({
      actor_email: user.email,
      action: 'access_denied',
      object_type: 'asset_category',
      object_id: 'personal',
      result: 'denied',
      detail: 'Mencoba membuka daftar aset Personal tanpa hak akses',
    })

    return (
      <AccessDenied
        message="Aset Personal hanya bisa dilihat oleh Administrator. Percobaan membuka halaman ini sudah dicatat."
        backHref="/asset/customer"
        backLabel="Ke Asset Customer"
      />
    )
  }

  const [devices, brands, types, customers, cars, credentials] = await Promise.all([
    repo.listDevices({ category: 'personal' }),
    repo.listBrands(),
    repo.listDeviceTypes(),
    repo.listCustomers(),
    repo.listCars(),
    repo.listCredentials(),
  ])

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Asset — Personal</h1>
          <p className="page-sub">
            {devices.length} perangkat milik sendiri · hanya terlihat oleh Administrator
          </p>
        </div>
      </div>

      <AssetTable
        devices={devices}
        brands={brands}
        types={types}
        customers={customers}
        cars={cars}
        credentials={credentials}
        emptyTitle="Belum ada aset Personal"
        emptyText="Perangkat milik sendiri dicatat di sini. Halaman ini tidak terlihat oleh role Engineer — dan penjagaannya dilakukan di server, bukan hanya disembunyikan dari menu."
      />
    </>
  )
}
