'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Role } from '@/lib/repo/types'
import { ROLE_LABEL } from '@/lib/roles'

interface MenuItem {
  href: string
  label: string
  icon: string
  /** Kalau diisi, menu hanya tampil untuk role tersebut. */
  onlyRole?: Role
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

const MENU: MenuGroup[] = [
  {
    label: '',
    items: [{ href: '/', label: 'Dashboard', icon: '▤' }],
  },
  {
    label: 'Asset',
    items: [
      { href: '/asset/personal', label: 'Personal', icon: '◆', onlyRole: 'administrator' },
      { href: '/asset/customer', label: 'Customer', icon: '◇' },
    ],
  },
  {
    label: 'Setting',
    items: [
      { href: '/setting/users', label: 'Pengguna', icon: '☺', onlyRole: 'administrator' },
      { href: '/setting/alert', label: 'Alert', icon: '◔', onlyRole: 'administrator' },
      { href: '/setting/catalog', label: 'Katalog', icon: '☰' },
      { href: '/setting/customers', label: 'Pelanggan & CAR', icon: '☏' },
      { href: '/setting/audit', label: 'Audit Log', icon: '◷' },
      { href: '/setting/system', label: 'Sistem', icon: '⚙' },
    ],
  },
]

const STORAGE_KEY = 'netinv.sidebar.collapsed'

/**
 * Kerangka halaman: menu di sisi kiri + isi halaman.
 *
 * Menu hanya DISEMBUNYIKAN di sini — ini kenyamanan tampilan, bukan pengamanan.
 * Penjagaan sebenarnya ada di sisi server, pada setiap permintaan (lib/roles.ts).
 */
export default function AppShell({
  role,
  children,
}: {
  role: Role
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Keadaan sidebar diingat: kalau ditutup, tetap tertutup saat dibuka lagi.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      /* penyimpanan browser tidak tersedia — pakai keadaan awal */
    }
  }, [])

  // Panel geser menutup sendiri setelah menu dipilih.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* abaikan */
      }
      return next
    })
  }

  const groups = MENU.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.onlyRole || item.onlyRole === role),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="shell">
      {/* Bar menu — hanya tampil di layar sempit */}
      <div className="mobile-bar">
        <button
          type="button"
          className="hamburger"
          aria-label="Buka menu"
          onClick={() => setMobileOpen(true)}
        >
          ☰
        </button>
        <span className="brand">netinv</span>
      </div>

      <div
        className={mobileOpen ? 'backdrop show' : 'backdrop'}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={['sidebar', collapsed ? 'collapsed' : '', mobileOpen ? 'mobile-open' : '']
          .filter(Boolean)
          .join(' ')}
      >
        <div className="sidebar-top">
          <button
            type="button"
            className="hamburger"
            aria-label={collapsed ? 'Munculkan menu' : 'Sembunyikan menu'}
            aria-expanded={!collapsed}
            onClick={toggleCollapsed}
          >
            ☰
          </button>
          <span className="brand">netinv</span>
        </div>

        <nav className="nav">
          {groups.map((group, index) => (
            <div className="nav-group" key={group.label || `grup-${index}`}>
              {group.label ? <div className="nav-group-label">{group.label}</div> : null}
              {group.items.map((item) => {
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active ? 'nav-item active' : 'nav-item'}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="nav-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="nav-label">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">Masuk sebagai {ROLE_LABEL[role]}</div>
      </aside>

      <main className="main">{children}</main>
    </div>
  )
}
