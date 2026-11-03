-- ============================================================
-- Data murid (Operator): tambah kolom nama panggilan.
-- Tempat lahir & tanggal lahir sudah ada sejak 05-kartu.sql (murid_profil.tempat_lahir, tanggal_lahir).
-- Jalankan di Supabase > SQL Editor SEBELUM deploy kode baru. Aman dijalankan ulang.
-- ============================================================
alter table murid_profil add column if not exists nama_panggilan text;
alter table murid_profil add column if not exists tempat_lahir   text;
alter table murid_profil add column if not exists tanggal_lahir  date;
