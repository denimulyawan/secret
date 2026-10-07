import { CarForm, CustomerForm } from '@/components/customer-forms'
import { assignCar, removeCar, removeCustomer } from '@/lib/actions/customers'
import { getRepo } from '@/lib/repo'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Pelanggan & CAR — netinv' }

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ pesan?: string }>
}) {
  await requireUser()
  const repo = getRepo()
  const params = await searchParams

  const [cars, customers, devices] = await Promise.all([
    repo.listCars(),
    repo.listCustomers(),
    repo.listDevices(),
  ])

  const carById = new Map(cars.map((c) => [c.car_id, c]))

  const customersByCar = new Map<string, number>()
  for (const customer of customers) {
    if (!customer.car_id) continue
    customersByCar.set(customer.car_id, (customersByCar.get(customer.car_id) ?? 0) + 1)
  }

  const devicesByCustomer = new Map<string, number>()
  for (const device of devices) {
    if (!device.customer_id) continue
    devicesByCustomer.set(
      device.customer_id,
      (devicesByCustomer.get(device.customer_id) ?? 0) + 1,
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pelanggan &amp; CAR</h1>
          <p className="page-sub">CAR adalah nama orang yang dihubungi beserta nomor HP-nya</p>
        </div>
      </div>

      {params.pesan ? (
        <div className="notice notice-info">
          <span aria-hidden="true">ℹ</span>
          <div>{params.pesan}</div>
        </div>
      ) : null}

      <div className="notice notice-info">
        <span aria-hidden="true">ℹ</span>
        <div>
          Satu CAR biasanya menangani <strong>beberapa pelanggan</strong>. Karena nomornya disimpan
          pada orangnya — bukan diulang di setiap pelanggan — mengganti nomor HP cukup mengubah{' '}
          <strong>satu</strong> baris, dan seluruh pelanggannya ikut terbarui.
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Tambah CAR</h2>
        <CarForm />
      </div>

      <div className="card">
        <h2 className="section-title">CAR terdaftar ({cars.length})</h2>
        {cars.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 14 }}>
            Belum ada CAR. Tambahkan orang yang biasa Anda hubungi untuk urusan perangkat pelanggan.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Nomor HP</th>
                  <th>Pelanggan ditangani</th>
                  <th>Catatan</th>
                  <th className="right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {cars.map((car) => {
                  const handled = customersByCar.get(car.car_id) ?? 0
                  return (
                    <tr key={car.car_id}>
                      <td>{car.car_name}</td>
                      <td className="mono">{car.car_phone}</td>
                      <td className="dim">{handled}</td>
                      <td className="dim">{car.notes || '—'}</td>
                      <td className="right">
                        <form action={removeCar}>
                          <input type="hidden" name="car_id" value={car.car_id} />
                          <button className="btn btn-danger" type="submit">
                            Hapus
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Tambah pelanggan</h2>
        <CustomerForm cars={cars} />
      </div>

      <div className="card">
        <h2 className="section-title">Pelanggan terdaftar ({customers.length})</h2>
        {customers.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 14 }}>
            Belum ada pelanggan. Pelanggan diperlakukan sebagai data tersendiri agar nama yang salah
            ketik tidak membuat penyaringan data jadi kacau.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama pelanggan</th>
                  <th>CAR</th>
                  <th>Perangkat</th>
                  <th className="right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const car = customer.car_id ? carById.get(customer.car_id) : undefined
                  const count = devicesByCustomer.get(customer.customer_id) ?? 0
                  return (
                    <tr key={customer.customer_id}>
                      <td>{customer.customer_name}</td>
                      <td>
                        <form action={assignCar} style={{ display: 'flex', gap: 8 }}>
                          <input type="hidden" name="customer_id" value={customer.customer_id} />
                          <select name="car_id" defaultValue={customer.car_id} aria-label="CAR">
                            <option value="">— belum ditentukan —</option>
                            {cars.map((option) => (
                              <option key={option.car_id} value={option.car_id}>
                                {option.car_name}
                              </option>
                            ))}
                          </select>
                          <button className="btn" type="submit">
                            Simpan
                          </button>
                        </form>
                        {car ? (
                          <div className="faint mono" style={{ marginTop: 4 }}>
                            {car.car_phone}
                          </div>
                        ) : null}
                      </td>
                      <td className="dim">{count}</td>
                      <td className="right">
                        <form action={removeCustomer}>
                          <input type="hidden" name="customer_id" value={customer.customer_id} />
                          <button className="btn btn-danger" type="submit">
                            Hapus
                          </button>
                        </form>
                      </td>
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
