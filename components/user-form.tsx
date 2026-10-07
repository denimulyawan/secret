'use client'

import { useActionState } from 'react'
import { EMPTY_ACTION } from '@/lib/actions/types'
import { saveUser } from '@/lib/actions/users'
import FormField from './form-field'

export default function UserForm() {
  const [state, action, pending] = useActionState(saveUser, EMPTY_ACTION)

  return (
    <form action={action} className="form-grid">
      {state.message ? (
        <div
          className={state.ok ? 'notice notice-info' : 'notice notice-warn'}
          style={{ gridColumn: '1 / -1' }}
        >
          <span aria-hidden="true">{state.ok ? '✓' : '⚠'}</span>
          <div>{state.message}</div>
        </div>
      ) : null}

      <FormField
        label="Alamat email Google"
        name="email"
        required
        error={state.errors?.email}
        hint="Alamat yang benar-benar dipakai orang itu untuk masuk"
      >
        <input id="email" name="email" type="email" required autoComplete="off" spellCheck={false} />
      </FormField>

      <FormField label="Nama" name="full_name" hint="Nama yang tampil di layar">
        <input id="full_name" name="full_name" type="text" autoComplete="off" />
      </FormField>

      <FormField
        label="Role"
        name="role"
        required
        hint="Administrator = akses penuh · Engineer = tidak bisa melihat aset Personal"
      >
        <select id="role" name="role" defaultValue="engineer">
          <option value="engineer">Engineer — tanpa akses aset Personal</option>
          <option value="administrator">Administrator — akses penuh</option>
        </select>
      </FormField>

      <div className="field" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Tambah pengguna'}
        </button>
      </div>
    </form>
  )
}
