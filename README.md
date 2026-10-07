# netinv

Aplikasi pencatatan aset perangkat jaringan beserta kredensialnya.

> **Baru pertama kali memasang?** Ikuti **[Panduan Pemasangan](SETUP.md)** —
> ditulis langkah demi langkah, lengkap dengan urutan kliknya.

## Prinsip yang dipegang

1. **Repo ini hanya berisi kode.** Tidak ada satu pun data di dalamnya.
   Tidak ada data perangkat, pelanggan, CAR, maupun kredensial — termasuk data contoh.
2. **Aplikasi dimulai kosong.** Data diisi lewat aplikasi, lalu tersimpan di luar repo.
3. **Password tidak pernah disimpan dalam bentuk teks biasa.** Yang tersimpan adalah
   hasil enkripsi AES-256-GCM. Kunci enkripsi hidup di variabel lingkungan, terpisah
   dari tempat penyimpanan datanya.
4. **Rahasia tidak pernah masuk repo.** Berkas `.env`, kunci, token, dan berkas
   akun layanan sudah dikecualikan di `.gitignore`.
5. **Batas akses ditegakkan di server.** Role Engineer tidak melihat aset Personal —
   bukan sekadar menunya disembunyikan, tetapi diperiksa pada setiap permintaan.

## Yang bisa dilakukan aplikasi ini

| Bagian | Isi |
|---|---|
| **Dashboard** | Ringkasan jumlah aset, progres pengisian kredensial, lisensi yang mendekati jatuh tempo |
| **Asset → Personal** | Perangkat milik sendiri. Hanya terlihat Administrator |
| **Asset → Customer** | Perangkat pelanggan, lengkap dengan pelanggan dan CAR-nya |
| **Setting → Pengguna** | Tambah pengguna, atur role Administrator / Engineer |
| **Setting → Keamanan** | Pasang verifikasi dua langkah untuk membuka password |
| **Setting → Alert** | Pengaturan pengingat lisensi lewat Telegram |
| **Setting → Katalog** | Daftar brand dan jenis perangkat, ditambah sendiri |
| **Setting → Pelanggan & CAR** | Data pelanggan dan orang yang dihubungi |
| **Setting → Audit Log** | Riwayat aktivitas, termasuk percobaan akses yang ditolak |
| **Setting → Sistem** | Keadaan konfigurasi dan penyimpanan |

## Menjalankan di komputer sendiri

```bash
npm install
cp .env.example .env.local     # lalu isi nilainya (lihat SETUP.md)
npm run dev
```

Buka `http://localhost:3000`.

> Di PowerShell, perintah `npm` diblokir kebijakan eksekusi Windows. Pakai
> **`npm.cmd`**.

Tanpa konfigurasi apa pun, aplikasi tetap bisa dibuka dan menampilkan keadaan
kosong — berguna untuk melihat tampilannya lebih dulu. Untuk mencoba tanpa login
Google, isi `DEV_AUTH_BYPASS=1` di `.env.local`. **Jangan pernah mengisi variabel
itu di Vercel.**

## Membuat kunci keamanan

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> **Simpan hasilnya di dua tempat aman.** Tidak ada mekanisme pemulihan kalau kunci
> ini hilang — semua password yang tersimpan menjadi tidak bisa dibuka selamanya, dan
> harus dicatat ulang satu per satu dari perangkatnya.

## Pemeriksaan

```bash
npm run typecheck
npm run build
```

## Struktur

```
app/                    halaman dan alamat API
  (app)/                halaman yang memerlukan login
  api/auth/             alur login Google
  api/cron/alert/       pemeriksaan lisensi harian
components/             komponen tampilan
lib/
  auth.ts               login Google (OAuth), tanpa pustaka tambahan
  crypto.ts             enkripsi AES-256-GCM (seal / open)
  totp.ts               kode 6 digit untuk membuka password
  telegram.ts           pengirim ringkasan lisensi
  validation.ts         aturan validasi masukan
  actions/              aksi server untuk setiap formulir
  repo/
    types.ts            bentuk data + sekat penyimpanan
    sheets.ts           penyimpanan di Google Sheets
    memory.ts           penyimpanan sementara (mulai dari kosong)
  sheets/
    client.ts           penyambung ke Google Sheets API
    schema.ts           susunan tab dan kolom
    mapper.ts           pemetaan baris berdasarkan NAMA kolom
```

## Catatan keamanan

- Jangan pernah menuliskan rahasia ke dalam kode. Selalu lewat variabel lingkungan.
- Jangan mengirimkan isi `.env.local` ke mana pun.
- `DEV_AUTH_BYPASS` hanya untuk komputer sendiri. **Jangan pernah diisi di Vercel.**
- Jangan membuat repo git di folder induk tempat kerja — berkas lain di sana bisa
  memuat kunci API dan akan ikut ter-commit.
