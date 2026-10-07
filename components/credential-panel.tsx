'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import {
  deleteCredentialAction,
  generatePassword,
  revealCredential,
  saveCredential,
  type RevealState,
} from '@/lib/actions/credentials'
import { EMPTY_ACTION } from '@/lib/actions/types'
import type { CredentialMeta } from '@/lib/repo/types'
import FormField from './form-field'

const EMPTY_REVEAL: RevealState = { ok: false }

function RevealBox({ state }: { state: RevealState }) {
  const [seconds, setSeconds] = useState(30)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Password tampil 30 detik, lalu sembunyi sendiri.
  useEffect(() => {
    if (!state.ok || !state.secret) return
    setSeconds(30)
    setCopied(false)
    timer.current = setInterval(() => {
      setSeconds((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [state.ok, state.secret])

  if (!state.ok || !state.secret) return null
  if (seconds === 0) {
    return <p className="faint" style={{ marginTop: 10 }}>Password disembunyikan otomatis.</p>
  }

  async function copy() {
    if (!state.secret) return
    try {
      await navigator.clipboard.writeText(state.secret)
      setCopied(true)
      // Salinan di papan klip dibersihkan sendiri setelah 60 detik.
      setTimeout(() => {
        navigator.clipboard.writeText('').catch(() => undefined)
      }, 60_000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="notice notice-warn" style={{ marginTop: 12, alignItems: 'center' }}>
      <span aria-hidden="true">🔑</span>
      <div style={{ flex: 1 }}>
        <div className="mono" style={{ fontSize: 15, wordBreak: 'break-all' }}>
          {state.secret}
        </div>
        <div className="faint" style={{ marginTop: 4 }}>
          Tersembunyi sendiri dalam {seconds} detik{copied ? ' · sudah disalin' : ''}
        </div>
      </div>
      <button className="btn" type="button" onClick={copy}>
        {copied ? 'Tersalin' : 'Salin'}
      </button>
    </div>
  )
}

export default function CredentialPanel({
  deviceId,
  credentials,
  canReveal,
  stepUpReady,
}: {
  deviceId: string
  credentials: CredentialMeta[]
  canReveal: boolean
  stepUpReady: boolean
}) {
  const [saveState, saveAction, saving] = useActionState(saveCredential, EMPTY_ACTION)
  const [revealState, revealAction, revealing] = useActionState(revealCredential, EMPTY_REVEAL)
  const [openForm, setOpenForm] = useState(credentials.length === 0)
  const [generated, setGenerated] = useState('')
  // Kredensial mana yang sedang diminta kodenya. Tanpa ini, formulir kode akan
  // selalu mengirim kredensial pertama — dan membuka password yang salah.
  const [pendingId, setPendingId] = useState('')

  async function fillGenerated() {
    const value = await generatePassword()
    setGenerated(value)
  }

  return (
    <>
      <div className="card">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Kredensial ({credentials.length})
          </h2>
          <button className="btn" type="button" onClick={() => setOpenForm((v) => !v)}>
            {openForm ? 'Tutup' : '+ Tambah kredensial'}
          </button>
        </div>

        {!stepUpReady ? (
          <div className="notice notice-warn">
            <span aria-hidden="true">⚠</span>
            <div>
              Verifikasi dua langkah belum dipasang, jadi password belum bisa dibuka. Pasang dulu
              di <strong>Setting → Keamanan</strong>.
            </div>
          </div>
        ) : null}

        {credentials.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 14 }}>
            Belum ada kredensial untuk perangkat ini. Tambahkan username dan passwordnya, lalu
            segera uji dengan mencoba masuk ke perangkatnya.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Password</th>
                  <th>Port</th>
                  <th>Keadaan</th>
                  <th className="right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((cred) => (
                  <tr key={cred.credential_id}>
                    <td className="mono">{cred.username || <span className="faint">—</span>}</td>
                    <td className="mono">••••••••</td>
                    <td className="dim">{cred.port || '—'}</td>
                    <td>
                      {cred.verified_at ? (
                        <span className="badge badge-ok">✓ terverifikasi</span>
                      ) : (
                        <span className="badge badge-warn">⚠ belum diuji</span>
                      )}
                    </td>
                    <td className="right">
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <form
                          action={revealAction}
                          onSubmit={() => setPendingId(cred.credential_id)}
                        >
                          <input type="hidden" name="credential_id" value={cred.credential_id} />
                          <button className="btn" type="submit" disabled={revealing || !canReveal || !stepUpReady}>
                            {revealing ? 'Membuka…' : 'Buka password'}
                          </button>
                        </form>
                        <form action={deleteCredentialAction}>
                          <input type="hidden" name="credential_id" value={cred.credential_id} />
                          <input type="hidden" name="device_id" value={deviceId} />
                          <button className="btn btn-danger" type="submit">
                            Hapus
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Permintaan kode 6 digit */}
        {revealState.needCode ? (
          <form action={revealAction} style={{ marginTop: 16 }}>
            <input type="hidden" name="credential_id" value={pendingId} />
            <FormField
              label="Kode 6 digit"
              name="code"
              required
              error={revealState.ok ? undefined : revealState.message}
              hint="Dari aplikasi authenticator. Sekali dimasukkan, berlaku 5 menit."
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
            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={revealing}>
                {revealing ? 'Memeriksa…' : 'Buka'}
              </button>
            </div>
          </form>
        ) : null}

        {revealState.message && !revealState.needCode ? (
          <div className="notice notice-warn" style={{ marginTop: 14 }}>
            <span aria-hidden="true">⚠</span>
            <div>{revealState.message}</div>
          </div>
        ) : null}

        <RevealBox state={revealState} />
      </div>

      {openForm ? (
        <div className="card">
          <h2 className="section-title">Tambah kredensial</h2>

          {saveState.message ? (
            <div className={saveState.ok ? 'notice notice-info' : 'notice notice-warn'}>
              <span aria-hidden="true">{saveState.ok ? '✓' : '⚠'}</span>
              <div>{saveState.message}</div>
            </div>
          ) : null}

          <form action={saveAction}>
            <input type="hidden" name="device_id" value={deviceId} />
            <div className="form-grid">
              <FormField label="Username" name="username" hint="Boleh dikosongkan kalau tidak dipakai">
                <input id="username" name="username" type="text" autoComplete="off" spellCheck={false} />
              </FormField>

              <FormField
                label="Password"
                name="secret"
                required
                error={saveState.errors?.secret}
                hint="Disimpan dalam keadaan terenkripsi. Tidak pernah ditampilkan lagi kecuali lewat tombol Buka password."
              >
                <input
                  id="secret"
                  name="secret"
                  type="text"
                  required
                  value={generated}
                  onChange={(event) => setGenerated(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </FormField>

              <FormField label="Port" name="port" error={saveState.errors?.port} hint="Misalnya 22 atau 443">
                <input id="port" name="port" type="number" min={1} max={65535} inputMode="numeric" />
              </FormField>

              <FormField label="Catatan" name="notes" hint="Keterangan tambahan">
                <input id="notes" name="notes" type="text" autoComplete="off" />
              </FormField>
            </div>

            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Menyimpan…' : 'Simpan kredensial'}
              </button>
              <button className="btn" type="button" onClick={fillGenerated}>
                Buatkan password kuat
              </button>
            </div>
          </form>

          <p className="faint" style={{ marginTop: 14 }}>
            Setelah tersimpan, segera uji dengan mencoba masuk ke perangkatnya. Password yang salah
            tetapi tercatat rapi lebih berbahaya daripada tidak ada catatan sama sekali, karena
            akan dipercaya sampai saat darurat.
          </p>
        </div>
      ) : null}
    </>
  )
}
