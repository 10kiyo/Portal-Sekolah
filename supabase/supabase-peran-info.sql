-- ============================================================
-- PERAN "info" (Admin Info & Galeri): staf dengan peran ini punya menu "Kelola Info & Galeri" di Administrasi Guru dan Staf,
-- tanpa perlu PIN admin. Tombol "Kelola info/galeri (admin)" di halaman publik dihapus.
-- Jalankan di Supabase > SQL Editor SETELAH supabase-bk.sql. JALANKAN SEBELUM DEPLOY. Aman dijalankan ulang.
-- (Jangan jalankan ulang supabase-fasilitas.sql / supabase-peran.sql / supabase-bk.sql sesudahnya: keduanya menulis ulang aturan peran
--  tanpa 'info'. Bila terlanjur, jalankan ulang file ini.)
-- ============================================================
alter table guru_staf drop constraint if exists guru_staf_peran_chk;
alter table guru_staf add constraint guru_staf_peran_chk
  check (peran is null or peran in ('guru','pustakawan','keuangan','persuratan','operator','sarpras','bk','info','staf','admin'));
alter table guru_staf drop constraint if exists guru_staf_peran_tambahan_chk;
alter table guru_staf add constraint guru_staf_peran_tambahan_chk
  check (peran_tambahan <@ array['guru','pustakawan','keuangan','persuratan','operator','sarpras','bk','info']::text[]);
