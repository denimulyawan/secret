/**
 * Penyimpanan di Google Sheets.
 *
 * Cara kerja pembacaannya sengaja dibuat hemat: seluruh tab yang sering dipakai
 * dibaca dalam SATU permintaan, lalu disimpan di ingatan selama 60 detik.
 * Setiap kali ada penulisan, simpanan itu dibuang supaya perubahan langsung
 * terlihat. Dengan begitu jumlah permintaan ke Google tetap sedikit meski
 * halaman dibuka berkali-kali.
 *
 * Catatan tentang penghapusan: Google Sheets tidak menyediakan penghapusan baris
 * lewat antarmuka nilai. Karena itu penghapusan dilakukan dengan mengosongkan
 * barisnya — dan baris yang seluruhnya kosong memang diabaikan saat membaca.
 */

import { credentialAad, open, seal } from '../crypto'
import { appendValues, batchGetValues, updateValues } from '../sheets/client'
import {
  asBool,
  asNumber,
  assertRequiredHeaders,
  buildColumnMap,
  objectToRow,
  rowToObject,
  toBool,
  type ColumnMap,
  type Row,
} from '../sheets/mapper'
import { TABS, rowRange, tabRange, type TabName } from '../sheets/schema'
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

/** Tab yang dibaca bersamaan dalam satu permintaan. */
const HOT_TABS: TabName[] = [
  'brands',
  'device_types',
  'cars',
  'customers',
  'devices',
  'credentials',
  'users',
  'settings',
]

const TTL_MS = 60_000

interface ParsedTab {
  map: ColumnMap
  items: { data: Row; rowNumber: number }[]
}

interface CacheEntry extends ParsedTab {
  at: number
}

function newId(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${stamp}${random}`
}

function nowIso(): string {
  return new Date().toISOString()
}

export class SheetsRepo implements Repo {
  private cache = new Map<TabName, CacheEntry>()

  // ---------- Pembacaan ----------

  private parse(rows: string[][]): ParsedTab {
    if (rows.length === 0) return { map: {}, items: [] }
    const map = buildColumnMap(rows[0])
    const items: { data: Row; rowNumber: number }[] = []
    for (let i = 1; i < rows.length; i++) {
      const raw = rows[i] ?? []
      // Baris kosong seluruhnya diabaikan.
      if (raw.every((cell) => !cell || !String(cell).trim())) continue
      items.push({ data: rowToObject(raw, map), rowNumber: i + 1 })
    }
    return { map, items }
  }

  /** Membaca seluruh tab yang sering dipakai dalam satu permintaan. */
  private async ensureHotTabs(force = false): Promise<void> {
    const now = Date.now()
    const fresh =
      !force &&
      HOT_TABS.every((tab) => {
        const entry = this.cache.get(tab)
        return entry && now - entry.at < TTL_MS
      })
    if (fresh) return

    const ranges = HOT_TABS.map((tab) => tabRange(tab))
    const result = await batchGetValues(ranges)

    for (const tab of HOT_TABS) {
      const rows = this.pickRange(result, tab)
      const parsed = this.parse(rows)
      // Berhenti dengan pesan jelas kalau susunan kolom tidak sesuai.
      assertRequiredHeaders(tab, parsed.map)
      this.cache.set(tab, { ...parsed, at: now })
    }
  }

  /** Pencocokan rentang dari Google ke nama tab. */
  private pickRange(result: Map<string, string[][]>, tab: TabName): string[][] {
    for (const [range, values] of result) {
      const name = range.split('!')[0].replace(/^'/, '').replace(/'$/, '')
      if (name === tab) return values
    }
    return []
  }

  private async tab(name: TabName, force = false): Promise<ParsedTab> {
    if (HOT_TABS.includes(name)) {
      await this.ensureHotTabs(force)
      return this.cache.get(name) ?? { map: {}, items: [] }
    }
    const cached = this.cache.get(name)
    if (!force && cached && Date.now() - cached.at < TTL_MS) return cached
    const result = await batchGetValues([tabRange(name)])
    const parsed = this.parse(this.pickRange(result, name))
    assertRequiredHeaders(name, parsed.map)
    const entry = { ...parsed, at: Date.now() }
    this.cache.set(name, entry)
    return entry
  }

  private async rows(name: TabName): Promise<Row[]> {
    const parsed = await this.tab(name)
    return parsed.items.map((item) => item.data)
  }

  private invalidate(...names: TabName[]): void {
    if (names.length === 0) this.cache.clear()
    else for (const name of names) this.cache.delete(name)
  }

  // ---------- Penulisan ----------

  private async append(tabName: TabName, data: Row): Promise<void> {
    const parsed = await this.tab(tabName)
    const width = TABS[tabName].length
    const row = objectToRow(data, parsed.map, width)
    await appendValues(tabRange(tabName), [row])
    this.invalidate(tabName)
  }

  private async replaceRow(tabName: TabName, rowNumber: number, data: Row): Promise<void> {
    const parsed = await this.tab(tabName)
    const width = TABS[tabName].length
    const row = objectToRow(data, parsed.map, width)
    await updateValues(rowRange(tabName, rowNumber), [row])
    this.invalidate(tabName)
  }

  /** Menghapus isi baris. Baris kosong otomatis diabaikan saat membaca. */
  private async blankRow(tabName: TabName, rowNumber: number): Promise<void> {
    const width = TABS[tabName].length
    await updateValues(rowRange(tabName, rowNumber), [new Array<string>(width).fill('')])
    this.invalidate(tabName)
  }

  private async findRow(
    tabName: TabName,
    keyColumn: string,
    key: string,
  ): Promise<{ data: Row; rowNumber: number } | null> {
    const parsed = await this.tab(tabName)
    return parsed.items.find((item) => item.data[keyColumn] === key) ?? null
  }

  // ---------- Aset ----------

  private toDevice(row: Row): Device {
    return {
      device_id: row.device_id ?? '',
      asset_category: (row.asset_category === 'personal' ? 'personal' : 'customer'),
      customer_id: row.customer_id ?? '',
      hostname: row.hostname ?? '',
      ip_address: row.ip_address ?? '',
      url: row.url ?? '',
      device_type_code: row.device_type_code ?? '',
      device_model: row.device_model ?? '',
      brand_code: row.brand_code ?? '',
      serial_number: row.serial_number ?? '',
      software_version: row.software_version ?? '',
      start_license: row.start_license ?? '',
      end_license: row.end_license ?? '',
      lokasi: row.lokasi ?? '',
      status: ((row.status || 'active') as Device['status']),
      notes: row.notes ?? '',
      created_at: row.created_at ?? '',
      created_by: row.created_by ?? '',
      updated_at: row.updated_at ?? '',
      updated_by: row.updated_by ?? '',
      version: asNumber(row.version, 1),
    }
  }

  private fromDevice(device: Device): Row {
    return {
      device_id: device.device_id,
      asset_category: device.asset_category,
      customer_id: device.customer_id,
      hostname: device.hostname,
      ip_address: device.ip_address,
      url: device.url,
      device_type_code: device.device_type_code,
      device_model: device.device_model,
      brand_code: device.brand_code,
      serial_number: device.serial_number,
      software_version: device.software_version,
      start_license: device.start_license,
      end_license: device.end_license,
      lokasi: device.lokasi,
      status: device.status,
      notes: device.notes,
      created_at: device.created_at,
      created_by: device.created_by,
      updated_at: device.updated_at,
      updated_by: device.updated_by,
      version: String(device.version),
    }
  }

  async listDevices(filter?: DeviceFilter): Promise<Device[]> {
    let devices = (await this.rows('devices')).map((row) => this.toDevice(row))

    if (filter?.category) devices = devices.filter((d) => d.asset_category === filter.category)
    if (filter?.brand_code) devices = devices.filter((d) => d.brand_code === filter.brand_code)
    if (filter?.device_type_code)
      devices = devices.filter((d) => d.device_type_code === filter.device_type_code)
    if (filter?.customer_id) devices = devices.filter((d) => d.customer_id === filter.customer_id)
    if (filter?.status) devices = devices.filter((d) => d.status === filter.status)
    if (filter?.lokasi) devices = devices.filter((d) => d.lokasi === filter.lokasi)
    if (filter?.search) {
      const q = filter.search.toLowerCase()
      devices = devices.filter((d) =>
        [d.hostname, d.ip_address, d.device_model, d.serial_number, d.notes]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }
    return devices
  }

  async getDevice(deviceId: string): Promise<Device | null> {
    const found = await this.findRow('devices', 'device_id', deviceId)
    return found ? this.toDevice(found.data) : null
  }

  async createDevice(data: Partial<Device>, actor: string): Promise<Device> {
    const ts = nowIso()
    const device: Device = {
      device_id: data.device_id ?? newId('DEV'),
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
    await this.append('devices', this.fromDevice(device))
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
    const found = await this.findRow('devices', 'device_id', deviceId)
    if (!found) throw new Error('Perangkat tidak ditemukan.')
    const current = this.toDevice(found.data)

    if (current.version !== expectedVersion) {
      throw new Error(
        'Data sudah berubah sejak halaman ini dibuka. Muat ulang halamannya, lalu ulangi perubahan Anda.',
      )
    }

    const updated: Device = {
      ...current,
      ...patch,
      device_id: current.device_id,
      created_at: current.created_at,
      created_by: current.created_by,
      version: current.version + 1,
      updated_at: nowIso(),
      updated_by: actor,
    }
    await this.replaceRow('devices', found.rowNumber, this.fromDevice(updated))
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
    const found = await this.findRow('devices', 'device_id', deviceId)
    if (found) await this.blankRow('devices', found.rowNumber)

    // Kredensial milik perangkat itu ikut dikosongkan.
    const parsed = await this.tab('credentials')
    for (const item of parsed.items) {
      if (item.data.device_id === deviceId) {
        await this.blankRow('credentials', item.rowNumber)
      }
    }

    await this.appendAudit({
      actor_email: actor,
      action: 'delete',
      object_type: 'device',
      object_id: deviceId,
      result: 'ok',
    })
  }

  // ---------- Kredensial ----------

  private toCredential(row: Row): CredentialMeta {
    return {
      credential_id: row.credential_id ?? '',
      device_id: row.device_id ?? '',
      cred_type: ((row.cred_type || 'login') as CredentialMeta['cred_type']),
      username: row.username ?? '',
      port: asNumber(row.port, 0),
      source: row.source ?? '',
      verified_at: row.verified_at ?? '',
      notes: row.notes ?? '',
      updated_at: row.updated_at ?? '',
      updated_by: row.updated_by ?? '',
    }
  }

  async listCredentials(deviceId?: string): Promise<CredentialMeta[]> {
    const all = (await this.rows('credentials')).map((row) => this.toCredential(row))
    return deviceId ? all.filter((c) => c.device_id === deviceId) : all
  }

  async putCredential(data: NewCredential, actor: string): Promise<CredentialMeta> {
    const credentialId = data.credential_id ?? newId('CRED')
    const aad = credentialAad(credentialId)
    const sealed = seal(data.secret, aad)

    const row: Row = {
      credential_id: credentialId,
      device_id: data.device_id,
      cred_type: data.cred_type,
      username: data.username,
      secret_enc: sealed,
      key_version: 'v1',
      port: String(data.port || ''),
      source: 'ingatan',
      verified_at: '',
      notes: data.notes,
      updated_at: nowIso(),
      updated_by: actor,
    }

    const existing = await this.findRow('credentials', 'credential_id', credentialId)
    if (existing) {
      // Saat mengganti, status verifikasi ikut direset: password baru belum diuji.
      row.source = 'ingatan'
      row.verified_at = ''
      await this.replaceRow('credentials', existing.rowNumber, row)
    } else {
      await this.append('credentials', row)
    }

    await this.appendAudit({
      actor_email: actor,
      action: existing ? 'update' : 'create',
      object_type: 'credential',
      object_id: credentialId,
      field: 'secret_enc',
      result: 'ok',
      detail: 'kredensial disimpan (isi tidak dicatat)',
    })

    return this.toCredential(row)
  }

  async getCredentialSecret(
    credentialId: string,
  ): Promise<{ username: string; secret: string } | null> {
    const found = await this.findRow('credentials', 'credential_id', credentialId)
    if (!found) return null
    const sealed = found.data.secret_enc ?? ''
    if (!sealed) return null
    return {
      username: found.data.username ?? '',
      secret: open(sealed, credentialAad(credentialId)),
    }
  }

  async markCredentialVerified(credentialId: string, actor: string): Promise<void> {
    const found = await this.findRow('credentials', 'credential_id', credentialId)
    if (!found) throw new Error('Kredensial tidak ditemukan.')
    const updated: Row = {
      ...found.data,
      source: 'dari perangkat',
      verified_at: nowIso(),
      updated_at: nowIso(),
      updated_by: actor,
    }
    await this.replaceRow('credentials', found.rowNumber, updated)
  }

  async deleteCredential(credentialId: string, actor: string): Promise<void> {
    const found = await this.findRow('credentials', 'credential_id', credentialId)
    if (found) await this.blankRow('credentials', found.rowNumber)
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
    return (await this.rows('brands'))
      .map((row) => ({
        brand_code: row.brand_code ?? '',
        brand_name: row.brand_name ?? '',
        is_active: asBool(row.is_active),
        sort_order: asNumber(row.sort_order, 100),
        created_at: row.created_at ?? '',
      }))
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  async listDeviceTypes(): Promise<DeviceType[]> {
    return (await this.rows('device_types'))
      .map((row) => ({
        type_code: row.type_code ?? '',
        type_name: row.type_name ?? '',
        is_active: asBool(row.is_active),
        sort_order: asNumber(row.sort_order, 100),
        created_at: row.created_at ?? '',
      }))
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  async putBrand(data: Partial<Brand>): Promise<Brand> {
    const code = data.brand_code ?? ''
    const row: Row = {
      brand_code: code,
      brand_name: data.brand_name ?? code,
      is_active: toBool(data.is_active ?? true),
      sort_order: String(data.sort_order ?? 100),
      created_at: nowIso(),
    }
    const existing = await this.findRow('brands', 'brand_code', code)
    if (existing) await this.replaceRow('brands', existing.rowNumber, { ...row, created_at: existing.data.created_at })
    else await this.append('brands', row)
    return {
      brand_code: code,
      brand_name: row.brand_name,
      is_active: data.is_active ?? true,
      sort_order: data.sort_order ?? 100,
      created_at: row.created_at,
    }
  }

  async putDeviceType(data: Partial<DeviceType>): Promise<DeviceType> {
    const code = data.type_code ?? ''
    const row: Row = {
      type_code: code,
      type_name: data.type_name ?? code,
      is_active: toBool(data.is_active ?? true),
      sort_order: String(data.sort_order ?? 100),
      created_at: nowIso(),
    }
    const existing = await this.findRow('device_types', 'type_code', code)
    if (existing) await this.replaceRow('device_types', existing.rowNumber, { ...row, created_at: existing.data.created_at })
    else await this.append('device_types', row)
    return {
      type_code: code,
      type_name: row.type_name,
      is_active: data.is_active ?? true,
      sort_order: data.sort_order ?? 100,
      created_at: row.created_at,
    }
  }

  // ---------- Pelanggan & CAR ----------

  async listCars(): Promise<Car[]> {
    return (await this.rows('cars')).map((row) => ({
      car_id: row.car_id ?? '',
      car_name: row.car_name ?? '',
      car_phone: row.car_phone ?? '',
      notes: row.notes ?? '',
      created_at: row.created_at ?? '',
      updated_at: row.updated_at ?? '',
      version: asNumber(row.version, 1),
    }))
  }

  async listCustomers(): Promise<Customer[]> {
    return (await this.rows('customers')).map((row) => ({
      customer_id: row.customer_id ?? '',
      customer_name: row.customer_name ?? '',
      car_id: row.car_id ?? '',
      notes: row.notes ?? '',
      created_at: row.created_at ?? '',
      updated_at: row.updated_at ?? '',
      version: asNumber(row.version, 1),
    }))
  }

  async putCar(data: Partial<Car>): Promise<Car> {
    const id = data.car_id ?? newId('CAR')
    const existing = await this.findRow('cars', 'car_id', id)
    const row: Row = {
      car_id: id,
      car_name: data.car_name ?? '',
      car_phone: data.car_phone ?? '',
      notes: data.notes ?? '',
      created_at: existing?.data.created_at ?? nowIso(),
      updated_at: nowIso(),
      version: String(asNumber(existing?.data.version, 0) + 1),
    }
    if (existing) await this.replaceRow('cars', existing.rowNumber, row)
    else await this.append('cars', row)
    return {
      car_id: id,
      car_name: row.car_name,
      car_phone: row.car_phone,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      version: asNumber(row.version, 1),
    }
  }

  async putCustomer(data: Partial<Customer>): Promise<Customer> {
    const id = data.customer_id ?? newId('CUST')
    const existing = await this.findRow('customers', 'customer_id', id)
    const row: Row = {
      customer_id: id,
      customer_name: data.customer_name ?? '',
      car_id: data.car_id ?? '',
      notes: data.notes ?? '',
      created_at: existing?.data.created_at ?? nowIso(),
      updated_at: nowIso(),
      version: String(asNumber(existing?.data.version, 0) + 1),
    }
    if (existing) await this.replaceRow('customers', existing.rowNumber, row)
    else await this.append('customers', row)
    return {
      customer_id: id,
      customer_name: row.customer_name,
      car_id: row.car_id,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      version: asNumber(row.version, 1),
    }
  }

  async deleteCar(carId: string, actor: string): Promise<void> {
    const found = await this.findRow('cars', 'car_id', carId)
    if (found) await this.blankRow('cars', found.rowNumber)
    await this.appendAudit({
      actor_email: actor,
      action: 'delete',
      object_type: 'car',
      object_id: carId,
      result: 'ok',
    })
  }

  async deleteCustomer(customerId: string, actor: string): Promise<void> {
    const found = await this.findRow('customers', 'customer_id', customerId)
    if (found) await this.blankRow('customers', found.rowNumber)
    await this.appendAudit({
      actor_email: actor,
      action: 'delete',
      object_type: 'customer',
      object_id: customerId,
      result: 'ok',
    })
  }

  // ---------- Pengguna ----------

  private toUser(row: Row): User {
    return {
      email: (row.email ?? '').toLowerCase(),
      full_name: row.full_name ?? '',
      role: row.role === 'administrator' ? 'administrator' : 'engineer',
      is_active: asBool(row.is_active),
      created_at: row.created_at ?? '',
      created_by: row.created_by ?? '',
      last_login_at: row.last_login_at ?? '',
      version: asNumber(row.version, 1),
    }
  }

  async listUsers(): Promise<User[]> {
    return (await this.rows('users')).map((row) => this.toUser(row))
  }

  async getUser(email: string): Promise<User | null> {
    const row = await this.findRow('users', 'email', email.toLowerCase())
    return row ? this.toUser(row.data) : null
  }

  async putUser(data: Partial<User>, actor: string): Promise<User> {
    const email = (data.email ?? '').toLowerCase()
    const existing = await this.findRow('users', 'email', email)
    const row: Row = {
      email,
      full_name: data.full_name ?? existing?.data.full_name ?? '',
      role: data.role ?? existing?.data.role ?? 'engineer',
      is_active: toBool(data.is_active ?? asBool(existing?.data.is_active ?? 'TRUE')),
      created_at: existing?.data.created_at ?? nowIso(),
      created_by: existing?.data.created_by ?? actor,
      last_login_at: existing?.data.last_login_at ?? '',
      version: String(asNumber(existing?.data.version, 0) + 1),
    }
    if (existing) await this.replaceRow('users', existing.rowNumber, row)
    else await this.append('users', row)

    await this.appendAudit({
      actor_email: actor,
      action: existing ? 'update' : 'create',
      object_type: 'user',
      object_id: email,
      field: 'role',
      result: 'ok',
    })
    return this.toUser(row)
  }

  // ---------- Pengaturan ----------

  private toSetting(row: Row): Setting {
    return {
      key: row.key ?? '',
      value_enc: row.value_enc ?? '',
      is_secret: asBool(row.is_secret),
      updated_at: row.updated_at ?? '',
      updated_by: row.updated_by ?? '',
    }
  }

  async listSettings(): Promise<Setting[]> {
    return (await this.rows('settings')).map((row) => this.toSetting(row))
  }

  async getSetting(key: string): Promise<Setting | null> {
    const row = await this.findRow('settings', 'key', key)
    return row ? this.toSetting(row.data) : null
  }

  /** Membaca nilai pengaturan. Nilai rahasia dibuka di sini, di sisi server. */
  async getSettingValue(key: string): Promise<string | null> {
    const setting = await this.getSetting(key)
    if (!setting) return null
    return setting.is_secret ? open(setting.value_enc, `setting:${key}`) : setting.value_enc
  }

  async putSetting(
    key: string,
    value: string,
    isSecret: boolean,
    actor: string,
  ): Promise<void> {
    const row: Row = {
      key,
      value_enc: isSecret ? seal(value, `setting:${key}`) : value,
      is_secret: toBool(isSecret),
      updated_at: nowIso(),
      updated_by: actor,
    }
    const existing = await this.findRow('settings', 'key', key)
    if (existing) await this.replaceRow('settings', existing.rowNumber, row)
    else await this.append('settings', row)

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
    await this.append('audit_log', {
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
    const rows = await this.rows('audit_log')
    return rows
      .slice()
      .reverse()
      .slice(0, limit)
      .map((row) => ({
        ts: row.ts ?? '',
        actor_email: row.actor_email ?? '',
        action: row.action ?? '',
        object_type: row.object_type ?? '',
        object_id: row.object_id ?? '',
        field: row.field ?? '',
        result: row.result ?? 'ok',
        ip: row.ip ?? '',
        user_agent: row.user_agent ?? '',
        detail: row.detail ?? '',
      }))
  }

  async appendAlertLog(entry: Partial<AlertLogEntry>): Promise<void> {
    await this.append('alert_log', {
      ts: entry.ts ?? nowIso(),
      device_id: entry.device_id ?? '',
      license_end: entry.license_end ?? '',
      threshold_days: String(entry.threshold_days ?? 0),
      channel: entry.channel ?? 'telegram',
      status: entry.status ?? 'sent',
      error: entry.error ?? '',
      message_id: entry.message_id ?? '',
    })
  }

  async listAlertLog(limit = 200): Promise<AlertLogEntry[]> {
    const rows = await this.rows('alert_log')
    return rows
      .slice()
      .reverse()
      .slice(0, limit)
      .map((row) => ({
        ts: row.ts ?? '',
        device_id: row.device_id ?? '',
        license_end: row.license_end ?? '',
        threshold_days: asNumber(row.threshold_days, 0),
        channel: row.channel ?? 'telegram',
        status: row.status ?? 'sent',
        error: row.error ?? '',
        message_id: row.message_id ?? '',
      }))
  }
}
