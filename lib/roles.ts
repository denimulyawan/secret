/**
 * Aturan hak akses.
 *
 * Dua role:
 *   - Administrator : akses penuh, termasuk aset Personal.
 *   - Engineer      : akses aset Customer saja. Aset Personal tidak terlihat.
 *
 * PENTING — aturan ini harus diperiksa di SERVER pada setiap permintaan, bukan
 * hanya dengan menyembunyikan menu. Kalau hanya menunya yang disembunyikan, orang
 * yang tahu alamatnya bisa membuka langsung lewat URL atau menarik datanya lewat
 * permintaan langsung. Berkas ini dipakai oleh pemeriksa di sisi server.
 */

import type { AssetCategory, Role } from './repo/types'

export const ROLE_LABEL: Record<Role, string> = {
  administrator: 'Administrator',
  engineer: 'Engineer',
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  administrator: 'Akses penuh, termasuk aset Personal',
  engineer: 'Akses aset Customer saja',
}

/** Satu-satunya tempat yang menentukan boleh-tidaknya melihat sebuah kategori. */
export function canSeeCategory(role: Role, category: AssetCategory): boolean {
  if (role === 'administrator') return true
  return category === 'customer'
}

export function canManageUsers(role: Role): boolean {
  return role === 'administrator'
}

export function canManageAlert(role: Role): boolean {
  return role === 'administrator'
}

export function canRevealSecret(role: Role, category: AssetCategory): boolean {
  return canSeeCategory(role, category)
}

/** Menu yang boleh tampil di sidebar untuk role tertentu. */
export function visibleCategories(role: Role): AssetCategory[] {
  return role === 'administrator' ? ['personal', 'customer'] : ['customer']
}

export class AccessDeniedError extends Error {
  constructor(message = 'Anda tidak punya akses ke bagian ini.') {
    super(message)
    this.name = 'AccessDeniedError'
  }
}

/**
 * Dijalankan di sisi server. Melempar AccessDeniedError kalau role tidak berhak.
 * Pemanggil wajib mencatat penolakan ini ke catatan audit.
 */
export function assertCanSeeCategory(role: Role, category: AssetCategory): void {
  if (!canSeeCategory(role, category)) {
    throw new AccessDeniedError(
      'Role Engineer tidak punya akses ke aset Personal.',
    )
  }
}
