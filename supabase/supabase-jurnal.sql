-- ============================================================
-- MODUL KEGIATAN SEKOLAH: Jurnal Murid + Ekskul / Club / Kegiatan Unggulan
-- Jalankan sekali di Supabase > SQL Editor.
-- ============================================================

-- 1) Jurnal murid (karya tulis/berita yang dikirim murid dari rumah, diverifikasi admin info sebelum tayang)
create table if not exists jurnal_murid (
  id             uuid primary key default gen_random_uuid(),
  anak_key       text not null,                 -- identitas anak (dari kode akses)
  nama_anak      text not null,
  kelas          text,
  judul          text not null,
  isi            text not null,
  foto_path      text,                          -- path di bucket privat "jurnal"
  status         text not null default 'menunggu'
                 check (status in ('menunggu','revisi','disetujui','ditolak')),
  catatan_admin  text,                          -- alasan revisi / penolakan
  tanggal_terbit date,                          -- diisi saat disetujui
  verified_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists jurnal_murid_status_idx on jurnal_murid (status, tanggal_terbit desc);
create index if not exists jurnal_murid_anak_idx   on jurnal_murid (anak_key);

-- Hanya server (service role) yang boleh membaca/menulis. Kunci publik (anon) tidak punya akses.
alter table jurnal_murid enable row level security;

-- 2) Bucket PRIVAT untuk foto jurnal (foto baru tampil publik setelah jurnal disetujui, lewat /api/jurnal)
insert into storage.buckets (id, name, public)
values ('jurnal', 'jurnal', false)
on conflict (id) do nothing;

-- 3) Info sekolah: penanda kegiatan ekstrakurikuler / club / kegiatan unggulan
alter table info_sekolah add column if not exists jenis_kegiatan text;   -- 'ekskul' | 'club' | 'unggulan' | kosong
