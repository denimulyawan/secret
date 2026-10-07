/**
 * Susunan tab dan kolom.
 *
 * Nama tab dan nama kolom harus persis sama dengan yang ada di spreadsheet.
 * Aplikasi memeriksa hal ini saat pertama kali membaca, lalu BERHENTI dengan
 * pesan yang jelas kalau tidak cocok.
 *
 * Kenapa harus berhenti: bahaya terbesar memakai spreadsheet sebagai
 * penyimpanan adalah orang menyisipkan atau menghapus satu kolom, lalu semua
 * data bergeser satu kolom dan aplikasi menulis ke kolom yang salah — tanpa
 * pesan galat apa pun. Pemetaan berdasarkan NAMA kolom, ditambah pemeriksaan
 * ini, yang mencegahnya.
 */

export const TABS = {
  brands: ['brand_code', 'brand_name', 'is_active', 'sort_order', 'created_at'],
  device_types: ['type_code', 'type_name', 'is_active', 'sort_order', 'created_at'],
  cars: ['car_id', 'car_name', 'car_phone', 'notes', 'created_at', 'updated_at', 'version'],
  customers: ['customer_id', 'customer_name', 'car_id', 'notes', 'created_at', 'updated_at', 'version'],
  devices: [
    'device_id',
    'asset_category',
    'customer_id',
    'hostname',
    'ip_address',
    'url',
    'device_type_code',
    'device_model',
    'brand_code',
    'serial_number',
    'software_version',
    'start_license',
    'end_license',
    'lokasi',
    'status',
    'notes',
    'created_at',
    'created_by',
    'updated_at',
    'updated_by',
    'version',
  ],
  credentials: [
    'credential_id',
    'device_id',
    'cred_type',
    'username',
    'secret_enc',
    'key_version',
    'port',
    'source',
    'verified_at',
    'notes',
    'updated_at',
    'updated_by',
  ],
  sites: ['site_code', 'site_name', 'city', 'address', 'notes'],
  audit_log: [
    'ts',
    'actor_email',
    'action',
    'object_type',
    'object_id',
    'field',
    'result',
    'ip',
    'user_agent',
    'detail',
  ],
  users: [
    'email',
    'full_name',
    'role',
    'is_active',
    'created_at',
    'created_by',
    'last_login_at',
    'version',
  ],
  meta: ['schema_version', 'app_version', 'last_write_at'],
  settings: ['key', 'value_enc', 'is_secret', 'updated_at', 'updated_by'],
  alert_log: [
    'ts',
    'device_id',
    'license_end',
    'threshold_days',
    'channel',
    'status',
    'error',
    'message_id',
  ],
} as const

export type TabName = keyof typeof TABS

export const SCHEMA_VERSION = '1'

/** Kolom yang tidak boleh kosong. Kalau hilang, aplikasi berhenti. */
export const REQUIRED_HEADERS: Record<TabName, string[]> = {
  brands: ['brand_code', 'brand_name'],
  device_types: ['type_code', 'type_name'],
  cars: ['car_id', 'car_name'],
  customers: ['customer_id', 'customer_name'],
  devices: ['device_id', 'asset_category', 'hostname', 'ip_address', 'brand_code', 'version'],
  credentials: ['credential_id', 'device_id', 'secret_enc', 'key_version'],
  sites: ['site_code'],
  audit_log: ['ts', 'action'],
  users: ['email', 'role', 'is_active'],
  meta: ['schema_version'],
  settings: ['key', 'value_enc'],
  alert_log: ['ts', 'device_id', 'threshold_days'],
}

export function tabRange(tab: TabName, lastColumn?: string): string {
  const column = lastColumn ?? columnLetter(TABS[tab].length)
  return `${tab}!A:${column}`
}

/** Mengubah nomor kolom (1 = A) menjadi huruf kolom. */
export function columnLetter(index: number): string {
  let n = index
  let result = ''
  while (n > 0) {
    const remainder = (n - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

/** Rentang satu baris penuh, misalnya devices!A5:U5 */
export function rowRange(tab: TabName, rowNumber: number): string {
  return `${tab}!A${rowNumber}:${columnLetter(TABS[tab].length)}${rowNumber}`
}

/** Daftar nama tab, untuk dipakai di panduan dan pesan galat. */
export function tabNames(): TabName[] {
  return Object.keys(TABS) as TabName[]
}
