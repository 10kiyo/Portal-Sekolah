-- ============================================================
-- BUAT SURAT (menu Persuratan). Jalankan SETELAH supabase-peran.sql. JALANKAN SEBELUM DEPLOY.
-- 1) Kolom isi (jsonb) di tabel surat: menyimpan seluruh isian formulir agar surat bisa dibuka & disalin lagi.
-- 2) Tabel surat_pengaturan: kop surat, kode nomor, penandatangan & tembusan bawaan (1 baris, id = 'utama').
-- ============================================================
alter table surat add column if not exists isi jsonb;

create table if not exists surat_pengaturan (
  id         text primary key default 'utama',
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table surat_pengaturan enable row level security;
revoke all on surat_pengaturan from anon;
grant select, insert, update, delete on surat_pengaturan to authenticated;
drop policy if exists surat_pengaturan_peran on surat_pengaturan;
create policy surat_pengaturan_peran on surat_pengaturan for all to authenticated
  using (peran_saya() in ('persuratan','operator','admin'))
  with check (peran_saya() in ('persuratan','operator','admin'));
