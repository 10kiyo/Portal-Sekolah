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
| 7 | `migration/07_legacy_app_compat.sql` | tabel modul `kelas_*`, BK, keuangan, kegiatan, SPMB, daftar murid, dan kebijakan RLS sesuai Worker/JS |

`tambahan.sql` menyesuaikan `guru_staf` dengan login dan Administrasi Guru & Staf
tanpa menyalin `pin_hash` ke PIN teks biasa. Jalankan skrip itu setelah migrasi
01–05. Jalankan migration 07 setelah `tambahan.sql`. Pada database yang sudah berisi data, buat cadangan terlebih dahulu dan
tinjau perubahan sebelum menjalankannya. Jangan jalankan ulang migrasi dasar
01–05 pada database yang sudah terpasang.

## Akun Operator pertama

1. Terapkan migrasi 01–07 dan isi binding Cloudflare Worker `ADMIN_PIN` serta
   konfigurasi Supabase sesuai panduan deployment di README utama.
2. Buka halaman setup Operator, masukkan `ADMIN_PIN`, lalu simpan username dan
   PIN yang ditampilkan. Endpoint setup hanya membuat akun awal jika belum ada
   baris dengan peran `operator`.
3. Login melalui halaman Administrasi Guru & Staf. Login pertama menautkan akun
   guru/staf ke Supabase Auth; setelah itu menu Operator tersedia.

Jangan mengisi `pin_hash` dengan PIN dan jangan memublikasikan
`SUPABASE_SERVICE_ROLE_KEY`. Endpoint login memakai service role di Worker;
frontend tetap memakai kunci anon/publishable.

## Kontrak aplikasi lama

Migration 07 melengkapi tabel dan kolom yang dipakai Worker dan JS lama,
termasuk `kelas_*`, BK, keuangan, fasilitas, surat, perpustakaan, kegiatan,
SPMB, dan buku tamu. Tabel-tabel sensitif memakai RLS berbasis peran; data
pendaftaran publik diakses melalui Worker dengan service role, bukan dari
browser.

Impor roster awal ke tabel `daftar_tamu_gabungan` dengan kolom wajib
`guest_id`, `guest_name`, `jenis_undangan`, dan `instansi_kelas`. Kolom
`nomor_whatsapp` opsional. `guest_id` harus stabil dan unik. Tabel ini bukan
view dari `buku_tamu`; buku tamu operasional tetap berada di tabel terpisah.
Jika migration tambahan versi lama sebelumnya sudah membuat view bernama
`daftar_tamu_gabungan`, migration 07 menghapus view itu lalu membuat tabel roster
yang benar, sehingga roster perlu diimpor kembali.

Impor Operator menyimpan data tambahan ke `murid_profil`. Trigger pada
`tambahan.sql` membuat atau memperbarui baris `murid` inti dan membuat kode akses orang tua.
Kode tidak ditaruh di `murid_profil`: Operator dapat mengunduh CSV-nya dari
tombol **Unduh kode akses orang tua** agar kode tidak ikut terbaca oleh akun
guru. Migration 07 mengisi `kelas_murid.kode_akses` dari kode kanonis itu dan
menghubungkan impor kelas dengan tabel murid inti, sehingga pantau belajar dan
pendaftaran kegiatan memakai ID murid yang sama.

Jalankan seluruh urutan terlebih dahulu di proyek Supabase uji. Uji login,
pengelolaan akun, impor roster, kode akses orang tua, presensi kelas, pendaftaran
kegiatan, BK, serta fasilitas sebelum memakai database produksi.
