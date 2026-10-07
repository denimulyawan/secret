# Panduan Pemasangan

Panduan ini ditulis untuk dikerjakan berurutan. Tidak ada langkah yang perlu
diketahui lebih dulu — cukup ikuti urutannya.

**Perkiraan waktu:** sekitar 1 jam untuk pertama kali.

**Semua nilai yang perlu Anda isi ditulis sebagai `<...>`.** Ganti dengan milik
Anda sendiri. Jangan pernah menyalin nilai asli ke dalam berkas yang masuk repo.

---

## Urutan singkat

| # | Langkah | Perkiraan |
|---|---|---|
| 1 | Buat spreadsheet dan 12 tab | 10 menit |
| 2 | Aktifkan Google Sheets API dan buat akun layanan | 15 menit |
| 3 | Bagikan spreadsheet ke akun layanan | 2 menit |
| 4 | Buat kunci keamanan kredensial | 2 menit |
| 5 | Buat izin login Google | 10 menit |
| 6 | Jalankan di komputer sendiri | 5 menit |
| 7 | Pasang verifikasi dua langkah di aplikasi | 3 menit |
| 8 | Pasang di Vercel dan arahkan domain | 15 menit |

---

## 1. Buat spreadsheet dan 12 tab

1. Buka [sheets.new](https://sheets.new) — spreadsheet baru akan terbuka.
2. Beri nama, misalnya `Inventory Device`.
3. Buat 12 tab dengan nama **persis** seperti di bawah. Nama tab harus sama
   huruf besar-kecilnya.
4. Di **baris pertama setiap tab**, tempel baris judul di bawah. Cara paling
   mudah: salin satu baris, klik sel `A1` di tab itu, lalu tempel.

**Tab `brands`**

```
brand_code	brand_name	is_active	sort_order	created_at
```

**Tab `device_types`**

```
type_code	type_name	is_active	sort_order	created_at
```

**Tab `cars`**

```
car_id	car_name	car_phone	notes	created_at	updated_at	version
```

**Tab `customers`**

```
customer_id	customer_name	car_id	notes	created_at	updated_at	version
```

**Tab `devices`**

```
device_id	asset_category	customer_id	hostname	ip_address	url	device_type_code	device_model	brand_code	serial_number	software_version	start_license	end_license	lokasi	status	notes	created_at	created_by	updated_at	updated_by	version
```

**Tab `credentials`**

```
credential_id	device_id	cred_type	username	secret_enc	key_version	port	source	verified_at	notes	updated_at	updated_by
```

**Tab `sites`**

```
site_code	site_name	city	address	notes
```

**Tab `audit_log`**

```
ts	actor_email	action	object_type	object_id	field	result	ip	user_agent	detail
```

**Tab `users`**

```
email	full_name	role	is_active	created_at	created_by	last_login_at	version
```

**Tab `meta`**

```
schema_version	app_version	last_write_at
```

**Tab `settings`**

```
key	value_enc	is_secret	updated_at	updated_by
```

**Tab `alert_log`**

```
ts	device_id	license_end	threshold_days	channel	status	error	message_id
```

### Setelah semua tab dibuat

- **Proteksi baris pertama.** Pilih baris 1 di setiap tab → menu **Data** →
  **Protected sheets and ranges** → lindungi baris tersebut. Ini mencegah
  tersenggol tidak sengaja, yang akan membuat semua kolom bergeser.
- **Isi `meta`.** Di tab `meta`, isi baris kedua dengan `1`, `0.1.0`, dan
  tanggal hari ini. Ini penanda versi susunan.

> **Kenapa nama kolom harus persis:** aplikasi mencocokkan data berdasarkan
> **nama** kolom, bukan nomornya. Kalau ada kolom yang hilang, aplikasi
> **berhenti dan memberi tahu** — tidak diam-diam menulis ke kolom yang salah.
> Itu disengaja: lebih baik berhenti dengan pesan jelas daripada merusak data
> tanpa ketahuan.

---

## 2. Aktifkan Google Sheets API dan buat akun layanan

Bagian ini dilakukan di [Google Cloud Console](https://console.cloud.google.com/).

1. **Buat project.** Klik pemilih project di atas → **New Project** → beri nama
   misalnya `netinv` → **Create**. Tunggu sampai selesai, lalu pilih project itu.

2. **Aktifkan API.** Buka menu → **APIs & Services** → **Library**. Cari
   `Google Sheets API` → klik → **Enable**.

3. **Buat akun layanan.** Buka **APIs & Services** → **Credentials** →
   **Create credentials** → **Service account**.
   - Nama: `netinv-sheets`
   - Klik **Create and continue**, lalu **Done**. (Peran tidak perlu diisi di sini.)

4. **Buat kuncinya.** Klik akun layanan yang baru dibuat → tab **Keys** →
   **Add key** → **Create new key** → pilih **JSON** → **Create**.
   Sebuah berkas JSON akan terunduh. **Perlakukan berkas ini seperti password.**

5. **Catat dua nilai dari berkas JSON itu:**
   - `client_email` — misalnya `netinv-sheets@netinv-xxxxx.iam.gserviceaccount.com`
   - seluruh isi berkasnya, untuk diubah menjadi base64 di langkah 6.

---

## 3. Bagikan spreadsheet ke akun layanan

1. Buka spreadsheet Anda → tombol **Share** di kanan atas.
2. Tempel **`client_email`** dari langkah 2.
3. Beri akses **Editor**.
4. **Hilangkan centang "Notify people"** — akun layanan tidak membaca email.
5. Klik **Share**.

Pastikan juga akses umum spreadsheet tetap **Restricted** — hanya Anda dan akun
layanan.

> **Yang perlu Anda sadari:** Anda sendiri hanya bisa melihat isi kolom password
> dalam bentuk coretan yang tidak bisa dibaca. Itu memang tujuannya — kalau
> spreadsheet-nya terlihat orang lain, isinya tetap tidak berguna.

---

## 4. Buat kunci keamanan kredensial

Kunci ini yang membuka seluruh password yang tersimpan. Jalankan di terminal:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Salin hasilnya. **Simpan di dua tempat aman** — misalnya password manager dan
catatan tercetak di tempat terkunci.

> **Tidak ada pemulihan.** Kalau kunci ini hilang, semua password yang tersimpan
> menjadi tidak bisa dibuka selamanya, dan harus dicatat ulang satu per satu dari
> perangkatnya. Tidak ada "lupa password" dan tidak ada tukang kunci.

Sekaligus, buat kunci untuk menandatangani sesi login:

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## 5. Buat izin login Google

Masih di Google Cloud Console, project yang sama.

1. Buka **APIs & Services** → **OAuth consent screen**.
2. Pilih **External** → **Create**.
3. Isi nama aplikasi (misalnya `netinv`), email pendukung, dan email Anda.
4. Pada bagian **Test users**, tambahkan alamat email Anda sendiri.
   Selama aplikasi masih berstatus *Testing*, hanya email yang terdaftar di sini
   yang bisa masuk.
5. Simpan.
6. Buka **Credentials** → **Create credentials** → **OAuth client ID**.
   - Jenis: **Web application**
   - Nama: `netinv web`
   - **Authorized redirect URIs** — tambahkan dua alamat ini:
     ```
     http://localhost:3000/api/auth/callback
     https://<domain-anda>/api/auth/callback
     ```
     Ganti `<domain-anda>` dengan domain yang akan dipakai.
7. Klik **Create**. Catat **Client ID** dan **Client secret**.

---

## 6. Jalankan di komputer sendiri

1. Di folder proyek, salin `.env.example` menjadi `.env.local`.
2. Isi nilainya:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email dari langkah 2>
GOOGLE_PRIVATE_KEY_BASE64=<seluruh isi berkas JSON, dalam base64>
SHEET_ID=<bagian di antara /d/ dan /edit pada alamat spreadsheet>
APP_MASTER_KEY=<kunci dari langkah 4>
AUTH_SECRET=<kunci sesi dari langkah 4>
GOOGLE_OAUTH_CLIENT_ID=<client ID dari langkah 5>
GOOGLE_OAUTH_CLIENT_SECRET=<client secret dari langkah 5>
INITIAL_ADMIN_EMAIL=<email Google Anda>
CRON_SECRET=<rangkaian acak>
SESSION_TTL_HOURS=8
```

**Mengubah berkas JSON menjadi base64** (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\ke\service-account.json"))
```

Salin keluarannya ke `GOOGLE_PRIVATE_KEY_BASE64`.

3. Jalankan:

```
npm.cmd install
npm.cmd run dev
```

> Di PowerShell, perintah `npm` diblokir kebijakan eksekusi. Pakai **`npm.cmd`**
> seperti di atas.

4. Buka [http://localhost:3000](http://localhost:3000) dan masuk dengan Google.

### Kalau ada yang tidak beres

| Gejala | Penyebab yang paling sering |
|---|---|
| "Susunan spreadsheet belum sesuai" | Nama tab atau nama kolom tidak persis. Pesannya menyebut tab dan kolom mana yang bermasalah |
| "Gagal membaca spreadsheet" | Spreadsheet belum dibagikan ke `client_email`, atau aksesnya bukan Editor |
| "Gagal meminta token akses" | `GOOGLE_PRIVATE_KEY_BASE64` tidak lengkap, atau Google Sheets API belum diaktifkan |
| "APP_MASTER_KEY harus 32 byte" | Kunci terpotong saat disalin. Buat ulang, salin seluruhnya |
| Tombol masuk tidak bekerja | Alamat balikan belum terdaftar persis di OAuth client |
| "Email Anda belum terdaftar" | Tambahkan email itu di tab `users`, atau isi `INITIAL_ADMIN_EMAIL` dengan email Anda |

---

## 7. Pasang verifikasi dua langkah di aplikasi

Lakukan di dalam aplikasi, setelah berhasil masuk.

1. Buka **Setting → Keamanan**.
2. Klik **Pasang verifikasi dua langkah**.
3. Buka aplikasi authenticator di ponsel → **masukkan kunci secara manual** →
   isi nama akun `netinv` dan kunci yang ditampilkan di layar.
4. Isi kode 6 digit yang muncul untuk memastikan kuncinya benar tersalin.
5. Klik **Aktifkan**.

Setelah aktif, setiap pembukaan password memerlukan kode 6 digit. Sekali
dimasukkan, kode itu berlaku 5 menit.

---

## 8. Pasang di Vercel dan arahkan domain

1. **Buat repo GitHub** — **private**, kosong (tanpa README).
2. **Kirim kode.** Di folder proyek:

```
git remote add origin https://github.com/<akun-anda>/<nama-repo>.git
git push -u origin main
```

Jendela login GitHub akan muncul sendiri. Anda yang menyetujui.

3. **Di Vercel:** **Add New Project** → import repo itu → **Deploy**.
4. **Isi Environment Variables** — semuanya dari langkah 6, kecuali satu hal:

> ⚠️ **`DEV_AUTH_BYPASS` JANGAN diisi di Vercel.** Variabel itu hanya untuk
> membuka aplikasi tanpa login di komputer sendiri. Kalau terisi di produksi,
> siapa pun bisa masuk tanpa login.

5. **Arahkan domain.** Di Vercel: **Settings → Domains** → tambahkan
   `asset.<domain-anda>`. Vercel akan menunjukkan nilai yang perlu ditambahkan.
6. Di pengaturan DNS domain Anda, tambahkan **CNAME** sesuai petunjuk Vercel.
7. Tunggu beberapa menit. Sertifikat HTTPS terbit otomatis.
8. **Perbarui alamat balikan OAuth** di Google Cloud Console, ganti
   `http://localhost:3000` dengan domain Anda yang sebenarnya.

### Penjadwal alert

Berkas `vercel.json` sudah mengatur pemeriksaan alert **sekali sehari, jam 08:00
WIB** (`0 1 * * *`, ditulis dalam UTC). Tidak ada yang perlu diubah.

> **Kenapa sekali sehari, bukan per jam.** Paket Vercel **Hobby hanya mengizinkan
> penjadwalan sekali sehari.** Kalau `vercel.json` memakai jadwal per jam pada
> paket Hobby, penerapannya akan ditolak dengan pesan:
> *"Hobby accounts are limited to daily cron jobs."*
>
> Karena itu **jam kirim tidak diatur dari dalam aplikasi** — jamnya mengikuti
> jadwal di berkas itu. Yang bisa diatur dari aplikasi adalah **ambang hari**-nya —
> misalnya 90, 60, 30, dan 7 hari sebelum lisensi habis. Ambang itulah yang
> menentukan kapan Anda perlu bertindak, dan itu memang bagian yang paling penting.

Kalau ingin jam kirim yang berbeda, ubah `schedule` di `vercel.json`. Rumusnya:
**jam WIB dikurangi 7** menjadi jam UTC.

| Jam kirim WIB | Jadwal di `vercel.json` |
|---|---|
| 06:00 | `0 23 * * *` |
| 07:00 | `0 0 * * *` |
| **08:00 (bawaan)** | **`0 1 * * *`** |
| 09:00 | `0 2 * * *` |
| 12:00 | `0 5 * * *` |

**Menguji alert tanpa menunggu jadwal:** buka

```
https://<domain-anda>/api/cron/alert?secret=<CRON_SECRET>
```

Aman dipanggil berkali-kali. Catatan `alert_log` mencegah pesan yang sama
terkirim dua kali untuk lisensi yang sama — jadi memanggilnya berulang tidak akan
membanjiri Telegram Anda.

---

## Hal yang tidak boleh dilakukan

| Jangan | Alasan |
|---|---|
| Menaruh password dalam bentuk teks biasa di spreadsheet | Seluruh gunanya aplikasi ini hilang |
| Mengirim `APP_MASTER_KEY` lewat obrolan, email, atau chat | Sekali terkirim, harus dianggap bocor |
| Menyalin berkas JSON akun layanan ke dalam repo | Kuncinya ikut tersebar |
| Mengisi `DEV_AUTH_BYPASS` di Vercel | Aplikasi terbuka tanpa login |
| Membuat repo git di folder induk tempat kerja | Berkas lain yang memuat kunci API ikut ter-commit |
| Mengirim `.env.local` ke siapa pun | Isinya seluruh kunci aplikasi |

---

## Yang tidak punya mekanisme pemulihan

Tiga hal ini tidak bisa dikembalikan kalau hilang. Simpan semuanya di dua tempat:

1. **`APP_MASTER_KEY`** — tanpa ini, seluruh password tidak bisa dibuka.
2. **Kode pemulihan verifikasi dua langkah akun Google** — tanpa ini, Anda
   terkunci dari akun sendiri kalau ponsel hilang.
3. **`AUTH_SECRET`** — kalau hilang, semua orang hanya perlu masuk ulang.
   (Ini yang paling ringan akibatnya.)
