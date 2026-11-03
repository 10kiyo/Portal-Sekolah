-- Bukti pembayaran formulir SPMB jalur TK Luar (Tahap 1).
-- Jalankan di Supabase SQL Editor.

create table if not exists spmb_bukti_bayar (
  id            uuid primary key default gen_random_uuid(),
  token         uuid not null unique default gen_random_uuid(),   -- dikirim ke browser, dipakai di Tahap 2
  nama          text not null,
  kontak        text not null,
  file_path     text not null,                                    -- path di bucket privat "bukti-bayar"
  status        text not null default 'menunggu'
                check (status in ('menunggu', 'valid', 'ditolak')),
  catatan       text,                                             -- alasan bila ditolak (diisi panitia)
  dipakai_oleh  uuid,                                             -- id pendaftaran yang memakai token ini
  created_at    timestamptz not null default now()
);

create index if not exists spmb_bukti_bayar_kontak_idx on spmb_bukti_bayar (kontak);

-- Semua akses lewat API (service role). Tanpa policy = anon/authenticated tidak bisa baca atau tulis.
alter table spmb_bukti_bayar enable row level security;

-- Bucket penyimpanan PRIVAT (bukan public) untuk berkas bukti.
insert into storage.buckets (id, name, public)
values ('bukti-bayar', 'bukti-bayar', false)
on conflict (id) do nothing;
