# Perubahan

Riwayat rilis per modul sebelum file ini ada: lihat `docs/PETUNJUK.txt`.

## Perbaikan: murid baru dari operator kini muncul di Buku Tamu

- **Penyebab:** murid yang ditambah/diubah operator disimpan sebagai lapisan di `murid_profil` (bukan di
  `daftar_tamu_gabungan`), sedangkan Buku Tamu membaca `daftar_tamu_gabungan` langsung dengan kunci publik.
- **Perbaikan:** endpoint baru `/api/daftar-tamu` menggabungkan keduanya dengan aturan yang sama seperti `murid_gabungan()`
  (murid baru muncul, nama/kelas baru ikut, murid nonaktif disembunyikan). Halaman tamu dan panel admin Buku Tamu memakainya.
- **Keamanan:** nomor WhatsApp untuk publik kini tersamar (4 angka terakhir); nomor lengkap hanya untuk admin (token).
  Bila lapisan operator tidak terbaca, daftar dasar tetap tampil.
- **Test:** `tests/daftar-tamu.test.mjs`.

## Lanjutan perapian

- **KV aktif:** binding `PEMBATAS_KV` ada di `wrangler.jsonc` (dibuat otomatis oleh Wrangler >= 4.45 saat deploy).
  Ada test yang menjaga binding ini tidak hilang.
- **Keamanan:** `/api/get-attendance` (rekap lengkap + tanda tangan) kini butuh token admin. Halaman publik buku tamu
  pindah ke `/api/status-kehadiran` yang hanya mengembalikan guest_id, nama, status, dan waktu.
- **SQL:** `00-info.sql` dan `00-kegiatan.sql` ditambahkan dan wajib dijalankan paling awal (01 dan 03 bergantung padanya).
  Skema dasar lain yang belum ada skripnya dicatat di `supabase/README.md`.
- **Frontend:** `spmb.html` (33 KB -> 1 KB) dan `index.html` (42 KB -> 9 KB) dipecah. Data SPMB pindah ke
  `public/data-spmb.js`. `esc` ganda di `index.html` dihapus; `spmb` memakai `byId` supaya tidak bentrok dengan `$` bersama.
- **Pemeriksa:** `npm run cek` kini juga menangkap `url()` CSS relatif yang rusak dan nama global yang hilang.

## Perapian struktur (refactor, tanpa perubahan fitur)

### Repo
- Tambah `.gitignore`; `.DS_Store` dikeluarkan dari git.
- Tambah `docs/icons/` (README merujuk ikon yang sebelumnya tidak ada di repo). Ikon ini bersifat pengganti
  sederhana; timpa dengan ikon aslimu bila ada.
- `PETUNJUK*.txt` dipindah ke `docs/`.
- Skrip SQL diberi nomor urut (`01-` sampai `12-`) dan ada `supabase/README.md`. Semua rujukan di kode, pesan error,
  dan README ikut diperbarui.
- Tambah `package.json` (`dev`, `deploy`, `test`, `cek`, `verifikasi`), 21 test otomatis, dan `scripts/cek-frontend.mjs`.

### Backend
- `util.js` jadi satu sumber untuk `json`, `cfg`, `hmac`, `same`, dan URL Supabase. Lima endpoint yang menulis ulang
  helper sendiri (`admin-auth`, `admin-checklist`, `get-attendance`, `submit-attendance`, `ortu-lookup`) kini memakainya.
  `youtube.js` sengaja dibiarkan (responsnya berbeda: cache publik).
- Pembatas percobaan dipusatkan di `_lib/pembatas.js`. Memakai Cloudflare KV bila binding `PEMBATAS_KV` ada,
  jika tidak, kembali ke memori seperti sebelumnya.
- `get-attendance` dan `submit-attendance` kini ikut mendukung kunci Supabase format baru (`sb_secret_...`) dan URL bawaan.

### Frontend
- `kelas.html` (55 KB -> 3 KB) dan `buku-tamu.html` (54 KB -> 7 KB): JS dan CSS dipindah ke `public/js/` dan `public/css/`.
- `$` dan `esc` yang tadinya disalin di 14 halaman kini satu file: `public/js/umum.js`.
- URL dan kunci publik Supabase frontend satu tempat: `public/js/konfigurasi.js`.
