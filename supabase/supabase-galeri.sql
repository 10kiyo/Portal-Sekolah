-- ============================================================
-- GALERI PRESTASI SISWA (beranda + halaman #galeri): foto yang diunggah admin langsung, tanpa harus dibuat Info.
-- Digabung otomatis dengan gambar lampiran Info berkategori "Prestasi" oleh /api/galeri.
-- Jalankan di Supabase > SQL Editor. JALANKAN SEBELUM DEPLOY. Aman dijalankan ulang.
-- Foto disimpan di bucket "info" yang sudah ada (folder galeri/), jadi tidak perlu membuat bucket baru.
-- ============================================================
create table if not exists galeri_prestasi (
  id         uuid primary key default gen_random_uuid(),
  foto_url   text not null,
  keterangan text,
  tanggal    date not null default current_date,
  tampil     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists galeri_prestasi_urut_idx on galeri_prestasi (tanggal desc, created_at desc);

-- Hanya Worker (service role) yang membaca/menulis; browser tidak punya akses langsung ke tabel ini.
alter table galeri_prestasi enable row level security;
revoke all on galeri_prestasi from anon, authenticated;
