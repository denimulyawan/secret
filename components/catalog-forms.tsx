'use client'

import { useActionState } from 'react'
import { saveBrand, saveDeviceType } from '@/lib/actions/catalog'
import { EMPTY_ACTION } from '@/lib/actions/types'
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

export function BrandForm() {
  const [state, action, pending] = useActionState(saveBrand, EMPTY_ACTION)

  return (
    <form action={action} className="form-grid">
      <Result message={state.message} ok={state.ok} />

      <FormField
        label="Kode brand"
        name="brand_code"
        required
        error={state.errors?.brand_code}
        hint="Huruf kecil tanpa spasi, misalnya: fortigate"
      >
        <input id="brand_code" name="brand_code" type="text" required autoComplete="off" />
      </FormField>

      <FormField
        label="Nama yang tampil"
        name="brand_name"
        required
        error={state.errors?.brand_name}
        hint="Boleh spasi dan huruf besar, misalnya: FortiGate / Fortinet"
      >
        <input id="brand_name" name="brand_name" type="text" required autoComplete="off" />
      </FormField>

      <FormField label="Urutan tampil" name="sort_order" hint="Angka kecil tampil lebih dulu">
        <input id="sort_order" name="sort_order" type="number" min={1} defaultValue={100} />
      </FormField>

      <div className="field" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Tambah brand'}
        </button>
      </div>
    </form>
  )
}

export function DeviceTypeForm() {
  const [state, action, pending] = useActionState(saveDeviceType, EMPTY_ACTION)

  return (
    <form action={action} className="form-grid">
      <Result message={state.message} ok={state.ok} />

      <FormField
        label="Kode jenis"
        name="type_code"
        required
        error={state.errors?.type_code}
        hint="Huruf kecil tanpa spasi, misalnya: firewall"
      >
        <input id="type_code" name="type_code" type="text" required autoComplete="off" />
      </FormField>

      <FormField
        label="Nama yang tampil"
        name="type_name"
        required
        error={state.errors?.type_name}
        hint="Misalnya: Firewall"
      >
        <input id="type_name" name="type_name" type="text" required autoComplete="off" />
      </FormField>

      <FormField label="Urutan tampil" name="sort_order" hint="Angka kecil tampil lebih dulu">
        <input id="sort_order" name="sort_order" type="number" min={1} defaultValue={100} />
      </FormField>

      <div className="field" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Tambah jenis'}
        </button>
      </div>
    </form>
  )
}
