import { getRepo } from '@/lib/repo'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Pelanggan & CAR — netinv' }

export default async function CustomersPage() {
  await requireUser()
  const repo = getRepo()
  const [cars, customers] = await Promise.all([repo.listCars(), repo.listCustomers()])

  const carById = new Map(cars.map((c) => [c.car_id, c]))
  const devices = await repo.listDevices()
  const countByCustomer = new Map<string, number>()
  for (const d of devices) {
    if (!d.customer_id) continue
    countByCustomer.set(d.customer_id, (countByCustomer.get(d.customer_id) ?? 0) + 1)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pelanggan &amp; CAR</h1>
          <p className="page-sub">
            CAR adalah nama orang yang dihubungi beserta nomor HP-nya
          </p>
        </div>
      </div>

      <div className="notice notice-info">
        <span aria-hidden="true">ℹ</span>
        <div>
          Satu CAR biasanya menangani <strong>beberapa pelanggan</strong>. Karena nomornya
          disimpan pada orangnya — bukan diulang di setiap pelanggan — mengganti nomor HP cukup
          mengubah <strong>satu</strong> baris, dan seluruh pelanggannya ikut terbarui.
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">CAR</h2>
        {cars.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 14 }}>
            Belum ada CAR. Tambahkan orang yang biasa Anda hubungi untuk urusan perangkat
            pelanggan.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Nomor HP</th>
                  <th>Jumlah pelanggan</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {cars.map((car) => {
                  const handled = customers.filter((c) => c.car_id === car.car_id).length
                  return (
                    <tr key={car.car_id}>
                      <td>{car.car_name}</td>
                      <td className="mono">{car.car_phone}</td>
                      <td className="dim">{handled}</td>
                      <td className="dim">{car.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Pelanggan</h2>
        {customers.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 14 }}>
            Belum ada pelanggan. Pelanggan diperlakukan sebagai data tersendiri agar nama yang
            salah ketik tidak membuat penyaringan data jadi kacau.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama pelanggan</th>
                  <th>CAR</th>
                  <th>Jumlah perangkat</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const car = c.car_id ? carById.get(c.car_id) : undefined
                  return (
                    <tr key={c.customer_id}>
                      <td>{c.customer_name}</td>
                      <td>
                        {car ? (
                          <>
                            {car.car_name} <span className="faint mono">{car.car_phone}</span>
                          </>
                        ) : (
                          <span className="faint">belum ada CAR</span>
                        )}
                      </td>
                      <td className="dim">{countByCustomer.get(c.customer_id) ?? 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
