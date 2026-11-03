# Spec: Refactor Portal Sekolah (SI-TAQWA)

> Acuan kerja refactor. Tujuannya merapikan struktur kode **tanpa mengubah perilaku aplikasi**.
> Aturan umum proyek ada di `CLAUDE.md`; dokumen ini khusus untuk pekerjaan refactor.

## 1. Tujuan

Sasaran (centang yang dikerjakan):

- [ ] Pecah file JS besar menjadi modul lebih kecil per fitur
- [ ] Pisahkan logika (data, perhitungan, akses Supabase) dari kode yang mengatur tampilan (DOM)
- [ ] Hapus kode duplikat antar `modul-*.js`, `js/*.js`, dan `functions/api/*.js`
- [ ] Pindahkan JS/CSS inline di file `.html` besar ke `public/js/` dan `public/css/`
- [ ] Rapikan penamaan variabel, fungsi, dan file
- [ ] Hapus kode mati dan komentar usang
- [ ] Pusatkan pembantu bersama (`$`, `esc`, pemanggilan API) agar tidak dideklarasikan ulang

## 2. Konteks

- **Stack:** HTML + CSS + JavaScript biasa (vanilla), **tanpa framework dan tanpa proses build**
- **Backend/edge:** Cloudflare Workers (`src/worker.js` sebagai router, `functions/api/*.js` satu file per endpoint)
- **Database & storage:** Supabase (Postgres, Row Level Security, bucket privat)
- **Runtime:** Node.js >= 20 (untuk Wrangler dan test)
- **Pengguna:** publik, orang tua/murid, serta guru & staf dengan peran (guru, pustakawan, keuangan, persuratan, operator, BK, sarpras, admin info, admin)
- **Fitur utama:** info terbaru, galeri, kalender, SPMB, buku tamu, pantau belajar anak (`ortu.html`), pendaftaran kegiatan, jurnal murid, administrasi guru & staf (`kelas.html`), BK, surat, kartu pelajar

## 3. Cakupan

**Boleh diubah:**

- `public/modul-staf.js`, `public/modul-bk.js`, `public/modul-surat.js`
- `public/js/*.js` (`kelas.js`, `buku-tamu.js`, `buku-tamu-admin.js`, `index.js`, `spmb.js`)
- JS/CSS inline di `public/*.html` (terutama `kegiatan.html`, `info-admin.html`, `info.html`, `ortu.html`)
- `functions/api/*.js` dan `functions/_lib/*.js` (hanya struktur, bukan aturan akses)
- `scripts/` dan `tests/` (boleh ditambah)

**Jangan diubah:**

- `supabase/*.sql` (skema, RLS, urutan skrip)
- Aturan autentikasi dan otorisasi: pemeriksaan token, peran, dan PIN di `functions/_lib/util.js`, `guru-login.js`, `admin-auth.js`
- `functions/_lib/pembatas.js` (pembatas percobaan) dan binding KV di `wrangler.jsonc`
- `.dev.vars`, variabel lingkungan, dan kunci apa pun
- `public/js/konfigurasi.js` (satu-satunya tempat URL dan kunci publik Supabase untuk frontend)
- Isi data: `data-sekolah.js`, `data-kalender.js`, `data-spmb.js`, `data-guru.js`, serta file PDF dan gambar
- `package.json` dan versi dependensi

**Di luar cakupan:** fitur baru, perubahan tampilan/UX, menambah framework atau build tool (sesuai `CLAUDE.md`), dan memperbaiki skema database.

## 4. Perilaku yang harus tetap sama

**Kontrak API (frontend ↔ Worker):**

- Alamat endpoint `/api/*`, parameter, dan bentuk respons JSON tidak berubah
- Kode status dan pesan error yang dibaca frontend tidak berubah

**Akses dan keamanan:**

- Login guru/staf memakai username + PIN; menu mengikuti peran, dan satu orang boleh punya beberapa peran
- Pantau Belajar Anak memakai kode akses orang tua
- Hak akses tetap diperiksa di server dan RLS, bukan hanya menyembunyikan menu
- Catatan konseling BK tidak pernah sampai ke orang tua
- Kunci *service role* hanya dipakai di Worker, tidak pernah dikirim ke browser
- Pembatas percobaan (login guru, kode akses orang tua, pendaftaran umum) tetap berfungsi

**Fitur:**

- Presensi, nilai, tugas, dan sinkronisasi murid di administrasi kelas
- Kedisiplinan BK: poin dan Surat Peringatan; surat panggilan orang tua
- Pembuat surat otomatis dan agenda surat
- Kartu pelajar (desain dan cetak PDF)
- Buku Tamu: pilih nama, tanda tangan di layar, rekap tersimpan
- Pendaftaran kegiatan (termasuk unggah bukti transfer) dan pembatasan per tingkat kelas
- Jurnal Murid: dikirim murid, tayang setelah disetujui admin
- Info Terbaru dengan pratinjau berbagi WhatsApp; Galeri Prestasi
- SPMB dan kalender tetap membaca dari file `data-*.js`
- Pesan error dan validasi form

## 5. Konvensi kode

- **Bahasa:** JavaScript ES modern; Worker memakai ES module (`"type": "module"`)
- **Penamaan:** ikuti yang sudah ada di repo. Nama file huruf kecil dengan tanda hubung (`buku-tamu.js`), nama modul menu `modul-*.js`, data `data-*.js`. Variabel dan fungsi memakai bahasa Indonesia yang sudah dipakai di kode sekitarnya, jangan dicampur
- **Struktur:**
  - Logika per halaman besar ada di `public/js/`, kerangka halaman ada di `.html`
  - Satu file `functions/api/*.js` = satu endpoint; fungsi bantu bersama masuk `functions/_lib/`
  - `$` dan `esc` hanya dari `public/js/umum.js`; jangan dideklarasikan ulang
  - Akses Supabase memakai klien yang sudah ada, bukan klien baru per modul
- **Tanpa tooling baru:** tidak menambah npm package, bundler, atau transpiler. Boleh memakai `<script type="module">` hanya bila halaman terkait sudah mendukungnya dan sudah dicek di browser
- **Ukuran:** satu fungsi satu tanggung jawab; hindari fungsi lebih dari ± 40 baris
- **Komentar dan commit:** bahasa Indonesia, singkat

## 6. Aturan kerja

1. Kerjakan di branch terpisah, misalnya `refactor/rapikan-kode`.
2. Satu commit satu jenis perubahan, dan satu file/modul per tahap.
3. Jangan mencampur refactor dengan perbaikan bug atau fitur baru. Bug yang ditemukan dicatat di bagian 8.
4. Urutan yang disarankan, dari risiko paling kecil:
   1. Fungsi bantu bersama dan kode duplikat (`umum.js`, `functions/_lib/`)
   2. `functions/api/*.js`
   3. `public/js/*.js` (halaman yang lebih kecil dulu)
   4. `modul-surat.js`, lalu `modul-bk.js`, lalu `modul-staf.js` (terbesar, terakhir)
   5. JS/CSS inline di file `.html`
5. Jalankan verifikasi (bagian 7) setelah setiap tahap sebelum lanjut.
6. Bila ragu suatu perubahan mengubah perilaku, berhenti, catat, dan tanyakan dulu.
7. Jangan membaca, mencetak, atau meng-commit `.dev.vars` dan kunci.

## 7. Verifikasi

**Otomatis:**

- `npm test` (`node --test`; berkas di `tests/`: api, kehadiran, pembatas, spmb, util)
- `npm run cek` (pemeriksaan halaman frontend lewat `scripts/cek-frontend.mjs`)
- `npm run verifikasi` (gabungan `cek` + `test`); wajib hijau sebelum merge dan sebelum `npm run deploy`

**Manual** (jalankan `npm run dev`, lalu cek di browser dan buka console):

- [ ] Beranda, Info Terbaru, Galeri, Kalender, dan SPMB tampil normal
- [ ] Login guru/staf berhasil dan menu sesuai peran
- [ ] Akun tanpa peran tertentu tidak bisa membuka menu peran lain
- [ ] Input dan ubah nilai/presensi di `kelas.html` berjalan, hasilnya sama
- [ ] Kode akses orang tua di `ortu.html` menampilkan kehadiran, tugas, dan nilai yang sama
- [ ] Buku Tamu: pilih nama, tanda tangan, kirim
- [ ] Pendaftaran kegiatan dan unggah bukti transfer berjalan
- [ ] Jurnal Murid: kirim, setujui admin, tampil
- [ ] Kartu pelajar bisa didesain dan dicetak PDF (butuh internet untuk CDN `html2canvas` dan `jsPDF`)
- [ ] Modul BK dan Buat Surat membuka dan menyimpan data
- [ ] Tidak ada error baru di console browser maupun log Wrangler

> Test otomatis di repo belum menutup semua modul `public/modul-*.js`. Sebelum merombak modul besar, catat dulu perilakunya di checklist atau tambah test untuk logika yang bisa diuji tanpa DOM.

## 8. Catatan temuan (di luar cakupan)

Bug atau ide perbaikan yang ditemukan selama refactor dicatat di sini dan dikerjakan terpisah.

- [ ] Skema dasar (`kelas_*`, `daftar_tamu_gabungan`, `kehadiran`, `distribusi_tamu`, `pengaturan_admin`) belum ada skripnya di `supabase/`
- [ ] Buku Tamu membaca `daftar_tamu_gabungan` langsung dengan kunci publishable; periksa RLS-nya
- [ ] Murid yang ditambahkan operator belum muncul di Buku Tamu

## 9. Kriteria selesai

- Sasaran di bagian 1 yang dicentang sudah tercapai
- `npm run verifikasi` hijau dan checklist manual terpenuhi
- Tidak ada perubahan di area "jangan diubah"
- Kontrak API (`/api/*`) tidak berubah
- Branch sudah direview dan dimerge; `CHANGELOG.md` diperbarui bila perlu
