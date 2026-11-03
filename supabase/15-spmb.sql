-- ============================================================
-- SPMB ONLINE: pendaftaran murid baru kelas I (jalur TK At-Taqwa / "dalam" dan jalur TK Luar / "luar").
-- Jalankan sekali di Supabase > SQL Editor. Tidak butuh skrip lain. Aman dijalankan ulang.
-- Data masuk lewat /api/spmb-daftar (formulir publik) dan dibaca panitia lewat /api/admin-spmb (operator / admin).
-- Kedua tabel dikunci rapat: RLS aktif tanpa policy, jadi hanya Worker (service role) yang bisa membaca/menulis.
-- ============================================================

-- 1) Pengaturan periode tiap jalur (bisa diubah panitia dari panel "Pendaftar SPMB" > Pengaturan, mis. untuk gelombang kedua).
create table if not exists public.spmb_pengaturan (
  jalur      text primary key check (jalur in ('dalam', 'luar')),
  aktif      boolean not null default true,
  buka       date not null,
  tutup      date not null,
  updated_at timestamptz not null default now()
);
insert into public.spmb_pengaturan (jalur, buka, tutup)
values ('dalam', '2026-10-01', '2026-11-13'), ('luar', '2026-10-01', '2026-11-13')
on conflict (jalur) do nothing;

-- 2) Data pendaftar
create table if not exists public.spmb_pendaftar (
  id              uuid primary key default gen_random_uuid(),
  no_urut         bigint generated always as identity,
  no_daftar       text,                                  -- diisi otomatis oleh trigger: SPMB27-D-0001 (D = TK At-Taqwa, L = TK Luar)
  tahun_ajaran    text not null default '2027/2028',
  jalur           text not null check (jalur in ('dalam', 'luar')),
  kunci           text not null,                         -- hash nama + tanggal lahir: mencegah pendaftaran ganda
  status          text not null default 'baru'
                  check (status in ('baru', 'perbaikan', 'terverifikasi', 'diterima', 'tidak_diterima', 'mundur')),
  catatan_panitia text,                                  -- tampil ke orang tua di "Cek status pendaftaran"
  checklist       jsonb not null default '{}'::jsonb,    -- kelengkapan berkas fisik & tahapan (diisi panitia)

  -- calon murid
  nama            text not null,
  nama_panggilan  text,
  jenis_kelamin   text check (jenis_kelamin in ('L', 'P')),
  tempat_lahir    text,
  tanggal_lahir   date not null,
  nik             text,
  anak_ke         int,
  jumlah_saudara  int,
  alamat          text,
  kelurahan       text,
  kecamatan       text,
  kota            text,
  kondisi_khusus  text,                                  -- alergi / kondisi kesehatan / kebutuhan khusus

  -- asal sekolah
  asal_tk         text,
  alamat_tk       text,

  -- orang tua / wali
  nama_ayah       text,
  pekerjaan_ayah  text,
  hp_ayah         text,
  nama_ibu        text,
  pekerjaan_ibu   text,
  hp_ibu          text,
  kontak          text not null,                         -- WhatsApp utama (dipakai juga untuk cek status)
  email           text,

  -- berkas (path di bucket privat "spmb")
  foto_path       text,
  akte_path       text,
  kk_path         text,
  bukti_path      text,                                  -- bukti pembayaran formulir (opsional, jalur TK Luar)

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  verified_at     timestamptz,
  unique (tahun_ajaran, kunci)
);
create index if not exists spmb_pendaftar_jalur_status on public.spmb_pendaftar (jalur, status, created_at desc);

-- 3) Nomor pendaftaran otomatis + penanda waktu ubah
create or replace function public.spmb_isi() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.no_daftar := 'SPMB' || right(split_part(new.tahun_ajaran, '/', 1), 2) || '-'
                  || case new.jalur when 'dalam' then 'D' else 'L' end || '-' || lpad(new.no_urut::text, 4, '0');
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists spmb_isi_tr on public.spmb_pendaftar;
create trigger spmb_isi_tr before insert or update on public.spmb_pendaftar
  for each row execute function public.spmb_isi();

-- 4) Kunci rapat: hanya Worker (service role) yang boleh mengakses
alter table public.spmb_pengaturan enable row level security;
alter table public.spmb_pendaftar  enable row level security;
revoke all on public.spmb_pengaturan from anon, authenticated;
revoke all on public.spmb_pendaftar  from anon, authenticated;

-- 5) Bucket PRIVAT untuk foto murid, akte kelahiran, Kartu Keluarga, dan bukti pembayaran formulir
insert into storage.buckets (id, name, public) values ('spmb', 'spmb', false)
on conflict (id) do nothing;
