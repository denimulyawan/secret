'use server'

import { revalidatePath } from 'next/cache'
import { getRepo } from '@/lib/repo'
import { requireUser } from '@/lib/session'
import { normalizeCode } from '@/lib/validation'
import { checked, failed, succeeded, text, type ActionState } from './types'

/**
 * Menambah brand ke katalog.
 *
 * Katalog adalah DATA, bukan pengaturan di dalam kode — jadi pemilik bisa
 * menambah brand baru kapan saja tanpa perlu ada yang mengubah program.
 */
export async function saveBrand(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const repo = getRepo()

  const rawCode = text(formData, 'brand_code')
  const name = text(formData, 'brand_name')
  const code = normalizeCode(rawCode)

  const errors: Record<string, string> = {}
  if (!code) errors.brand_code = 'Kode brand wajib diisi'
  if (!name) errors.brand_name = 'Nama brand wajib diisi'
  if (Object.keys(errors).length > 0) return failed(errors)

  const existing = await repo.listBrands()
  if (existing.some((b) => b.brand_code === code)) {
    return failed(
      { brand_code: `Brand dengan kode "${code}" sudah ada di katalog` },
      'Brand itu sudah terdaftar. Kalau ingin mengubah namanya, ubah dari daftar di bawah.',
    )
  }

  await repo.putBrand({
    brand_code: code,
    brand_name: name,
    is_active: true,
    sort_order: Number(text(formData, 'sort_order')) || 100,
  })
  await repo.appendAudit({
    actor_email: user.email,
    action: 'create',
    object_type: 'brand',
    object_id: code,
    result: 'ok',
  })

  revalidatePath('/setting/catalog')
  return succeeded(`Brand "${name}" ditambahkan ke katalog.`)
}

/**
 * Mengaktifkan atau menonaktifkan brand.
 *
 * Menonaktifkan dipilih daripada menghapus: menghapus brand yang sudah dipakai
 * membuat data perangkat lama kehilangan brandnya.
 */
export async function toggleBrand(formData: FormData): Promise<void> {
  const user = await requireUser()
  const repo = getRepo()
  const code = text(formData, 'brand_code')
  const activate = checked(formData, 'activate')

  const brands = await repo.listBrands()
  const current = brands.find((b) => b.brand_code === code)
  if (!current) return

  await repo.putBrand({ ...current, is_active: activate })
  await repo.appendAudit({
    actor_email: user.email,
    action: 'update',
    object_type: 'brand',
    object_id: code,
    field: 'is_active',
    result: 'ok',
    detail: activate ? 'diaktifkan' : 'dinonaktifkan',
  })
  revalidatePath('/setting/catalog')
}

export async function saveDeviceType(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const repo = getRepo()

  const code = normalizeCode(text(formData, 'type_code'))
  const name = text(formData, 'type_name')

  const errors: Record<string, string> = {}
  if (!code) errors.type_code = 'Kode jenis wajib diisi'
  if (!name) errors.type_name = 'Nama jenis wajib diisi'
  if (Object.keys(errors).length > 0) return failed(errors)

  const existing = await repo.listDeviceTypes()
  if (existing.some((t) => t.type_code === code)) {
    return failed(
      { type_code: `Jenis dengan kode "${code}" sudah ada` },
      'Jenis perangkat itu sudah terdaftar.',
    )
  }

  await repo.putDeviceType({
    type_code: code,
    type_name: name,
    is_active: true,
    sort_order: Number(text(formData, 'sort_order')) || 100,
  })
  await repo.appendAudit({
    actor_email: user.email,
    action: 'create',
    object_type: 'device_type',
    object_id: code,
    result: 'ok',
  })

  revalidatePath('/setting/catalog')
  return succeeded(`Jenis perangkat "${name}" ditambahkan.`)
}

export async function toggleDeviceType(formData: FormData): Promise<void> {
  const user = await requireUser()
  const repo = getRepo()
  const code = text(formData, 'type_code')
  const activate = checked(formData, 'activate')

  const types = await repo.listDeviceTypes()
  const current = types.find((t) => t.type_code === code)
  if (!current) return

  await repo.putDeviceType({ ...current, is_active: activate })
  await repo.appendAudit({
    actor_email: user.email,
    action: 'update',
    object_type: 'device_type',
    object_id: code,
    field: 'is_active',
    result: 'ok',
    detail: activate ? 'diaktifkan' : 'dinonaktifkan',
  })
  revalidatePath('/setting/catalog')
}
