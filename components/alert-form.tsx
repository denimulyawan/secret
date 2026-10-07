'use client'

import { useActionState } from 'react'
import { saveAlertSettings } from '@/lib/actions/security'
import { EMPTY_ACTION } from '@/lib/actions/types'
import FormField from './form-field'

export interface AlertValues {
  chatId: string
  daysBefore: string
  time: string
  mode: string
  enabled: boolean
  hasToken: boolean
}

export default function AlertForm({ values }: { values: AlertValues }) {
  const [state, action, pending] = useActionState(saveAlertSettings, EMPTY_ACTION)

  return (
    <form action={action}>
      {state.message ? (
        <div className={state.ok ? 'notice notice-info' : 'notice notice-warn'}>
          <span aria-hidden="true">{state.ok ? '✓' : '⚠'}</span>
          <div>{state.message}</div>
        </div>
      ) : null}

      <div className="form-grid">
        <FormField
          label="Token bot Telegram"
          name="telegram_bot_token"
          error={state.errors?.telegram_bot_token}
          hint={
            values.hasToken
              ? 'Token sudah tersimpan dan terenkripsi. Biarkan kosong kalau tidak ingin menggantinya.'
              : 'Dari @BotFather. Disimpan dalam keadaan terenkripsi.'
          }
        >
          <input
            id="telegram_bot_token"
            name="telegram_bot_token"
            type="password"
            autoComplete="off"
            spellCheck={false}
          />
        </FormField>

        <FormField
          label="ID chat / grup tujuan"
          name="telegram_chat_id"
          error={state.errors?.telegram_chat_id}
          hint="Tempat ringkasan lisensi dikirim"
        >
          <input
            id="telegram_chat_id"
            name="telegram_chat_id"
            type="text"
            defaultValue={values.chatId}
            autoComplete="off"
            spellCheck={false}
          />
        </FormField>

        <FormField
          label="Ambang hari"
          name="alert_days_before"
          error={state.errors?.alert_days_before}
          hint="Angka hari dipisahkan koma. Contoh: 90,60,30,7 — diingatkan 3 bulan, 2 bulan, 1 bulan, dan 1 minggu sebelum habis"
        >
          <input
            id="alert_days_before"
            name="alert_days_before"
            type="text"
            defaultValue={values.daysBefore}
            autoComplete="off"
          />
        </FormField>

        <FormField
          label="Jam kirim"
          name="alert_time"
          error={state.errors?.alert_time}
          hint="Satu kali sehari, format HH:MM dalam zona waktu WIB"
        >
          <input
            id="alert_time"
            name="alert_time"
            type="time"
            defaultValue={values.time}
          />
        </FormField>

        <FormField
          label="Bentuk pengiriman"
          name="alert_mode"
          hint="Ringkasan harian lebih disarankan — satu pesan berisi semua lisensi yang masuk ambang"
        >
          <select id="alert_mode" name="alert_mode" defaultValue={values.mode}>
            <option value="digest">Ringkasan harian — satu pesan per hari</option>
            <option value="per_license">Satu pesan per lisensi</option>
          </select>
        </FormField>

        <div className="field">
          <label htmlFor="alert_enabled">Saklar alert</label>
          <label className="dim" style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id="alert_enabled"
              name="alert_enabled"
              type="checkbox"
              defaultChecked={values.enabled}
              style={{ minHeight: 'auto', width: 18, height: 18 }}
            />
            Kirim pengingat lisensi
          </label>
          <span className="hint">
            Bisa dimatikan sementara tanpa menghapus pengaturannya — misalnya saat sedang cuti.
          </span>
        </div>
      </div>

      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan pengaturan'}
        </button>
      </div>
    </form>
  )
}
