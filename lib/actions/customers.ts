'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getRepo } from '@/lib/repo'
import { requireUser } from '@/lib/session'
import { isPhone, PESAN } from '@/lib/validation'
import { failed, succeeded, text, type ActionState } from './types'

/** Menambah CAR — nama orang yang dihubungi beserta nomor HP-nya. */
export async function saveCar(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const repo = getRepo()

  const name = text(formData, 'car_name')
  const phone = text(formData, 'car_phone')
  const notes = text(formData, 'notes')

  const errors: Record<string, string> = {}
  if (!name) errors.car_name = 'Nama orang wajib diisi'
  if (!phone) errors.car_phone = 'Nomor HP wajib diisi'
  else if (!isPhone(phone)) errors.car_phone = PESAN.teleponFormat
  if (Object.keys(errors).length > 0) return failed(errors)

  await repo.putCar({ car_name: name, car_phone: phone, notes })
  await repo.appendAudit({
    actor_email: user.email,
    action: 'create',
    object_type: 'car',
    result: 'ok',
  })

  revalidatePath('/setting/customers')
  return succeeded(`CAR "${name}" ditambahkan.`)
}

/** Menambah pelanggan, dan menghubungkannya ke satu CAR. */
export async function saveCustomer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const repo = getRepo()

  const name = text(formData, 'customer_name')
  const carId = text(formData, 'car_id')
  const notes = text(formData, 'notes')

  const errors: Record<string, string> = {}
  if (!name) errors.customer_name = 'Nama pelanggan wajib diisi'
  if (Object.keys(errors).length > 0) return failed(errors)

  // Nama pelanggan tidak boleh sama — mencegah satu pelanggan tercatat dua kali
  // dengan ejaan berbeda, yang membuat penyaringan data jadi kacau.
  const existing = await repo.listCustomers()
  if (existing.some((c) => c.customer_name.toLowerCase() === name.toLowerCase())) {
    return failed(
      { customer_name: `Pelanggan "${name}" sudah terdaftar` },
      'Pelanggan itu sudah ada. Kalau ingin mengubah CAR-nya, ubah dari daftar di bawah.',
    )
  }

  await repo.putCustomer({ customer_name: name, car_id: carId, notes })
  await repo.appendAudit({
    actor_email: user.email,
    action: 'create',
    object_type: 'customer',
    result: 'ok',
  })

  revalidatePath('/setting/customers')
  return succeeded(`Pelanggan "${name}" ditambahkan.`)
}

function backWith(message: string): never {
  redirect(`/setting/customers?pesan=${encodeURIComponent(message)}`)
}

/**
 * Menghapus CAR.
 *
 * Ditolak kalau masih ada pelanggan yang memakainya — supaya tidak ada
 * pelanggan yang kehilangan kontaknya tanpa disadari.
 */
export async function removeCar(formData: FormData): Promise<void> {
  const user = await requireUser()
  const repo = getRepo()
  const carId = text(formData, 'car_id')

  const cars = await repo.listCars()
  const car = cars.find((c) => c.car_id === carId)
  if (!car) backWith('CAR itu sudah tidak ada.')

  const customers = await repo.listCustomers()
  const used = customers.filter((c) => c.car_id === carId)
  if (used.length > 0) {
    backWith(
      `CAR "${car.car_name}" tidak bisa dihapus karena masih menangani ${used.length} pelanggan. Pindahkan pelanggannya ke CAR lain lebih dulu.`,
    )
  }

  await repo.deleteCar(carId, user.email)
  revalidatePath('/setting/customers')
  backWith(`CAR "${car.car_name}" dihapus.`)
}

/** Menghapus pelanggan. Ditolak kalau masih ada perangkat yang memakainya. */
export async function removeCustomer(formData: FormData): Promise<void> {
  const user = await requireUser()
  const repo = getRepo()
  const customerId = text(formData, 'customer_id')

  const customers = await repo.listCustomers()
  const customer = customers.find((c) => c.customer_id === customerId)
  if (!customer) backWith('Pelanggan itu sudah tidak ada.')

  const devices = await repo.listDevices({ customer_id: customerId })
  if (devices.length > 0) {
    backWith(
      `Pelanggan "${customer.customer_name}" tidak bisa dihapus karena masih punya ${devices.length} perangkat tercatat. Pindahkan atau hapus perangkatnya lebih dulu.`,
    )
  }

  await repo.deleteCustomer(customerId, user.email)
  revalidatePath('/setting/customers')
  backWith(`Pelanggan "${customer.customer_name}" dihapus.`)
}

/** Mengubah CAR yang menangani seorang pelanggan. */
export async function assignCar(formData: FormData): Promise<void> {
  const user = await requireUser()
  const repo = getRepo()

  const customerId = text(formData, 'customer_id')
  const carId = text(formData, 'car_id')

  const customers = await repo.listCustomers()
  const customer = customers.find((c) => c.customer_id === customerId)
  if (!customer) backWith('Pelanggan itu sudah tidak ada.')

  await repo.putCustomer({ ...customer, car_id: carId })
  await repo.appendAudit({
    actor_email: user.email,
    action: 'update',
    object_type: 'customer',
    object_id: customerId,
    field: 'car_id',
    result: 'ok',
  })

  revalidatePath('/setting/customers')
  backWith(`CAR untuk "${customer.customer_name}" diperbarui.`)
}
