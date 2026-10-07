'use client'

import { useActionState, useState } from 'react'
import { confirmTotpSetup, startTotpSetup, type TotpSetupState } from '@/lib/actions/security'
import { EMPTY_ACTION } from '@/lib/actions/types'
import FormField from './form-field'

export default function TotpSetup({ active }: { active: boolean }) {
  const [setup, setSetup] = useState<TotpSetupState | null>(null)
  const [starting, setStarting] = useState(false)
  const [state, action, pending] = useActionState(confirmTotpSetup, EMPTY_ACTION)

  async function start() {
    setStarting(true)
    try {
      const result = await startTotpSetup()
      setSetup(result)
    } finally {
      setStarting(false)
    }
  }

  if (active && state.ok !== false) {
    return (
      <div className="notice notice-info">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Verifikasi dua langkah aktif.</strong> Membuka password memerlukan kode 6 digit.
          Sekali dimasukkan, kode itu berlaku 5 menit.
          {state.message ? <div style={{ marginTop: 6 }}>{state.message}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <>
      {state.message && !state.ok ? (
        <div className="notice notice-warn">
          <span aria-hidden="true">⚠</span>
          <div>{state.message}</div>
        </div>
      ) : null}

      {!setup ? (
        <>
          <p className="dim" style={{ fontSize: 14 }}>
            Verifikasi dua langkah belum dipasang, sehingga password belum bisa dibuka. Lapisan ini
            yang membuat orang yang sudah berada di dalam sesi login Anda tetap tidak bisa menguras
            password perangkat.
          </p>
          <div className="actions">
            <button className="btn btn-primary" type="button" onClick={start} disabled={starting}>
              {starting ? 'Menyiapkan…' : 'Pasang verifikasi dua langkah'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="dim" style={{ fontSize: 14 }}>
            Buka aplikasi authenticator Anda, pilih <strong>masukkan kunci secara manual</strong>,
            lalu isi keterangan berikut.
          </p>

          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <td className="dim" style={{ width: 150 }}>Nama akun</td>
                  <td className="mono">netinv</td>
                </tr>
                <tr>
                  <td className="dim">Kunci</td>
                  <td className="mono" style={{ wordBreak: 'break-all' }}>{setup.secret}</td>
                </tr>
                <tr>
                  <td className="dim">Jenis</td>
                  <td className="dim">Berbasis waktu (TOTP) · 6 angka · 30 detik</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="notice notice-warn" style={{ marginTop: 14 }}>
            <span aria-hidden="true">⚠</span>
            <div>
              Kunci ini sama pentingnya dengan password. Jangan difoto, jangan dikirim ke mana pun,
              dan jangan disimpan di berkas yang bisa terbaca orang lain.
            </div>
          </div>

          <form action={action} style={{ marginTop: 16 }}>
            <div className="form-grid">
              <FormField
                label="Kode 6 digit dari aplikasi"
                name="code"
                required
                error={state.errors?.code}
                hint="Diisi untuk memastikan kuncinya benar-benar tersalin dengan tepat"
              >
                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                />
              </FormField>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? 'Memeriksa…' : 'Aktifkan'}
                </button>
              </div>
            </div>
          </form>
        </>
      )}
    </>
  )
}
