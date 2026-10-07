import { getRepo } from '@/lib/repo'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Katalog — netinv' }

export default async function CatalogPage() {
  await requireUser()
  const repo = getRepo()
  const [brands, types] = await Promise.all([repo.listBrands(), repo.listDeviceTypes()])

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Katalog</h1>
          <p className="page-sub">
            Brand dan jenis perangkat — Anda tambah sendiri, tidak dipatok di dalam kode
          </p>
        </div>
      </div>

      <div className="notice notice-info">
        <span aria-hidden="true">ℹ</span>
        <div>
          <strong>Nonaktifkan, bukan hapus.</strong> Menghapus brand yang sudah dipakai membuat
          data perangkat lama kehilangan brandnya. Menonaktifkan hanya menyembunyikannya dari
          pilihan baru. Menghapus baru diizinkan kalau brand itu belum dipakai perangkat mana pun.
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Brand</h2>
        {brands.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 14 }}>
            Belum ada brand di katalog. Tambahkan brand pertama — misalnya FortiGate, Palo Alto,
            atau Cisco. Isi katalog ini lebih dulu supaya pengisian perangkat jadi lebih cepat.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Urutan</th>
                  <th>Keadaan</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.brand_code}>
                    <td className="mono">{b.brand_code}</td>
                    <td>{b.brand_name}</td>
                    <td className="dim">{b.sort_order}</td>
                    <td>
                      {b.is_active ? (
                        <span className="badge badge-ok">aktif</span>
                      ) : (
                        <span className="badge badge-plain">nonaktif</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Jenis perangkat</h2>
        {types.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 14 }}>
            Belum ada jenis perangkat. Contoh yang biasanya dipakai: firewall, router, switch,
            access point, modem/ONT, server.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Urutan</th>
                  <th>Keadaan</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t.type_code}>
                    <td className="mono">{t.type_code}</td>
                    <td>{t.type_name}</td>
                    <td className="dim">{t.sort_order}</td>
                    <td>
                      {t.is_active ? (
                        <span className="badge badge-ok">aktif</span>
                      ) : (
                        <span className="badge badge-plain">nonaktif</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
