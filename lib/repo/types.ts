/**
 * Bentuk data netinv.
 *
 * Berkas ini hanya mendefinisikan BENTUK datanya — tidak memuat satu pun isi data.
 * Seluruh isi diambil saat aplikasi berjalan, dari penyimpanan yang dikonfigurasi
 * pemilik. Aplikasi dimulai dalam keadaan kosong.
 */

// ---------- Jenis dasar ----------

/** Aset milik sendiri (tidak terlihat Engineer) atau aset pelanggan. */
export type AssetCategory = 'personal' | 'customer'

/** Administrator melihat semua; Engineer tidak melihat aset Personal. */
export type Role = 'administrator' | 'engineer'

export type DeviceStatus = 'active' | 'maintenance' | 'spare' | 'retired'

export type CredType =
  | 'login'
  | 'enable'
  | 'snmp_ro'
  | 'snmp_rw'
  | 'api_token'
  | 'web'
  | 'console'
  | 'other'

// ---------- Katalog ----------

export interface Brand {
  brand_code: string
  brand_name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface DeviceType {
  type_code: string
  type_name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

// ---------- Pelanggan & CAR ----------

/** CAR = nama orang yang dihubungi, beserta nomor HP-nya. */
export interface Car {
  car_id: string
  car_name: string
  car_phone: string
  notes: string
  created_at: string
  updated_at: string
  version: number
}

export interface Customer {
  customer_id: string
  customer_name: string
  /** Boleh kosong kalau pelanggan belum punya CAR. */
  car_id: string
  notes: string
  created_at: string
  updated_at: string
  version: number
}

// ---------- Aset ----------

export interface Device {
  device_id: string
  asset_category: AssetCategory
  /** Kosong untuk aset Personal. */
  customer_id: string
  hostname: string
  /** Wajib alamat IP yang sah. */
  ip_address: string
  /** Opsional; hanya untuk perangkat yang diakses lewat alamat web. */
  url: string
  device_type_code: string
  device_model: string
  brand_code: string
  serial_number: string
  software_version: string
  /** Format YYYY-MM-DD. Boleh kosong. */
  start_license: string
  /** Format YYYY-MM-DD. Dasar perhitungan pengingat lisensi. */
  end_license: string
  lokasi: string
  status: DeviceStatus
  notes: string
  created_at: string
  created_by: string
  updated_at: string
  updated_by: string
  /** Optimistic lock — naik setiap perubahan. */
  version: number
}

/** Kredensial TANPA isi rahasianya. Ini yang boleh dikirim ke layar. */
export interface CredentialMeta {
  credential_id: string
  device_id: string
  cred_type: CredType
  username: string
  port: number
  /** "ingatan" | "dari perangkat" | "import" | "netcare" */
  source: string
  /** Kosong berarti belum pernah diuji benar-benar bisa dipakai. */
  verified_at: string
  notes: string
  updated_at: string
  updated_by: string
}

// ---------- Pengguna & catatan ----------

export interface User {
  email: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: string
  created_by: string
  last_login_at: string
  version: number
}

export interface AuditEntry {
  ts: string
  actor_email: string
  action: string
  object_type: string
  object_id: string
  field: string
  /** "ok" | "denied" | "error" */
  result: string
  ip: string
  user_agent: string
  /** Ringkasan saja. JANGAN PERNAH mengisi password di sini. */
  detail: string
}

export interface Setting {
  key: string
  /** Terenkripsi kalau is_secret = true. */
  value_enc: string
  is_secret: boolean
  updated_at: string
  updated_by: string
}

export interface AlertLogEntry {
  ts: string
  device_id: string
  license_end: string
  threshold_days: number
  channel: string
  /** "sent" | "failed" */
  status: string
  error: string
  message_id: string
}

// ---------- Penyimpanan ----------

export interface DeviceFilter {
  category?: AssetCategory
  search?: string
  brand_code?: string
  device_type_code?: string
  customer_id?: string
  car_id?: string
  status?: DeviceStatus
  lokasi?: string
}

export interface NewCredential {
  credential_id?: string
  device_id: string
  cred_type: CredType
  username: string
  /** Plaintext — hanya sesaat di memori, langsung dienkripsi sebelum disimpan. */
  secret: string
  port: number
  notes: string
}

/**
 * Sekat penyimpanan.
 *
 * Seluruh aplikasi hanya berbicara lewat interface ini. Karena itu penyimpanan
 * bisa ditukar (misalnya dari spreadsheet ke basis data sungguhan) tanpa
 * menyentuh tampilan maupun alur kerja.
 */
export interface Repo {
  // Aset
  listDevices(filter?: DeviceFilter): Promise<Device[]>
  getDevice(deviceId: string): Promise<Device | null>
  createDevice(data: Partial<Device>, actor: string): Promise<Device>
  updateDevice(
    deviceId: string,
    patch: Partial<Device>,
    expectedVersion: number,
    actor: string,
  ): Promise<Device>
  deleteDevice(deviceId: string, actor: string): Promise<void>

  // Kredensial
  listCredentials(deviceId?: string): Promise<CredentialMeta[]>
  putCredential(data: NewCredential, actor: string): Promise<CredentialMeta>
  /** Hanya dipanggil oleh alur reveal yang sudah lolos pemeriksaan. */
  getCredentialSecret(
    credentialId: string,
  ): Promise<{ username: string; secret: string } | null>
  markCredentialVerified(credentialId: string, actor: string): Promise<void>
  deleteCredential(credentialId: string, actor: string): Promise<void>

  // Katalog
  listBrands(): Promise<Brand[]>
  listDeviceTypes(): Promise<DeviceType[]>
  putBrand(data: Partial<Brand>): Promise<Brand>
  putDeviceType(data: Partial<DeviceType>): Promise<DeviceType>

  // Pelanggan & CAR
  listCars(): Promise<Car[]>
  listCustomers(): Promise<Customer[]>
  putCar(data: Partial<Car>): Promise<Car>
  putCustomer(data: Partial<Customer>): Promise<Customer>

  // Pengguna
  listUsers(): Promise<User[]>
  getUser(email: string): Promise<User | null>
  putUser(data: Partial<User>, actor: string): Promise<User>

  // Pengaturan
  getSetting(key: string): Promise<Setting | null>
  listSettings(): Promise<Setting[]>
  putSetting(key: string, value: string, isSecret: boolean, actor: string): Promise<void>

  // Catatan
  appendAudit(entry: Partial<AuditEntry>): Promise<void>
  listAudit(limit?: number): Promise<AuditEntry[]>
  appendAlertLog(entry: Partial<AlertLogEntry>): Promise<void>
  listAlertLog(limit?: number): Promise<AlertLogEntry[]>
}
