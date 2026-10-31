-- ============================================================
-- BIMBINGAN KONSELING (BK): peran "bk", kelas yang dipegang tiap guru BK, kedisiplinan & poin,
-- tindak lanjut/SP, konseling rahasia, catatan orang tua, pengaturan.
-- Jalankan di Supabase > SQL Editor SETELAH supabase-fasilitas.sql (butuh fungsi punya_peran()).
-- JALANKAN SEBELUM DEPLOY. Aman dijalankan ulang (data tidak ditimpa).
-- CATATAN: setelah ini, JANGAN jalankan ulang supabase-fasilitas.sql / supabase-peran.sql (keduanya menulis ulang
-- aturan peran dan akan menolak nilai 'bk'). Bila terlanjur, jalankan ulang file ini.
-- ============================================================

-- 1) PERAN BK -------------------------------------------------
-- Guru BK tetap mengajar di kelas, jadi cukup diberi peran TAMBAHAN 'bk' (peran utama tetap 'guru'):
-- menu Kelas (mengajar) dan menu Bimbingan Konseling tampil bersamaan, sama seperti Waka Sarpras.
alter table guru_staf drop constraint if exists guru_staf_peran_chk;
alter table guru_staf add constraint guru_staf_peran_chk
  check (peran is null or peran in ('guru','pustakawan','keuangan','persuratan','operator','sarpras','bk','staf','admin'));
alter table guru_staf drop constraint if exists guru_staf_peran_tambahan_chk;
alter table guru_staf add constraint guru_staf_peran_tambahan_chk
  check (peran_tambahan <@ array['guru','pustakawan','keuangan','persuratan','operator','sarpras','bk']::text[]);

-- Jabatan memuat "BK" / "bimbingan" / "konseling" otomatis mendapat peran tambahan bk
-- (hanya saat baris baru atau jabatan diubah, supaya operator tetap bisa mencabutnya).
create or replace function guru_staf_bk_isi() returns trigger language plpgsql as $$
declare ubah boolean := true;
begin
  if tg_op = 'UPDATE' then ubah := old.jabatan is distinct from new.jabatan; end if;
  if ubah and new.peran is distinct from 'bk' and new.peran is distinct from 'admin'
     and coalesce(new.jabatan, '') ~* '(^|[^a-z])bk([^a-z]|$)|bimbingan|konseling'
     and not ('bk' = any(new.peran_tambahan)) then
    new.peran_tambahan := array_append(new.peran_tambahan, 'bk');
  end if;
  return new;
end $$;
drop trigger if exists guru_staf_bk_trg on guru_staf;
create trigger guru_staf_bk_trg before insert or update on guru_staf
  for each row execute function guru_staf_bk_isi();

-- Guru BK yang sudah ada: tambahkan peran bk. Bila nama/jabatan mereka tidak memuat kata BK,
-- atur manual: Administrasi Guru dan Staf > Akun guru & staf > centang "bk" pada Peran tambahan.
update guru_staf set peran_tambahan = array_append(peran_tambahan, 'bk')
 where coalesce(jabatan, '') ~* '(^|[^a-z])bk([^a-z]|$)|bimbingan|konseling'
   and peran is distinct from 'bk' and peran is distinct from 'admin'
   and not ('bk' = any(peran_tambahan));

-- 2) FUNGSI BANTU ---------------------------------------------
create or replace function guru_id_saya() returns uuid language sql stable security definer set search_path = public as $$
  select id from guru_staf where auth_user_id = auth.uid() and aktif limit 1
$$;
revoke all on function guru_id_saya() from public, anon;
grant execute on function guru_id_saya() to authenticated;

-- 3) KELAS YANG DIPEGANG TIAP GURU BK -------------------------
-- Diatur sendiri oleh guru BK di menu "Kelas saya". Kelas = teks kelas murid (mis. "3A").
create table if not exists bk_kelas (
  guru_id    uuid not null references guru_staf(id) on delete cascade,
  kelas      text not null,
  created_at timestamptz not null default now(),
  primary key (guru_id, kelas)
);

-- Daftar "kelas siapa" untuk semua guru BK (agar tahu kelas yang sudah dipegang rekannya)
create or replace function bk_pegangan() returns table (guru_id uuid, nama text, kelas text)
language sql stable security definer set search_path = public as $$
  select k.guru_id, g.nama, k.kelas
  from bk_kelas k join guru_staf g on g.id = k.guru_id
  where punya_peran('bk') and g.aktif
$$;
revoke all on function bk_pegangan() from public, anon;
grant execute on function bk_pegangan() to authenticated;

-- 4) MASTER JENIS + POIN --------------------------------------
create table if not exists bk_jenis (
  id         uuid primary key default gen_random_uuid(),
  kategori   text not null check (kategori in ('terlambat','atribut','pelanggaran','prestasi')),
  nama       text not null,
  poin       int  not null default 1 check (poin >= 0),   -- selalu positif; kategori prestasi dihitung sebagai poin prestasi
  urut       int  not null default 100,
  aktif      boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists bk_jenis_uq on bk_jenis (kategori, lower(btrim(nama)));

-- Isi awal (contoh umum untuk SD). SESUAIKAN dengan tata tertib sekolah lewat menu BK > Pengaturan. Hanya diisi bila tabel masih kosong.
insert into bk_jenis (kategori, nama, poin, urut)
select v.k, v.n, v.p, v.u from (values
  ('terlambat','Terlambat masuk sekolah',1,10),
  ('terlambat','Terlambat masuk kelas setelah istirahat',1,20),
  ('atribut','Tidak memakai dasi',1,10),
  ('atribut','Tidak memakai topi',1,20),
  ('atribut','Tidak memakai ikat pinggang',1,30),
  ('atribut','Kaos kaki tidak sesuai ketentuan',1,40),
  ('atribut','Sepatu tidak sesuai ketentuan',1,50),
  ('atribut','Seragam tidak sesuai / tidak rapi',1,60),
  ('atribut','Tidak memakai papan nama',1,70),
  ('atribut','Rambut / kuku tidak sesuai ketentuan',1,80),
  ('pelanggaran','Tidak mengerjakan tugas / PR',2,10),
  ('pelanggaran','Tidak membawa perlengkapan belajar',1,20),
  ('pelanggaran','Keluar kelas tanpa izin',3,30),
  ('pelanggaran','Mengganggu proses belajar',3,40),
  ('pelanggaran','Berkata kasar / tidak sopan',5,50),
  ('pelanggaran','Mengejek / mengolok teman',5,60),
  ('pelanggaran','Membawa HP / barang terlarang',5,70),
  ('pelanggaran','Membuang sampah sembarangan',2,80),
  ('pelanggaran','Mengambil barang milik orang lain',10,90),
  ('pelanggaran','Merusak fasilitas sekolah',10,100),
  ('pelanggaran','Berkelahi',10,110),
  ('pelanggaran','Perundungan (bullying)',15,120),
  ('pelanggaran','Meninggalkan sekolah tanpa izin',10,130),
  ('prestasi','Perilaku terpuji (jujur, menolong, dll.)',3,10),
  ('prestasi','Peningkatan prestasi belajar',3,20),
  ('prestasi','Juara lomba tingkat sekolah',5,30),
  ('prestasi','Juara lomba tingkat kota / provinsi',10,40),
  ('prestasi','Juara lomba tingkat nasional',20,50)
) v(k, n, p, u)
where not exists (select 1 from bk_jenis);

-- 5) CATATAN KEDISIPLINAN (terlambat, atribut, pelanggaran, prestasi) ---
create table if not exists bk_catatan (
  id          uuid primary key default gen_random_uuid(),
  guest_id    text not null,                -- guest_id murid (sama dengan murid_gabungan())
  nama        text not null,                -- salinan nama saat dicatat
  kelas       text,                         -- salinan kelas saat dicatat
  tanggal     date not null default current_date,
  jam         time,
  jenis_id    uuid references bk_jenis(id) on delete set null,
  kategori    text not null check (kategori in ('terlambat','atribut','pelanggaran','prestasi')),
  jenis_nama  text not null,                -- salinan, supaya riwayat tidak berubah bila master diedit
  poin        int  not null default 0 check (poin >= 0),
  keterangan  text,
  dicatat_oleh uuid references guru_staf(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists bk_catatan_guest_idx on bk_catatan (guest_id, tanggal desc);
create index if not exists bk_catatan_tgl_idx   on bk_catatan (tanggal desc);

-- 6) TINDAK LANJUT BERJENJANG / SP ----------------------------
create table if not exists bk_tindak (
  id          uuid primary key default gen_random_uuid(),
  guest_id    text not null,
  nama        text not null,
  kelas       text,
  tanggal     date not null default current_date,
  tingkat     text not null check (tingkat in ('teguran','sp1','sp2','sp3','panggil_ortu','skorsing','lainnya')),
  semester    text not null,                -- mis. '2026/2027 Ganjil'
  total_poin  int,
  alasan      text,
  status      text not null default 'dicatat' check (status in ('dicatat','diserahkan','selesai')),
  dicatat_oleh uuid references guru_staf(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists bk_tindak_guest_idx on bk_tindak (guest_id, tanggal desc);
create index if not exists bk_tindak_sem_idx   on bk_tindak (semester);

-- 7) KONSELING (RAHASIA) --------------------------------------
create table if not exists bk_konseling (
  id          uuid primary key default gen_random_uuid(),
  guest_id    text not null,
  nama        text not null,
  kelas       text,
  tanggal     date not null default current_date,
  bentuk      text not null default 'individu' check (bentuk in ('individu','kelompok','orang_tua')),
  bidang      text not null default 'pribadi' check (bidang in ('pribadi','sosial','belajar','keluarga','perilaku','lainnya')),
  masalah     text not null,
  penanganan  text,
  hasil       text,
  status      text not null default 'baru' check (status in ('baru','diproses','selesai','rujukan')),
  rujukan_ke  text,
  jadwal_lanjut date,
  dicatat_oleh uuid references guru_staf(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists bk_konseling_guest_idx on bk_konseling (guest_id, tanggal desc);
create or replace function bk_konseling_ubah() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists bk_konseling_ubah_trg on bk_konseling;
create trigger bk_konseling_ubah_trg before update on bk_konseling for each row execute function bk_konseling_ubah();

-- 8) ORANG TUA: panggilan, home visit, telepon, pertemuan ------
create table if not exists bk_ortu (
  id          uuid primary key default gen_random_uuid(),
  guest_id    text not null,
  nama        text not null,
  kelas       text,
  tanggal     date not null default current_date,
  bentuk      text not null default 'panggilan' check (bentuk in ('panggilan','home_visit','telepon','pertemuan')),
  perihal     text not null,
  tgl_hadir   date,                         -- untuk panggilan: tanggal orang tua diminta hadir
  jam_hadir   text,
  peserta     text,                         -- nama orang tua/wali yang hadir atau ditemui
  hasil       text,
  perjanjian  text,                         -- isi kesepakatan (dicetak sebagai surat kesepakatan)
  status      text not null default 'direncanakan' check (status in ('direncanakan','selesai')),
  dicatat_oleh uuid references guru_staf(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists bk_ortu_guest_idx on bk_ortu (guest_id, tanggal desc);

-- 9) PENGATURAN BK (dipakai bersama semua guru BK) -------------
create table if not exists bk_pengaturan (
  kunci      text primary key,
  nilai      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into bk_pengaturan (kunci, nilai) values
  ('ambang', '{"teguran":5,"sp1":10,"sp2":20,"sp3":30}'),   -- poin pelanggaran per semester untuk tiap tingkat tindak lanjut
  ('ortu',   '{"tampil":true}'),                              -- tampilkan ringkasan kedisiplinan di halaman Pantau Belajar Anak
  ('surat',  '{"kepsek":"","nip":"","kota":"Jakarta","alamat":""}')
on conflict (kunci) do nothing;

-- 10) KEAMANAN: hanya peran bk (dan admin) ---------------------
-- Wali kelas, guru lain, operator, dll. TIDAK bisa membaca tabel-tabel ini (termasuk konseling).
-- bk_kelas: semua guru BK boleh membaca; mengubah hanya baris milik sendiri (admin bebas).
do $$ declare t text; begin
  foreach t in array array['bk_jenis','bk_catatan','bk_tindak','bk_konseling','bk_ortu','bk_pengaturan'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('drop policy if exists %I on %I', t || '_bk', t);
    execute format('create policy %I on %I for all to authenticated using (punya_peran(''bk'')) with check (punya_peran(''bk''))', t || '_bk', t);
  end loop;
end $$;

alter table bk_kelas enable row level security;
revoke all on bk_kelas from anon;
grant select, insert, update, delete on bk_kelas to authenticated;
drop policy if exists bk_kelas_baca on bk_kelas;
create policy bk_kelas_baca on bk_kelas for select to authenticated using (punya_peran('bk'));
drop policy if exists bk_kelas_tulis on bk_kelas;
create policy bk_kelas_tulis on bk_kelas for all to authenticated
  using (punya_peran('bk') and (guru_id = guru_id_saya() or peran_saya() = 'admin'))
  with check (punya_peran('bk') and (guru_id = guru_id_saya() or peran_saya() = 'admin'));

-- CATATAN
-- * Dua guru BK: beri keduanya peran tambahan 'bk' (otomatis bila jabatan memuat "BK"/"Bimbingan"/"Konseling").
--   Masing-masing memilih kelasnya di menu BK > Kelas saya. Data kedisiplinan/konseling tetap bisa dilihat kedua guru BK
--   (opsi "Tampilkan semua kelas"), sehingga bisa saling menggantikan saat salah satu berhalangan.
-- * Halaman orang tua (Pantau Belajar Anak) membaca ringkasan kedisiplinan lewat functions/api/ortu-lookup.js
--   (service role). Konseling & catatan orang tua TIDAK pernah dikirim ke halaman itu.
