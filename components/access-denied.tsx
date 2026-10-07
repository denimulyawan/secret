import Link from 'next/link'

export default function AccessDenied({
  message,
  backHref = '/',
  backLabel = 'Kembali',
}: {
  message: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="card">
      <div className="empty">
        <div className="empty-icon" aria-hidden="true">
          ⛔
        </div>
        <p className="empty-title">Tidak punya akses</p>
        <p className="empty-text">{message}</p>
        <div className="actions" style={{ justifyContent: 'center' }}>
          <Link className="btn" href={backHref}>
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
