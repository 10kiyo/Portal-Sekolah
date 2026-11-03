-- ============================================================
-- Data murid (Operator): tambah kolom jenis kelamin ('L' = laki-laki, 'P' = perempuan).
-- Dipakai untuk rekap jumlah laki-laki / perempuan di cetakan Data murid.
-- Jalankan di Supabase > SQL Editor SEBELUM deploy kode baru. Aman dijalankan ulang.
-- ============================================================
alter table murid_profil add column if not exists jenis_kelamin text;
alter table murid_profil drop constraint if exists murid_profil_jenis_kelamin_cek;
alter table murid_profil add constraint murid_profil_jenis_kelamin_cek check (jenis_kelamin is null or jenis_kelamin in ('L', 'P'));
