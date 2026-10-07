/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Jangan bocorkan teknologi yang dipakai lewat header respons.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Halaman ini tidak boleh diindeks mesin pencari apa pun.
          // Alasannya: alamatnya mudah ditebak, dan isinya daftar aset.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          // Tidak boleh dibingkai situs lain (mencegah clickjacking).
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
