import AssetTable from '@/components/asset-table'
import { getRepo } from '@/lib/repo'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Asset Customer — netinv' }

export default async function CustomerAssetPage() {
  const user = await requireUser()
  const repo = getRepo()

  const [devices, brands, types, customers, cars, credentials] = await Promise.all([
    repo.listDevices({ category: 'customer' }),
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
          <h1 className="page-title">Asset — Customer</h1>
          <p className="page-sub">
            {devices.length} perangkat milik pelanggan
            {user.role === 'engineer' ? '' : ''}
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
        emptyTitle="Belum ada aset Customer"
        emptyText="Tambahkan perangkat milik pelanggan. Siapkan katalog brand dan jenis perangkat lebih dulu supaya pengisiannya lebih cepat, dan pastikan pelanggan serta CAR-nya sudah terdaftar."
      />
    </>
  )
}
