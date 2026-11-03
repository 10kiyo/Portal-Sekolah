-- URUTAN: jalankan PALING AWAL (sebelum 01-jurnal.sql, yang menambah kolom ke tabel ini). Tidak butuh skrip lain.
-- Jalankan di Supabase > SQL Editor (sekali saja).
create table if not exists public.info_sekolah (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  kategori text not null default 'pengumuman',   -- pengumuman | agenda | surat | kegiatan | lainnya
  isi text,
  tanggal_terbit date not null default ((now() at time zone 'Asia/Jakarta')::date),
  tanggal_agenda date,                            -- isi bila ada acara/tenggat; muncul di "Agenda mendatang"
  lokasi text,                                    -- jam / tempat (teks bebas)
  sematkan boolean not null default false,
  terbit boolean not null default true,
  lampiran_url text,
  lampiran_nama text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists info_sekolah_terbit_idx on public.info_sekolah (terbit, tanggal_terbit desc);

-- Data hanya diakses lewat Worker (service role), jadi RLS dinyalakan tanpa policy publik.
alter table public.info_sekolah enable row level security;

-- Bucket publik untuk lampiran (PDF surat, gambar poster). Hanya Worker yang bisa menulis.
insert into storage.buckets (id, name, public) values ('info', 'info', true)
on conflict (id) do nothing;
