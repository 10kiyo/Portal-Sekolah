# Skrip database (Supabase)

Jalankan di **Supabase → SQL Editor**, **berurutan sesuai nomor**. Urutan penting karena sebagian skrip memakai
tabel/fungsi dari skrip sebelumnya. Semua skrip aman dijalankan ulang, kecuali pengecualian di bawah.

| No | Berkas | Isi | Butuh |
|:-:|---|---|---|
| 00 | `00-info.sql` | Tabel Info sekolah (pengumuman, agenda, surat) + bucket lampiran | – |
| 00 | `00-kegiatan.sql` | Tabel Kegiatan & pendaftaran + bucket bukti transfer | – |
| 01 | `01-jurnal.sql` | Jurnal Murid | 00-info |
| 02 | `02-guru.sql` | Tabel guru & staf, username + PIN otomatis | – |
| 03 | `03-peran.sql` | Peran & aturan akses per peran | 02, 00-kegiatan |
| 04 | `04-foto-guru.sql` | Unggah foto profil guru | 02, 03 |
| 05 | `05-kartu.sql` | Profil murid & desain kartu pelajar | 03 |
| 06 | `06-kegiatan-tingkat.sql` | Kegiatan per tingkat & pendaftaran umum | 05, 00-kegiatan |
| 07 | `07-ekskul-club.sql` | Pendaftaran ekskul & club | 03, 06 |
| 08 | `08-fasilitas.sql` | Katalog fasilitas | 03 |
| 09 | `09-bk.sql` | Bimbingan Konseling | 08 |
| 10 | `10-peran-info.sql` | Peran Admin Info | 09 |
| 11 | `11-galeri.sql` | Galeri Prestasi | bebas urutan |
| 12 | `12-surat-generator.sql` | Pembuat surat | 03 |

> **Belum ada di repo:** skema dasar yang dibuat di luar repo ini (tabel `kelas_*` untuk Administrasi Kelas,
> `daftar_tamu_gabungan`, `kehadiran`, `distribusi_tamu`, `pengaturan_admin`) dan `supabase-hapus-akun-email.sql`.
> Ekspor dari database yang sudah jalan (lihat README utama > Yang Perlu Diketahui) dan simpan sebagai
> `00-skema-dasar.sql`, jalankan paling awal.

**Jangan jalankan ulang** `03-peran.sql`, `08-fasilitas.sql`, dan `10-peran-info.sql` setelah `09-bk.sql`
(ketiganya menulis ulang aturan peran dan akan menolak nilai `bk`). Bila terlanjur, jalankan ulang `09-bk.sql`.

Skrip baru: beri nomor berikutnya (`13-...sql`) dan tambahkan baris di tabel ini.
