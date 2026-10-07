import Link from 'next/link'
import DeviceForm from '@/components/device-form'
import { getRepo } from '@/lib/repo'
import { canSeeCategory } from '@/lib/roles'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Tambah perangkat — netinv' }

export default async function NewDevicePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const user = await requireUser()
  const repo = getRepo()
  const params = await searchParams

  const isAdmin = canSeeCategory(user.role, 'personal')
  const requested = params.category === 'personal' && isAdmin ? 'personal' : 'customer'

  // Engineer tidak boleh membuka formulir aset Personal, sekalipun alamatnya
  // diketik langsung dengan ?category=personal
  if (params.category === 'personal' && !isAdmin) {
    await repo.appendAudit({
      actor_email: user.email,
      action: 'access_denied',
      object_type: 'asset_category',
      object_id: 'personal',
      result: 'denied',
      detail: 'Mencoba membuka formulir aset Personal tanpa hak akses',
    })
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
          <h1 className="page-title">Tambah perangkat</h1>
          <p className="page-sub">
            Isi data perangkat. Kolom bertanda <strong>wajib</strong> harus terisi sebelum bisa
            disimpan.
          </p>
        </div>
        <Link className="btn" href="/asset/customer">
          Kembali
        </Link>
      </div>

      <DeviceForm
        brands={brands}
        types={types}
        customers={customers}
        isAdmin={isAdmin}
        defaultCategory={requested}
      />
    </>
  )
}
