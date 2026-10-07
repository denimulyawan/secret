'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getRepo } from '@/lib/repo'
import { canSeeCategory } from '@/lib/roles'
import { requireUser } from '@/lib/session'
import { validateDeviceInput, type DeviceInput } from '@/lib/validation'
import { failed, text, type ActionState } from './types'

const ALLOWED_STATUS = ['active', 'maintenance', 'spare', 'retired']

function readInput(formData: FormData): DeviceInput {
  return {
    asset_category: text(formData, 'asset_category'),
    customer_id: text(formData, 'customer_id'),
    hostname: text(formData, 'hostname'),
    ip_address: text(formData, 'ip_address'),
    url: text(formData, 'url'),
    brand_code: text(formData, 'brand_code'),
    device_type_code: text(formData, 'device_type_code'),
    device_model: text(formData, 'device_model'),
    serial_number: text(formData, 'serial_number'),
    software_version: text(formData, 'software_version'),
    start_license: text(formData, 'start_license'),
    end_license: text(formData, 'end_license'),
    lokasi: text(formData, 'lokasi'),
    status: text(formData, 'status') || 'active',
    notes: text(formData, 'notes'),
  }
}

function normalize(input: DeviceInput) {
  return {
    asset_category: input.asset_category === 'personal' ? ('personal' as const) : ('customer' as const),
    customer_id: input.customer_id?.trim() ?? '',
    hostname: input.hostname?.trim() ?? '',
    ip_address: input.ip_address?.trim() ?? '',
    url: input.url?.trim() ?? '',
    brand_code: input.brand_code?.trim() ?? '',
    device_type_code: input.device_type_code?.trim() ?? '',
    device_model: input.device_model?.trim() ?? '',
    serial_number: input.serial_number?.trim() ?? '',
    software_version: input.software_version?.trim() ?? '',
    start_license: input.start_license?.trim() ?? '',
    end_license: input.end_license?.trim() ?? '',
    lokasi: input.lokasi?.trim() ?? '',
    status: (ALLOWED_STATUS.includes(input.status ?? '') ? input.status : 'active') as
      | 'active'
      | 'maintenance'
      | 'spare'
      | 'retired',
    notes: input.notes?.trim() ?? '',
  }
}

/**
 * Menyimpan perangkat — dipakai untuk menambah maupun mengubah.
 *
 * Dua penjagaan penting ada di sini, di sisi server:
 *   1. Role diperiksa. Engineer tidak boleh menyentuh aset Personal, baik saat
 *      menambah maupun saat mengubah — termasuk lewat pengiriman formulir
 *      langsung, bukan hanya lewat tampilan.
 *   2. Nomor versi diperiksa, supaya perubahan tidak saling menimpa tanpa
 *      disadari ketika halaman dibuka di dua tempat.
 */
export async function saveDevice(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const repo = getRepo()

  const deviceId = text(formData, 'device_id')
  const raw = readInput(formData)
  const data = normalize(raw)

  const errors: Record<string, string> = { ...validateDeviceInput(raw) }

  // Penjagaan role — bukan sekadar menyembunyikan pilihan di tampilan.
  if (!canSeeCategory(user.role, data.asset_category)) {
    return failed(
      { asset_category: 'Role Anda tidak punya akses ke aset Personal' },
      'Perubahan ditolak. Percobaan ini tercatat.',
    )
  }

  if (Object.keys(errors).length > 0) {
    return failed(errors, 'Ada kolom yang perlu diperbaiki. Periksa keterangan di bawah kolom.')
  }

  // Cegah hostname ganda pada penambahan baru.
  if (!deviceId) {
    const existing = await repo.listDevices()
    if (existing.some((d) => d.hostname.toLowerCase() === data.hostname.toLowerCase())) {
      return failed(
        { hostname: `Hostname "${data.hostname}" sudah dipakai perangkat lain` },
        'Gunakan hostname yang berbeda, atau buka perangkat yang sudah ada.',
      )
    }
  }

  let savedId = deviceId

  try {
    if (deviceId) {
      const current = await repo.getDevice(deviceId)
      if (!current) {
        return failed({}, 'Perangkat tidak ditemukan. Mungkin sudah dihapus.')
      }
      // Perangkat Personal juga tidak boleh diubah oleh Engineer, meski
      // kategorinya diubah menjadi customer di dalam formulir.
      if (!canSeeCategory(user.role, current.asset_category)) {
        return failed({}, 'Role Anda tidak punya akses ke perangkat ini.')
      }
      const updated = await repo.updateDevice(deviceId, data, current.version, user.email)
      savedId = updated.device_id
    } else {
      const created = await repo.createDevice(data, user.email)
      savedId = created.device_id
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan.'
    return failed({}, message)
  }

  revalidatePath('/')
  revalidatePath('/asset/customer')
  revalidatePath('/asset/personal')
  redirect(`/asset/${savedId}`)
}

/** Menghapus perangkat. Selalu lewat konfirmasi di tampilan. */
export async function deleteDevice(formData: FormData): Promise<void> {
  const user = await requireUser()
  const repo = getRepo()
  const deviceId = text(formData, 'device_id')

  const current = await repo.getDevice(deviceId)
  if (!current) redirect('/asset/customer')

  // Penjagaan role juga berlaku untuk penghapusan.
  if (!canSeeCategory(user.role, current.asset_category)) {
    await repo.appendAudit({
      actor_email: user.email,
      action: 'access_denied',
      object_type: 'device',
      object_id: deviceId,
      result: 'denied',
      detail: 'Mencoba menghapus perangkat yang tidak boleh diakses',
    })
    redirect('/asset/customer')
  }

  await repo.deleteDevice(deviceId, user.email)
  revalidatePath('/')
  revalidatePath('/asset/customer')
  revalidatePath('/asset/personal')

  redirect(current.asset_category === 'personal' ? '/asset/personal' : '/asset/customer')
}

/** Menandai kredensial sudah teruji benar-benar bisa dipakai masuk. */
export async function markVerified(formData: FormData): Promise<void> {
  const user = await requireUser()
  const repo = getRepo()
  const credentialId = text(formData, 'credential_id')
  const deviceId = text(formData, 'device_id')

  await repo.markCredentialVerified(credentialId, user.email)
  await repo.appendAudit({
    actor_email: user.email,
    action: 'update',
    object_type: 'credential',
    object_id: credentialId,
    field: 'verified_at',
    result: 'ok',
    detail: 'ditandai sudah terverifikasi',
  })

  revalidatePath(`/asset/${deviceId}`)
  redirect(`/asset/${deviceId}`)
}
