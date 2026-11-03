-- URUTAN: jalankan SEBELUM 03-peran.sql dan 06-kegiatan-tingkat.sql. 03-peran.sql juga membuat tabel bernama
-- pendaftaran_kegiatan (versi lama, kolomnya beda); bila ia jalan lebih dulu, tabel di bawah ini tidak akan terbentuk dengan benar.
-- Jalankan sekali di Supabase > SQL Editor.
-- Modul Kegiatan Sekolah: pendaftaran + bukti transfer (bayar lunas).

create table if not exists public.kegiatan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  deskripsi text,
  biaya integer not null default 0,
  rekening text,
  buka_daftar date not null,
  tutup_daftar date not null,
  tanggal_kegiatan date not null,
  kuota integer,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pendaftaran_kegiatan (
  id uuid primary key default gen_random_uuid(),
  kegiatan_id uuid not null references public.kegiatan(id) on delete cascade,
  anak_key text not null,
  nama_anak text not null,
  kelas text,
  status text not null default 'menunggu' check (status in ('menunggu','lunas','ditolak')),
  nama_pengirim text,
  tanggal_transfer date,
  data jsonb not null default '{}'::jsonb,
  bukti_path text,
  catatan_panitia text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (kegiatan_id, anak_key)
);
create index if not exists pendaftaran_kegiatan_kid on public.pendaftaran_kegiatan(kegiatan_id);

-- Kunci rapat: RLS aktif tanpa policy = hanya bisa diakses lewat Worker (service role).
alter table public.kegiatan enable row level security;
alter table public.pendaftaran_kegiatan enable row level security;

-- Bucket PRIVAT untuk bukti transfer.
insert into storage.buckets (id, name, public) values ('bukti', 'bukti', false)
on conflict (id) do nothing;


-- Jalankan sekali di Supabase > SQL Editor.
-- Kolom formulir (kaos / alergi) kini bisa diatur per kegiatan dari panel panitia.
alter table public.kegiatan add column if not exists tanya_kaos boolean not null default false;
alter table public.kegiatan add column if not exists tanya_kesehatan boolean not null default false;

-- Kegiatan yang SUDAH ada tetap menampilkan kedua kolom seperti sebelumnya
-- (hapus centangnya lewat tombol Edit jika tidak diperlukan).
update public.kegiatan set tanya_kaos = true, tanya_kesehatan = true;
