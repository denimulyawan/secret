'use client'

import { useActionState } from 'react'
import { saveCar, saveCustomer } from '@/lib/actions/customers'
import { EMPTY_ACTION } from '@/lib/actions/types'
import type { Car } from '@/lib/repo/types'
import FormField from './form-field'

function Result({ message, ok }: { message?: string; ok: boolean }) {
  if (!message) return null
  return (
    <div className={ok ? 'notice notice-info' : 'notice notice-warn'} style={{ gridColumn: '1 / -1' }}>
      <span aria-hidden="true">{ok ? '✓' : '⚠'}</span>
      <div>{message}</div>
    </div>
  )
}

export function CarForm() {
  const [state, action, pending] = useActionState(saveCar, EMPTY_ACTION)

  return (
    <form action={action} className="form-grid">
      <Result message={state.message} ok={state.ok} />

      <FormField
        label="Nama orang"
        name="car_name"
        required
        error={state.errors?.car_name}
        hint="Orang yang biasa Anda hubungi untuk urusan perangkat pelanggan"
      >
        <input id="car_name" name="car_name" type="text" required autoComplete="off" />
      </FormField>

      <FormField
        label="Nomor HP"
        name="car_phone"
        required
        error={state.errors?.car_phone}
        hint="Angka, boleh memakai +, spasi, dan tanda hubung"
      >
        <input id="car_phone" name="car_phone" type="tel" required autoComplete="off" />
      </FormField>

      <FormField label="Catatan" name="notes" hint="Misalnya bagian atau divisi">
        <input id="notes" name="notes" type="text" autoComplete="off" />
      </FormField>

      <div className="field" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Tambah CAR'}
        </button>
      </div>
    </form>
  )
}

export function CustomerForm({ cars }: { cars: Car[] }) {
  const [state, action, pending] = useActionState(saveCustomer, EMPTY_ACTION)

  return (
    <form action={action} className="form-grid">
      <Result message={state.message} ok={state.ok} />

      <FormField
        label="Nama pelanggan"
        name="customer_name"
        required
        error={state.errors?.customer_name}
        hint="Nama perusahaan atau instansi pelanggan"
      >
        <input id="customer_name" name="customer_name" type="text" required autoComplete="off" />
      </FormField>

      <FormField
        label="CAR"
        name="car_id"
        hint={
          cars.length === 0
            ? 'Belum ada CAR terdaftar — boleh dikosongkan dulu'
            : 'Orang yang menangani pelanggan ini'
        }
      >
        <select id="car_id" name="car_id" defaultValue="">
          <option value="">— belum ditentukan —</option>
          {cars.map((car) => (
            <option key={car.car_id} value={car.car_id}>
              {car.car_name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Catatan" name="notes">
        <input id="notes" name="notes" type="text" autoComplete="off" />
      </FormField>

      <div className="field" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Tambah pelanggan'}
        </button>
      </div>
    </form>
  )
}
