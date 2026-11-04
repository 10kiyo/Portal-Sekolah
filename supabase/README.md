# Skema Supabase SI-TAQWA

SQL yang tersedia berada di `supabase/migration/`. Untuk database baru, jalankan
skrip berikut satu per satu melalui Supabase SQL Editor:

| Urutan | File | Isi utama |
|---|---|---|
| 1 | `migration/01_master_core.sql` | `guru_staf`, `kelas`, `murid`, dan enum dasar |
| 2 | `migration/02_auth_and_roles.sql` | `guru_peran` dan kebijakan RLS awal |
| 3 | `migration/03_academic_module.sql` | `kehadiran`, `nilai`, `jurnal_murid` |
| 4 | `migration/04_student_services.sql` | BK, ekskul, pendaftaran ekskul, SPMB |
| 5 | `migration/05_admin_operations.sql` | buku tamu, surat, fasilitas, info sekolah |
| 6 | `migration/tambahan.sql` | kolom kompatibilitas aplikasi, profil murid, tugas operator, dan kebijakan RLS |

`tambahan.sql` menyesuaikan `guru_staf` dengan login dan Administrasi Guru & Staf
tanpa menyalin `pin_hash` ke PIN teks biasa. Jalankan skrip itu setelah migrasi
01–05. Pada database yang sudah berisi data, buat cadangan terlebih dahulu dan
tinjau perubahan sebelum menjalankannya. Jangan jalankan ulang migrasi dasar
01–05 pada database yang sudah terpasang.

## Akun Operator pertama

1. Terapkan migrasi 01–06 dan isi binding Cloudflare Worker `ADMIN_PIN` serta
   konfigurasi Supabase sesuai panduan deployment di README utama.
2. Buka halaman setup Operator, masukkan `ADMIN_PIN`, lalu simpan username dan
   PIN yang ditampilkan. Endpoint setup hanya membuat akun awal jika belum ada
   baris dengan peran `operator`.
3. Login melalui halaman Administrasi Guru & Staf. Login pertama menautkan akun
   guru/staf ke Supabase Auth; setelah itu menu Operator tersedia.

Jangan mengisi `pin_hash` dengan PIN dan jangan memublikasikan
`SUPABASE_SERVICE_ROLE_KEY`. Endpoint login memakai service role di Worker;
frontend tetap memakai kunci anon/publishable.

## Batas cakupan migrasi saat ini

Migrasi ini belum membentuk seluruh tabel yang dipakai kode lama. Di antaranya
`kelas_kelas`, `kelas_murid`, tabel akademik `kelas_*`, `daftar_tamu_gabungan`,
`kegiatan`, dan `pendaftaran_kegiatan`. Modul yang memerlukan tabel tersebut
belum dapat digunakan hanya dengan menjalankan enam file di atas. Buat atau
terapkan migrasi khususnya sebelum mengaktifkan modul terkait.

Impor Operator menyimpan data tambahan ke `murid_profil`. Trigger pada migrasi
06 membuat atau memperbarui baris `murid` inti dan membuat kode akses orang tua.
Kode tidak ditaruh di `murid_profil`: Operator dapat mengunduh CSV-nya dari
tombol **Unduh kode akses orang tua** agar kode tidak ikut terbaca oleh akun
guru. CSV hanya mencakup murid aktif. Jika ada baris kelas cocok di `kelas`,
murid ditautkan ke kelas itu; kalau tidak, nama kelas disimpan sebagai label
dan tetap muncul di pantau belajar.

Beberapa endpoint sudah diselaraskan dengan skema bernomor, tetapi belum semua
modul aplikasi menggunakan skema yang sama. Sebelum impor data produksi, uji
alur login, pengelolaan akun, impor profil murid, dan baca data orang tua pada
proyek Supabase uji.
