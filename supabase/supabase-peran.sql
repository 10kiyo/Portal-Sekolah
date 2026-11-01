-- ============================================================
-- MENU PER PERAN (Administrasi Guru dan Staf): pustakawan, keuangan, persuratan, operator
-- Jalankan di Supabase > SQL Editor SETELAH supabase-guru.sql. Aman dijalankan ulang.
-- ============================================================

-- 1) Kolom peran di guru_staf. Nilai: guru | pustakawan | keuangan | persuratan | operator | staf | admin
--    (kosong = ditebak otomatis dari jabatan; "admin" melihat semua menu, hanya bisa diatur dari Supabase)
alter table guru_staf add column if not exists peran text;
alter table guru_staf drop constraint if exists guru_staf_peran_chk;
alter table guru_staf add constraint guru_staf_peran_chk
  check (peran is null or peran in ('guru','pustakawan','keuangan','persuratan','operator','staf','admin'));

-- 2) Trigger: username, PIN, dan peran otomatis
create or replace function guru_staf_isi() returns trigger language plpgsql as $$
declare dasar text; calon text; n int := 1;
begin
  if new.username is null or btrim(new.username) = '' then
    dasar := lower(regexp_replace(split_part(new.nama, ',', 1), '[^A-Za-z ]', '', 'g'));
    dasar := array_to_string((regexp_split_to_array(btrim(dasar), '\s+'))[1:2], '.');
    if dasar is null or dasar = '' then dasar := 'guru'; end if;
    calon := dasar;
    while exists (select 1 from guru_staf where lower(username) = calon and id <> new.id) loop
      n := n + 1; calon := dasar || n;
    end loop;
    new.username := calon;
  else
    new.username := lower(btrim(new.username));
  end if;
  if new.pin is null or btrim(new.pin) = '' then
    new.pin := (100000 + abs(('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint) % 900000)::text;   -- 6 angka, angka pertama 1-9 (0 di depan sering hilang di CSV/Excel)
  end if;
  if new.peran is null or btrim(new.peran) = '' then
    new.peran := case
      when coalesce(new.jabatan, '') ~* 'pustaka'            then 'pustakawan'
      when coalesce(new.jabatan, '') ~* 'bendahara|keuangan' then 'keuangan'
      when coalesce(new.jabatan, '') ~* 'surat|sekretar'     then 'persuratan'
      when coalesce(new.jabatan, '') ~* 'operator'           then 'operator'
      when new.kelompok = 'staf'                             then 'staf'
      else 'guru' end;
  end if;
  return new;
end $$;

-- isi peran untuk baris yang sudah ada (memicu trigger di atas)
update guru_staf set peran = null where peran is null;

-- 3) Peran akun yang sedang login (dipakai aturan akses tabel di bawah)
create or replace function peran_saya() returns text language sql stable security definer set search_path = public as $$
  select peran from guru_staf where auth_user_id = auth.uid() and aktif limit 1
$$;
revoke all on function peran_saya() from public, anon;
grant execute on function peran_saya() to authenticated;

-- operator boleh melihat & mengelola akun guru/staf (username, PIN, jabatan)
drop policy if exists guru_staf_operator on guru_staf;
create policy guru_staf_operator on guru_staf for all to authenticated
  using (peran_saya() in ('operator','admin')) with check (peran_saya() in ('operator','admin'));

-- 4) Tabel pekerjaan tiap peran
create table if not exists pendaftaran_kegiatan (          -- pustakawan: ekskul & club
  id uuid primary key default gen_random_uuid(), jenis text not null check (jenis in ('ekskul','club')),
  kegiatan text not null, guest_id text not null, nama text not null, kelas text, catatan text,
  created_at timestamptz not null default now(), unique (jenis, kegiatan, guest_id));
create table if not exists perpus_pinjam (                 -- pustakawan: peminjaman buku
  id uuid primary key default gen_random_uuid(), judul text not null, peminjam text not null,
  tgl_pinjam date not null default current_date, tenggat date, tgl_kembali date,
  status text not null default 'dipinjam' check (status in ('dipinjam','kembali')), catatan text,
  created_at timestamptz not null default now());
create table if not exists keuangan_transaksi (            -- keuangan: kas masuk & keluar
  id uuid primary key default gen_random_uuid(), tanggal date not null default current_date,
  jenis text not null check (jenis in ('masuk','keluar')), kategori text, uraian text not null,
  jumlah numeric(16,0) not null check (jumlah >= 0), ref text, created_at timestamptz not null default now());
create table if not exists keuangan_dokumen (              -- keuangan: proposal & LPJ
  id uuid primary key default gen_random_uuid(), jenis text not null check (jenis in ('proposal','lpj')),
  judul text not null, pengaju text, nominal numeric(16,0), tanggal date not null default current_date,
  status text not null default 'draf', terkait text, link text, catatan text, created_at timestamptz not null default now());
create table if not exists surat (                         -- persuratan: surat masuk & keluar
  id uuid primary key default gen_random_uuid(), jenis text not null check (jenis in ('masuk','keluar')),
  nomor text, tanggal date not null default current_date, pihak text, perihal text not null,
  status text, catatan text, link text, created_at timestamptz not null default now());
create table if not exists tugas_operator (                -- operator: daftar pekerjaan
  id uuid primary key default gen_random_uuid(), judul text not null, kategori text, tenggat date,
  status text not null default 'belum' check (status in ('belum','proses','selesai')), catatan text,
  created_at timestamptz not null default now());

-- 5) Keamanan: tiap tabel hanya bisa dipakai peran yang bersangkutan (dan admin)
do $$ declare r record; begin
  for r in select * from (values
    ('pendaftaran_kegiatan','pustakawan'), ('perpus_pinjam','pustakawan'),
    ('keuangan_transaksi','keuangan'), ('keuangan_dokumen','keuangan'),
    ('surat','persuratan'), ('tugas_operator','operator')) v(t, p) loop
    execute format('alter table %I enable row level security', r.t);
    execute format('revoke all on %I from anon', r.t);
    execute format('drop policy if exists %I on %I', r.t || '_peran', r.t);
    execute format('create policy %I on %I for all to authenticated using (peran_saya() in (%L, ''admin'')) with check (peran_saya() in (%L, ''admin''))',
                   r.t || '_peran', r.t, r.p, r.p);
  end loop;
end $$;

-- CATATAN
-- * Ganti peran seseorang: ubah kolom peran di guru_staf (atau lewat menu Akun Guru & Staf milik operator).
-- * Akun yang Anda pakai sendiri untuk mengelola semuanya: set peran = 'admin'.
-- * Peran hanya ditebak otomatis saat baris dibuat/peran kosong; mengubah jabatan nanti tidak mengubah peran.
