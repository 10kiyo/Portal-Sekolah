-- ============================================================
-- EKSKUL & CLUB: tautan pendaftaran dibuat panitia, data pendaftar hanya dikelola pustakawan (Bu Laras)
-- Jalankan di Supabase > SQL Editor SETELAH supabase-peran.sql dan supabase-kegiatan-tingkat.sql.
-- JALANKAN SEBELUM DEPLOY kode baru. Aman dijalankan ulang.
-- ============================================================

-- 1) Jenis kegiatan: umum (kegiatan biasa, dikelola panitia) | ekskul (berbayar) | club (gratis + seleksi)
alter table kegiatan add column if not exists jenis text not null default 'umum';
alter table kegiatan drop constraint if exists kegiatan_jenis_chk;
alter table kegiatan add constraint kegiatan_jenis_chk check (jenis in ('umum','ekskul','club'));

-- 2) Pendaftar ekskul & club di tabel TERPISAH (panitia tidak membacanya sama sekali)
create table if not exists ekskul_pendaftar (
  id uuid primary key default gen_random_uuid(),
  kegiatan_id uuid not null references kegiatan(id) on delete restrict,
  anak_key text not null, nama_anak text not null, kelas text,
  status text not null default 'menunggu' check (status in ('menunggu','lunas','diterima','ditolak')),
  -- ekskul: bukti transfer + jumlah yang dikonfirmasi pustakawan
  nama_pengirim text, tanggal_transfer date, bukti_path text, nominal_diterima numeric(12,0),
  -- club: alasan/motivasi + nilai seleksi dari pustakawan
  nilai_seleksi numeric(5,1),
  data jsonb not null default '{}'::jsonb,       -- kontak, kaos, kesehatan, motivasi
  catatan text,                                   -- catatan pustakawan untuk orang tua
  verified_at timestamptz, created_at timestamptz not null default now(),
  unique (kegiatan_id, anak_key)
);
create index if not exists ekskul_pendaftar_kegiatan_idx on ekskul_pendaftar (kegiatan_id);

-- 3) Akses: hanya peran pustakawan (dan admin). Orang tua mendaftar lewat server (service role), bukan langsung.
alter table ekskul_pendaftar enable row level security;
revoke all on ekskul_pendaftar from anon;
drop policy if exists ekskul_pendaftar_peran on ekskul_pendaftar;
create policy ekskul_pendaftar_peran on ekskul_pendaftar for all to authenticated
  using (peran_saya() in ('pustakawan','admin')) with check (peran_saya() in ('pustakawan','admin'));

-- Pustakawan boleh MEMBACA daftar kegiatan (untuk menampilkan nama, biaya, kuota). Tidak bisa mengubahnya.
drop policy if exists kegiatan_baca_pustakawan on kegiatan;
create policy kegiatan_baca_pustakawan on kegiatan for select to authenticated
  using (peran_saya() in ('pustakawan','admin'));

-- 4) Bukti transfer ekskul disimpan di bucket "bukti" folder ekskul/ ; hanya pustakawan yang boleh melihatnya.
drop policy if exists bukti_ekskul_pustakawan on storage.objects;
create policy bukti_ekskul_pustakawan on storage.objects for select to authenticated
  using (bucket_id = 'bukti' and name like 'ekskul/%' and peran_saya() in ('pustakawan','admin'));
