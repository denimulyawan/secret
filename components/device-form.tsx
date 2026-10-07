'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { saveDevice } from '@/lib/actions/devices'
import { EMPTY_ACTION } from '@/lib/actions/types'
import type { Brand, Customer, Device, DeviceType } from '@/lib/repo/types'
import FormField from './form-field'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'maintenance', label: 'Perawatan' },
  { value: 'spare', label: 'Cadangan' },
  { value: 'retired', label: 'Disimpan' },
]

export default function DeviceForm({
  device,
  brands,
  types,
  customers,
  isAdmin,
  defaultCategory,
}: {
  device?: Device
  brands: Brand[]
  types: DeviceType[]
  customers: Customer[]
  isAdmin: boolean
  defaultCategory: 'personal' | 'customer'
}) {
  const [state, action, pending] = useActionState(saveDevice, EMPTY_ACTION)
  const [category, setCategory] = useState<'personal' | 'customer'>(
    device?.asset_category ?? defaultCategory,
  )

  const activeBrands = brands.filter((b) => b.is_active)
  const activeTypes = types.filter((t) => t.is_active)
  const noCatalog = activeBrands.length === 0

  return (
    <>
      {state.message && !state.ok ? (
        <div className="notice notice-warn">
          <span aria-hidden="true">⚠</span>
          <div>{state.message}</div>
        </div>
      ) : null}

      {noCatalog ? (
        <div className="notice notice-warn">
          <span aria-hidden="true">⚠</span>
          <div>
            Katalog brand masih kosong. Anda tetap bisa menyimpan perangkat, tetapi kolom brand
            tidak bisa diisi. <Link href="/setting/catalog">Isi katalog</Link> lebih dulu kalau
            ingin sekaligus.
          </div>
        </div>
      ) : null}

      <form action={action}>
        {device ? <input type="hidden" name="device_id" value={device.device_id} /> : null}

        <div className="card">
          <h2 className="section-title">Kepemilikan</h2>
          <div className="form-grid">
            <FormField
              label="Kategori aset"
              name="asset_category"
              required
              error={state.errors?.asset_category}
              hint={
                isAdmin
                  ? 'Personal = milik sendiri (tidak terlihat Engineer) · Customer = milik pelanggan'
                  : 'Role Anda hanya bisa mengelola aset Customer'
              }
            >
              <select
                id="asset_category"
                name="asset_category"
                value={category}
                onChange={(event) => setCategory(event.target.value as 'personal' | 'customer')}
              >
                {isAdmin ? <option value="personal">Personal — milik sendiri</option> : null}
                <option value="customer">Customer — milik pelanggan</option>
              </select>
            </FormField>

            {category === 'customer' ? (
              <FormField
                label="Pelanggan"
                name="customer_id"
                required
                error={state.errors?.customer_id}
                hint={
                  customers.length === 0
                    ? 'Belum ada pelanggan terdaftar'
                    : 'Pelanggan tempat perangkat ini berada'
                }
              >
                <select
                  id="customer_id"
                  name="customer_id"
                  defaultValue={device?.customer_id ?? ''}
                >
                  <option value="">— pilih pelanggan —</option>
                  {customers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.customer_name}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Identitas perangkat</h2>
          <div className="form-grid">
            <FormField
              label="Hostname"
              name="hostname"
              required
              error={state.errors?.hostname}
              hint="Nama perangkat, misalnya fw-jkt-01"
            >
              <input
                id="hostname"
                name="hostname"
                type="text"
                required
                defaultValue={device?.hostname ?? ''}
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>

            <FormField
              label="Alamat IP"
              name="ip_address"
              required
              error={state.errors?.ip_address}
              hint="Format: 10.10.1.1 — hanya angka dan titik, huruf ditolak"
            >
              <input
                id="ip_address"
                name="ip_address"
                type="text"
                required
                inputMode="numeric"
                defaultValue={device?.ip_address ?? ''}
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>

            <FormField
              label="URL"
              name="url"
              error={state.errors?.url}
              hint="Opsional. Hanya kalau perangkat diakses lewat alamat web, contoh: https://10.10.1.1:8443"
            >
              <input
                id="url"
                name="url"
                type="text"
                defaultValue={device?.url ?? ''}
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>

            <FormField
              label="Brand"
              name="brand_code"
              required
              error={state.errors?.brand_code}
              hint="Diambil dari katalog — tambah brand baru lewat menu Katalog"
            >
              <select id="brand_code" name="brand_code" defaultValue={device?.brand_code ?? ''}>
                <option value="">— pilih brand —</option>
                {activeBrands.map((b) => (
                  <option key={b.brand_code} value={b.brand_code}>
                    {b.brand_name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Jenis perangkat"
              name="device_type_code"
              error={state.errors?.device_type_code}
              hint="Diambil dari katalog"
            >
              <select
                id="device_type_code"
                name="device_type_code"
                defaultValue={device?.device_type_code ?? ''}
              >
                <option value="">— pilih jenis —</option>
                {activeTypes.map((t) => (
                  <option key={t.type_code} value={t.type_code}>
                    {t.type_name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Model"
              name="device_model"
              hint="Misalnya FortiGate 100F"
            >
              <input
                id="device_model"
                name="device_model"
                type="text"
                defaultValue={device?.device_model ?? ''}
                autoComplete="off"
              />
            </FormField>

            <FormField
              label="Nomor seri"
              name="serial_number"
              error={state.errors?.serial_number}
              hint="Tanpa spasi"
            >
              <input
                id="serial_number"
                name="serial_number"
                type="text"
                defaultValue={device?.serial_number ?? ''}
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>

            <FormField
              label="Versi perangkat lunak"
              name="software_version"
              hint="Misalnya v7.2.8"
            >
              <input
                id="software_version"
                name="software_version"
                type="text"
                defaultValue={device?.software_version ?? ''}
                autoComplete="off"
              />
            </FormField>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Lisensi, lokasi, dan keadaan</h2>
          <div className="form-grid">
            <FormField
              label="Lisensi mulai"
              name="start_license"
              error={state.errors?.start_license}
              hint="Format: 2025-03-31"
            >
              <input
                id="start_license"
                name="start_license"
                type="date"
                defaultValue={device?.start_license ?? ''}
              />
            </FormField>

            <FormField
              label="Lisensi berakhir"
              name="end_license"
              error={state.errors?.end_license}
              hint="Menjadi dasar pengingat otomatis sebelum habis"
            >
              <input
                id="end_license"
                name="end_license"
                type="date"
                defaultValue={device?.end_license ?? ''}
              />
            </FormField>

            <FormField label="Lokasi" name="lokasi" hint="Misalnya JKT-DC1">
              <input
                id="lokasi"
                name="lokasi"
                type="text"
                defaultValue={device?.lokasi ?? ''}
                autoComplete="off"
              />
            </FormField>

            <FormField label="Keadaan" name="status">
              <select
                id="status"
                name="status"
                defaultValue={device?.status ?? 'active'}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Catatan"
              name="notes"
              wide
              hint="Keterangan tambahan, misalnya kondisi khusus atau riwayat singkat"
            >
              <textarea id="notes" name="notes" rows={3} defaultValue={device?.notes ?? ''} />
            </FormField>
          </div>
        </div>

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'Menyimpan…' : device ? 'Simpan perubahan' : 'Simpan perangkat'}
          </button>
          <Link className="btn" href={device ? `/asset/${device.device_id}` : '/asset/customer'}>
            Batal
          </Link>
        </div>
      </form>
    </>
  )
}
