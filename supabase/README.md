# Skema Database & Migrasi — SI-TAQWA

Folder ini berisi seluruh skrip DDL (Data Definition Language) dan aturan migrasi database PostgreSQL untuk **Portal Sekolah SDS Islam At-Taqwa Rawamangun** yang di-host di **Supabase**.

---

## 🛠️ Urutan Migrasi Database

Saat membangun database dari nol (*start from scratch*), jalankan skrip SQL di dalam folder `migrations/` **sesuai urutan penomoran berikut** via **Supabase SQL Editor**:

| No | File | Deskripsi / Modul |
|:--:|---|---|
| **01** | `migrations/01_master_core.sql` | Enum global, tabel master `guru_staf`, `kelas`, dan `murid` |
| **02** | `migrations/02_auth_and_roles.sql` | Tabel `guru_peran` & aturan keamanan dasar (Row Level Security / RLS) |
| **03** | `migrations/03_akademik.sql` | Modul Akademik: tabel `kehadiran`, `nilai`, dan `jurnal_murid` |
| **04** | `migrations/04_kesiswaan.sql` | Modul Kesiswaan: tabel `bk_catatan`, `ekskul`, `pendaftaran_ekskul`, dan `spmb_pendaftar` |
| **05** | `migrations/05_operasional.sql` | Modul Operasional: tabel `buku_tamu`, `surat`, `fasilitas`, dan `info_sekolah` |

> ⚠️ **Penting:** Urutan di atas sangat krusial karena tabel-tabel transaksi pada skrip selanjutnya bergantung pada *Foreign Key* dari tabel master (`guru_staf`, `kelas`, `murid`) di skrip `01_master_core.sql`.

---

## 🔐 Hak Akses & Keamanan (RLS)

- Seluruh tabel utama telah dilengkapi dengan **Row Level Security (RLS)**.
- Akses publik hanya diberikan untuk data non-sensitif (Info Sekolah, Fasilitas, Profil Umum Guru).
- Hak akses administrasi (BK, Keuangan, Persuratan, dll.) diverifikasi berdasarkan peran (*roles*) yang terdaftar di tabel `guru_peran`.
- *Service Role Key* Supabase hanya boleh digunakan pada lingkungan aman (Cloudflare Workers Backend) dan **tidak boleh dipublish** ke frontend statis.

---

## 🚀 Langkah Seeding Data Awal

Setelah menjalankan migrasi `01` sampai `05`:

1. Buat minimal satu akun administrator di tabel `guru_staf`.
2. Masukkan ID guru tersebut ke tabel `guru_peran` dengan `role = 'admin'`.
3. Import data master siswa dan guru dari file CSV/Excel via **Supabase Dashboard → Table Editor → Import CSV**.