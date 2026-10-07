/**
 * Penyimpanan sementara di memori.
 *
 * Dipakai ketika penyimpanan sungguhan (spreadsheet) belum dikonfigurasi, supaya
 * aplikasi tetap bisa dibuka dan tampilannya bisa dilihat.
 *
 * PENTING: penyimpanan ini MULAI DALAM KEADAAN KOSONG dan tidak memuat data
 * contoh apa pun. Isi yang Anda masukkan hanya bertahan selama proses berjalan
 * dan hilang saat aplikasi dihentikan. Ini memang disengaja — aplikasi tidak
 * pernah membawa data bawaan.
 */

import { randomUUID } from 'node:crypto'
import { credentialAad, open, seal } from '../crypto'
import type {
  AlertLogEntry,
  AuditEntry,
  Brand,
  Car,
  CredentialMeta,
  Customer,
  Device,
  DeviceFilter,
  DeviceType,
  NewCredential,
  Repo,
  Setting,
  User,
} from './types'

interface StoredSecret {
  value: string
  username: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function newId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

export class MemoryRepo implements Repo {
  // Semua mulai kosong. Tidak ada data bawaan.
  private devices: Device[] = []
  private credentials: CredentialMeta[] = []
  private secrets = new Map<string, StoredSecret>()
  private brands: Brand[] = []
  private deviceTypes: DeviceType[] = []
  private cars: Car[] = []
  private customers: Customer[] = []
  private users: User[] = []
  private settings = new Map<string, Setting>()
  private audit: AuditEntry[] = []
  private alertLog: AlertLogEntry[] = []

  // ---------- Aset ----------

  async listDevices(filter?: DeviceFilter): Promise<Device[]> {
    let rows = [...this.devices]
    if (filter?.category) rows = rows.filter((d) => d.asset_category === filter.category)
    if (filter?.brand_code) rows = rows.filter((d) => d.brand_code === filter.brand_code)
    if (filter?.device_type_code)
      rows = rows.filter((d) => d.device_type_code === filter.device_type_code)
    if (filter?.customer_id) rows = rows.filter((d) => d.customer_id === filter.customer_id)
    if (filter?.status) rows = rows.filter((d) => d.status === filter.status)
    if (filter?.lokasi) rows = rows.filter((d) => d.lokasi === filter.lokasi)
    if (filter?.search) {
      const q = filter.search.toLowerCase()
      rows = rows.filter((d) =>
        [d.hostname, d.ip_address, d.device_model, d.serial_number, d.notes]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }
    return rows
  }

  async getDevice(deviceId: string): Promise<Device | null> {
    return this.devices.find((d) => d.device_id === deviceId) ?? null
  }

  async createDevice(data: Partial<Device>, actor: string): Promise<Device> {
    const ts = nowIso()
    const device: Device = {
      device_id: newId('DEV'),
      asset_category: data.asset_category ?? 'customer',
      customer_id: data.customer_id ?? '',
      hostname: data.hostname ?? '',
      ip_address: data.ip_address ?? '',
      url: data.url ?? '',
      device_type_code: data.device_type_code ?? '',
      device_model: data.device_model ?? '',
      brand_code: data.brand_code ?? '',
      serial_number: data.serial_number ?? '',
      software_version: data.software_version ?? '',
      start_license: data.start_license ?? '',
      end_license: data.end_license ?? '',
      lokasi: data.lokasi ?? '',
      status: data.status ?? 'active',
      notes: data.notes ?? '',
      created_at: ts,
      created_by: actor,
      updated_at: ts,
      updated_by: actor,
      version: 1,
    }
    this.devices.push(device)
    await this.appendAudit({
      actor_email: actor,
      action: 'create',
      object_type: 'device',
      object_id: device.device_id,
      result: 'ok',
    })
    return device
  }

  async updateDevice(
    deviceId: string,
    patch: Partial<Device>,
    expectedVersion: number,
    actor: string,
  ): Promise<Device> {
    const index = this.devices.findIndex((d) => d.device_id === deviceId)
    if (index < 0) throw new Error('Perangkat tidak ditemukan.')
    const current = this.devices[index]
    if (current.version !== expectedVersion) {
      throw new Error(
        'Data sudah berubah sejak halaman ini dibuka. Muat ulang halamannya, lalu ulangi perubahan Anda.',
      )
    }
    const updated: Device = {
      ...current,
      ...patch,
      device_id: current.device_id,
      version: current.version + 1,
      updated_at: nowIso(),
      updated_by: actor,
    }
    this.devices[index] = updated
    await this.appendAudit({
      actor_email: actor,
      action: 'update',
      object_type: 'device',
      object_id: deviceId,
      result: 'ok',
    })
    return updated
  }

  async deleteDevice(deviceId: string, actor: string): Promise<void> {
    this.devices = this.devices.filter((d) => d.device_id !== deviceId)
    const removed = this.credentials.filter((c) => c.device_id === deviceId)
    for (const cred of removed) this.secrets.delete(cred.credential_id)
    this.credentials = this.credentials.filter((c) => c.device_id !== deviceId)
    await this.appendAudit({
      actor_email: actor,
      action: 'delete',
      object_type: 'device',
      object_id: deviceId,
      result: 'ok',
    })
  }

  // ---------- Kredensial ----------

  async listCredentials(deviceId?: string): Promise<CredentialMeta[]> {
    const rows = deviceId
      ? this.credentials.filter((c) => c.device_id === deviceId)
      : [...this.credentials]
    return rows
  }

  async putCredential(data: NewCredential, actor: string): Promise<CredentialMeta> {
    const credentialId = data.credential_id ?? newId('CRED')
    const meta: CredentialMeta = {
      credential_id: credentialId,
      device_id: data.device_id,
      cred_type: data.cred_type,
      username: data.username,
      port: data.port,
      source: 'ingatan',
      verified_at: '',
      notes: data.notes,
      updated_at: nowIso(),
      updated_by: actor,
    }
    const existing = this.credentials.findIndex((c) => c.credential_id === credentialId)
    if (existing >= 0) this.credentials[existing] = meta
    else this.credentials.push(meta)

    // Plaintext hanya hidup sesaat: langsung dienkripsi sebelum disimpan.
    this.secrets.set(credentialId, {
      value: seal(data.secret, credentialAad(credentialId)),
      username: data.username,
    })

    await this.appendAudit({
      actor_email: actor,
      action: existing >= 0 ? 'update' : 'create',
      object_type: 'credential',
      object_id: credentialId,
      field: 'secret_enc',
      result: 'ok',
      detail: 'kredensial disimpan (isi tidak dicatat)',
    })
    return meta
  }

  async getCredentialSecret(
    credentialId: string,
  ): Promise<{ username: string; secret: string } | null> {
    const stored = this.secrets.get(credentialId)
    if (!stored) return null
    return {
      username: stored.username,
      secret: open(stored.value, credentialAad(credentialId)),
    }
  }

  async markCredentialVerified(credentialId: string, actor: string): Promise<void> {
    const cred = this.credentials.find((c) => c.credential_id === credentialId)
    if (!cred) throw new Error('Kredensial tidak ditemukan.')
    cred.verified_at = nowIso()
    cred.updated_by = actor
    cred.updated_at = nowIso()
    cred.source = 'dari perangkat'
  }

  async deleteCredential(credentialId: string, actor: string): Promise<void> {
    this.credentials = this.credentials.filter((c) => c.credential_id !== credentialId)
    this.secrets.delete(credentialId)
    await this.appendAudit({
      actor_email: actor,
      action: 'delete',
      object_type: 'credential',
      object_id: credentialId,
      result: 'ok',
    })
  }

  // ---------- Katalog ----------

  async listBrands(): Promise<Brand[]> {
    return [...this.brands].sort((a, b) => a.sort_order - b.sort_order)
  }

  async listDeviceTypes(): Promise<DeviceType[]> {
    return [...this.deviceTypes].sort((a, b) => a.sort_order - b.sort_order)
  }

  async putBrand(data: Partial<Brand>): Promise<Brand> {
    const code = data.brand_code ?? ''
    const existing = this.brands.findIndex((b) => b.brand_code === code)
    const row: Brand = {
      brand_code: code,
      brand_name: data.brand_name ?? code,
      is_active: data.is_active ?? true,
      sort_order: data.sort_order ?? 100,
      created_at: nowIso(),
    }
    if (existing >= 0) this.brands[existing] = { ...this.brands[existing], ...row }
    else this.brands.push(row)
    return row
  }

  async putDeviceType(data: Partial<DeviceType>): Promise<DeviceType> {
    const code = data.type_code ?? ''
    const existing = this.deviceTypes.findIndex((t) => t.type_code === code)
    const row: DeviceType = {
      type_code: code,
      type_name: data.type_name ?? code,
      is_active: data.is_active ?? true,
      sort_order: data.sort_order ?? 100,
      created_at: nowIso(),
    }
    if (existing >= 0) this.deviceTypes[existing] = { ...this.deviceTypes[existing], ...row }
    else this.deviceTypes.push(row)
    return row
  }

  // ---------- Pelanggan & CAR ----------

  async listCars(): Promise<Car[]> {
    return [...this.cars]
  }

  async listCustomers(): Promise<Customer[]> {
    return [...this.customers]
  }

  async putCar(data: Partial<Car>): Promise<Car> {
    const id = data.car_id ?? newId('CAR')
    const existing = this.cars.findIndex((c) => c.car_id === id)
    const row: Car = {
      car_id: id,
      car_name: data.car_name ?? '',
      car_phone: data.car_phone ?? '',
      notes: data.notes ?? '',
      created_at: existing >= 0 ? this.cars[existing].created_at : nowIso(),
      updated_at: nowIso(),
      version: existing >= 0 ? this.cars[existing].version + 1 : 1,
    }
    if (existing >= 0) this.cars[existing] = row
    else this.cars.push(row)
    return row
  }

  async putCustomer(data: Partial<Customer>): Promise<Customer> {
    const id = data.customer_id ?? newId('CUST')
    const existing = this.customers.findIndex((c) => c.customer_id === id)
    const row: Customer = {
      customer_id: id,
      customer_name: data.customer_name ?? '',
      car_id: data.car_id ?? '',
      notes: data.notes ?? '',
      created_at: existing >= 0 ? this.customers[existing].created_at : nowIso(),
      updated_at: nowIso(),
      version: existing >= 0 ? this.customers[existing].version + 1 : 1,
    }
    if (existing >= 0) this.customers[existing] = row
    else this.customers.push(row)
    return row
  }

  // ---------- Pengguna ----------

  async listUsers(): Promise<User[]> {
    return [...this.users]
  }

  async getUser(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null
  }

  async putUser(data: Partial<User>, actor: string): Promise<User> {
    const email = (data.email ?? '').toLowerCase()
    const existing = this.users.findIndex((u) => u.email === email)
    const row: User = {
      email,
      full_name: data.full_name ?? '',
      role: data.role ?? 'engineer',
      is_active: data.is_active ?? true,
      created_at: existing >= 0 ? this.users[existing].created_at : nowIso(),
      created_by: existing >= 0 ? this.users[existing].created_by : actor,
      last_login_at: existing >= 0 ? this.users[existing].last_login_at : '',
      version: existing >= 0 ? this.users[existing].version + 1 : 1,
    }
    if (existing >= 0) this.users[existing] = row
    else this.users.push(row)
    await this.appendAudit({
      actor_email: actor,
      action: existing >= 0 ? 'update' : 'create',
      object_type: 'user',
      object_id: email,
      field: 'role',
      result: 'ok',
    })
    return row
  }

  // ---------- Pengaturan ----------

  async listSettings(): Promise<Setting[]> {
    return [...this.settings.values()]
  }

  async getSetting(key: string): Promise<Setting | null> {
    return this.settings.get(key) ?? null
  }

  async putSetting(
    key: string,
    value: string,
    isSecret: boolean,
    actor: string,
  ): Promise<void> {
    this.settings.set(key, {
      key,
      value_enc: isSecret ? seal(value, `setting:${key}`) : value,
      is_secret: isSecret,
      updated_at: nowIso(),
      updated_by: actor,
    })
    await this.appendAudit({
      actor_email: actor,
      action: 'update',
      object_type: 'setting',
      object_id: key,
      result: 'ok',
      detail: isSecret ? 'nilai rahasia diganti (isi tidak dicatat)' : 'nilai diganti',
    })
  }

  // ---------- Catatan ----------

  async appendAudit(entry: Partial<AuditEntry>): Promise<void> {
    this.audit.push({
      ts: entry.ts ?? nowIso(),
      actor_email: entry.actor_email ?? '',
      action: entry.action ?? '',
      object_type: entry.object_type ?? '',
      object_id: entry.object_id ?? '',
      field: entry.field ?? '',
      result: entry.result ?? 'ok',
      ip: entry.ip ?? '',
      user_agent: entry.user_agent ?? '',
      detail: entry.detail ?? '',
    })
  }

  async listAudit(limit = 200): Promise<AuditEntry[]> {
    return [...this.audit].reverse().slice(0, limit)
  }

  async appendAlertLog(entry: Partial<AlertLogEntry>): Promise<void> {
    this.alertLog.push({
      ts: entry.ts ?? nowIso(),
      device_id: entry.device_id ?? '',
      license_end: entry.license_end ?? '',
      threshold_days: entry.threshold_days ?? 0,
      channel: entry.channel ?? 'telegram',
      status: entry.status ?? 'sent',
      error: entry.error ?? '',
      message_id: entry.message_id ?? '',
    })
  }

  async listAlertLog(limit = 200): Promise<AlertLogEntry[]> {
    return [...this.alertLog].reverse().slice(0, limit)
  }
}
