# netinv

Aplikasi pencatatan aset perangkat jaringan beserta kredensialnya.

## Prinsip yang dipegang

1. **Repo ini hanya berisi kode.** Tidak ada satu pun data di dalamnya.
   Tidak ada data perangkat, pelanggan, CAR, maupun kredensial — termasuk data contoh.
2. **Aplikasi dimulai kosong.** Data diisi oleh pemilik lewat aplikasi, lalu tersimpan
   di penyimpanan yang dikonfigurasi pemilik (bukan di dalam repo).
3. **Password tidak pernah disimpan dalam bentuk teks biasa.** Yang tersimpan adalah
   hasil enkripsi AES-256-GCM. Kunci enkripsi hidup di variabel lingkungan, terpisah
   dari penyimpanan datanya.
4. **Rahasia tidak pernah masuk repo.** Berkas `.env`, kunci, token, dan berkas
   service account sudah dikecualikan di `.gitignore`.

## Menjalankan di komputer sendiri

```bash
npm install
cp .env.example .env.local     # lalu isi nilainya
npm run dev
```

Buka `http://localhost:3000`.

Tanpa konfigurasi apa pun, aplikasi tetap bisa dibuka dan menampilkan keadaan kosong —
berguna untuk melihat tampilannya lebih dulu. Pengisian data memerlukan konfigurasi
penyimpanan.

## Membuat kunci keamanan

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> **Simpan hasilnya di dua tempat aman.** Tidak ada mekanisme pemulihan kalau kunci ini
> hilang — semua password yang tersimpan menjadi tidak bisa dibuka selamanya, dan harus
> dicatat ulang satu per satu dari perangkatnya.

## Pemeriksaan

```bash
npm run typecheck
```

## Struktur

```
app/                  halaman (Next.js App Router)
components/           komponen tampilan
lib/
  crypto.ts           enkripsi AES-256-GCM (seal / open)
  validation.ts       aturan validasi masukan
  repo/
    types.ts          bentuk data + sekat penyimpanan
```

## Catatan keamanan

- Jangan pernah menuliskan rahasia ke dalam kode. Selalu lewat variabel lingkungan.
- Jangan mengirimkan isi `.env` ke mana pun.
- `DEV_AUTH_BYPASS` hanya untuk komputer sendiri. **Jangan pernah diisi di Vercel.**
