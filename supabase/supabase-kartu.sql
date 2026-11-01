-- ============================================================
-- KARTU PELAJAR (menu Pustakawan): data tambahan murid + desain kartu + foto
-- Jalankan di Supabase > SQL Editor SETELAH supabase-peran.sql. Aman dijalankan ulang.
-- ============================================================

-- 1) Data tambahan murid (NIS, NISN, tempat/tanggal lahir, alamat, foto).
--    Satu baris per murid; guest_id = guest_id di daftar_tamu_gabungan.
--    Diisi/diubah oleh admin utama lewat Table Editor (atau akun peran operator/admin).
create table if not exists murid_profil (
  guest_id      text primary key,
  nama_ref      text,            -- hanya pengingat nama saat baris dibuat; nama di kartu tetap dari daftar_tamu_gabungan
  nis           text,
  nisn          text,
  tempat_lahir  text,
  tanggal_lahir date,
  alamat        text,
  foto_path     text,            -- jalur berkas di bucket "foto-murid", mis. "3A/budi-santoso.jpg"
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Kolom lain yang dibutuhkan nanti (agama, nama ayah, golongan darah, dst) cukup ditambahkan:
--   alter table murid_profil add column agama text;
-- Kolom baru langsung muncul sebagai pilihan "Bagian yang tampil" di menu Kartu pelajar.

create or replace function murid_profil_ubah() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists murid_profil_ubah_trg on murid_profil;
create trigger murid_profil_ubah_trg before update on murid_profil
  for each row execute function murid_profil_ubah();

-- 2) Isi awal: satu baris kosong untuk setiap murid di database (aturan sama dengan menu Kartu pelajar; aman dijalankan ulang).
insert into murid_profil (guest_id, nama_ref)
select distinct on (guest_id::text) guest_id::text, btrim(guest_name)
from daftar_tamu_gabungan
where guest_id is not null
  and btrim(coalesce(guest_name, '')) <> ''
  and jenis_undangan ~* 'siswa|murid|anak'      -- termasuk "Orang Tua/Wali Siswa" (nama di baris itu = nama murid)
order by guest_id::text
on conflict (guest_id) do nothing;

-- 3) Pengaturan tampilan kartu (dipakai bersama semua pustakawan)
create table if not exists kartu_desain (
  id         text primary key default 'utama',
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 4) Keamanan
--    murid_profil : dibaca pustakawan, operator, admin; diubah operator & admin (admin utama juga bisa lewat dashboard).
--    kartu_desain : dibaca & diubah pustakawan, operator, admin.
alter table murid_profil enable row level security;
alter table kartu_desain enable row level security;
revoke all on murid_profil, kartu_desain from anon;
grant select, insert, update, delete on murid_profil, kartu_desain to authenticated;

drop policy if exists murid_profil_baca on murid_profil;
create policy murid_profil_baca on murid_profil for select to authenticated
  using (peran_saya() in ('pustakawan','operator','admin'));
drop policy if exists murid_profil_tulis on murid_profil;
create policy murid_profil_tulis on murid_profil for all to authenticated
  using (peran_saya() in ('operator','admin')) with check (peran_saya() in ('operator','admin'));

drop policy if exists kartu_desain_peran on kartu_desain;
create policy kartu_desain_peran on kartu_desain for all to authenticated
  using (peran_saya() in ('pustakawan','operator','admin')) with check (peran_saya() in ('pustakawan','operator','admin'));

-- 5) Bucket privat untuk foto murid (foto anak tidak boleh publik)
insert into storage.buckets (id, name, public) values ('foto-murid', 'foto-murid', false)
on conflict (id) do nothing;

drop policy if exists foto_murid_baca on storage.objects;
create policy foto_murid_baca on storage.objects for select to authenticated
  using (bucket_id = 'foto-murid' and peran_saya() in ('pustakawan','operator','admin'));
drop policy if exists foto_murid_tulis on storage.objects;
create policy foto_murid_tulis on storage.objects for all to authenticated
  using (bucket_id = 'foto-murid' and peran_saya() in ('operator','admin'))
  with check (bucket_id = 'foto-murid' and peran_saya() in ('operator','admin'));

-- CATATAN
-- * Isi data: Table Editor > murid_profil > edit barisnya (nis, nisn, tempat_lahir, tanggal_lahir [YYYY-MM-DD], alamat).
--   Murid baru yang ditambahkan ke daftar tamu: jalankan ulang bagian 2 (insert ... on conflict do nothing) atau tambah baris manual.
-- * Foto: Storage > foto-murid > unggah berkas (mis. 3A/budi.jpg), lalu isi kolom foto_path dengan "3A/budi.jpg".
--   Rasio foto 3:4 (potret) paling pas dengan kotak foto kartu.
