/**
 * Validasi masukan.
 *
 * Prinsipnya: lebih baik menolak dengan pesan yang jelas daripada menyimpan data
 * yang salah. Alamat IP yang salah tetapi tetap tersimpan baru terasa akibatnya
 * saat perangkat darurat harus diakses — dan pada saat itu sudah terlambat untuk
 * memperbaikinya.
 *
 * Validasi ini dipasang di dua tempat: di aplikasi (menolak saat menyimpan) dan
 * di penyimpanan (validasi sel), supaya data tetap terjaga meski ada yang
 * mengedit langsung di spreadsheet-nya.
 */

export const PESAN = {
  wajib: 'Wajib diisi',
  ipFormat: 'Alamat IP harus seperti 10.10.1.1 — huruf tidak bisa dipakai di sini',
  urlFormat: 'URL harus lengkap, contoh: https://10.10.1.1:8443',
  hostnameFormat: 'Hostname hanya boleh huruf, angka, titik, dan tanda hubung',
  hostnameWajib: 'Hostname wajib diisi',
  serialFormat: 'Nomor seri tidak boleh memuat spasi',
  teleponFormat: 'Nomor HP hanya boleh angka, boleh memakai +, spasi, dan tanda hubung',
  tanggalFormat: 'Tanggal harus dalam bentuk YYYY-MM-DD',
  urutanTanggal: 'Tanggal berakhir tidak boleh lebih awal dari tanggal mulai',
  kategoriWajib: 'Kategori aset wajib dipilih: Personal atau Customer',
  pelangganWajib: 'Aset Customer wajib punya pelanggan',
  brandWajib: 'Brand wajib dipilih',
} as const

export type FieldErrors = Record<string, string>

// ---------- Alamat IP ----------

export function isIpv4(value: string): boolean {
  const parts = value.split('.')
  if (parts.length !== 4) return false
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false
    // Tolak angka dengan nol di depan: "010" ambigu dan sering jadi sumber salah.
    if (part.length > 1 && part.startsWith('0')) return false
    const n = Number(part)
    return n >= 0 && n <= 255
  })
}

const IPV6_PATTERN =
  /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/

export function isIpv6(value: string): boolean {
  return IPV6_PATTERN.test(value)
}

export function isIpAddress(value: string): boolean {
  return isIpv4(value) || isIpv6(value)
}

// ---------- URL ----------

/**
 * Hanya menerima http:// atau https:// yang lengkap dengan host.
 * "10.10.1.1" saja bukan URL — itu alamat IP, tempatnya di kolom ip_address.
 */
export function isUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false
  try {
    const parsed = new URL(value)
    return parsed.hostname.length > 0
  } catch {
    return false
  }
}

// ---------- Kolom lain ----------

export function isHostname(value: string): boolean {
  if (value.length === 0 || value.length > 253) return false
  return /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(value)
}

export function isSerialNumber(value: string): boolean {
  return value.length > 0 && !/\s/.test(value)
}

export function isPhone(value: string): boolean {
  return value.length > 0 && /^[+0-9][0-9\s-]*$/.test(value)
}

/** Memeriksa bentuk sekaligus memastikan tanggalnya benar-benar ada di kalender. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12) return false
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day >= 1 && day <= daysInMonth
}

export function isIsoDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)) return false
  return !Number.isNaN(Date.parse(value))
}

// ---------- Kode katalog ----------

/** Merapikan kode: huruf kecil, spasi jadi garis bawah. */
export function normalizeCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

// ---------- Validasi satu perangkat ----------

export interface DeviceInput {
  asset_category?: string
  customer_id?: string
  hostname?: string
  ip_address?: string
  url?: string
  brand_code?: string
  device_type_code?: string
  device_model?: string
  serial_number?: string
  software_version?: string
  start_license?: string
  end_license?: string
  lokasi?: string
  status?: string
  notes?: string
}

const DATE_FIELDS = ['start_license', 'end_license'] as const

export function validateDeviceInput(input: DeviceInput): FieldErrors {
  const errors: FieldErrors = {}

  if (input.asset_category !== 'personal' && input.asset_category !== 'customer') {
    errors.asset_category = PESAN.kategoriWajib
  }

  // Aset Personal tidak punya pelanggan. Aset Customer wajib punya.
  if (input.asset_category === 'customer' && !input.customer_id?.trim()) {
    errors.customer_id = PESAN.pelangganWajib
  }

  const hostname = input.hostname?.trim() ?? ''
  if (!hostname) errors.hostname = PESAN.hostnameWajib
  else if (!isHostname(hostname)) errors.hostname = PESAN.hostnameFormat

  const ip = input.ip_address?.trim() ?? ''
  if (!ip) errors.ip_address = PESAN.wajib
  else if (!isIpAddress(ip)) errors.ip_address = PESAN.ipFormat

  const url = input.url?.trim() ?? ''
  if (url && !isUrl(url)) errors.url = PESAN.urlFormat

  if (!input.brand_code?.trim()) errors.brand_code = PESAN.brandWajib

  const serial = input.serial_number?.trim() ?? ''
  if (serial && !isSerialNumber(serial)) errors.serial_number = PESAN.serialFormat

  for (const field of DATE_FIELDS) {
    const value = input[field]?.trim() ?? ''
    if (value && !isIsoDate(value)) errors[field] = PESAN.tanggalFormat
  }

  const start = input.start_license?.trim() ?? ''
  const end = input.end_license?.trim() ?? ''
  if (!errors.start_license && !errors.end_license && start && end && end < start) {
    errors.end_license = PESAN.urutanTanggal
  }

  return errors
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}
