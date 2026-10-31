-- ============================================================
-- GURU & STAFF: satu tabel sumber data (jabatan, foto, mapel, wali kelas)
-- + akun login otomatis (username dari nama, PIN 6 angka dibuat otomatis).
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- ============================================================

-- 1) Tabel guru & staf
create table if not exists guru_staf (
  id           uuid primary key default gen_random_uuid(),
  nama         text not null,                              -- boleh pakai gelar, mis. "Eki Yogawanto, S.Sn"
  jabatan      text,                                       -- tampil di halaman Guru & Staff
  kelompok     text not null default 'guru' check (kelompok in ('pimpinan','guru','staf')),
  mapel        text,                                       -- pisahkan koma, mis. "Matematika, IPAS"
  walikelas    text,                                       -- mis. "3A"
  foto         text,                                       -- "guru/budi.jpg" (folder public/guru) atau alamat https gambar
  urutan       int,                                        -- opsional: angka kecil tampil lebih dulu
  aktif        boolean not null default true,              -- false = disembunyikan & tidak bisa login
  username     text,                                       -- kosong = dibuat otomatis dari nama
  pin          text check (pin is null or pin ~ '^[0-9]{6}$'),   -- kosong = dibuat otomatis (6 angka)
  auth_user_id uuid,                                       -- diisi otomatis saat pertama login (lihat catatan di bawah)
  created_at   timestamptz not null default now()
);
create unique index if not exists guru_staf_nama_uq     on guru_staf (lower(btrim(nama)));
create unique index if not exists guru_staf_username_uq on guru_staf (lower(username));

-- 2) Username & PIN otomatis saat baris baru ditambahkan
create or replace function guru_staf_isi() returns trigger language plpgsql as $$
declare dasar text; calon text; n int := 1;
begin
  if new.username is null or btrim(new.username) = '' then
    dasar := lower(regexp_replace(split_part(new.nama, ',', 1), '[^A-Za-z ]', '', 'g'));   -- buang gelar & tanda baca
    dasar := array_to_string((regexp_split_to_array(btrim(dasar), '\s+'))[1:2], '.');      -- dua kata pertama
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
    new.pin := lpad((abs(('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
  end if;
  return new;
end $$;

drop trigger if exists guru_staf_isi_trg on guru_staf;
create trigger guru_staf_isi_trg before insert or update on guru_staf
  for each row execute function guru_staf_isi();

-- 3) Keamanan: publik (anon) tidak boleh membaca tabel ini (ada PIN). Server memakai service role.
--    Guru yang sudah login hanya boleh membaca baris miliknya sendiri (untuk mengisi nama profil).
alter table guru_staf enable row level security;
drop policy if exists guru_staf_baca_sendiri on guru_staf;
create policy guru_staf_baca_sendiri on guru_staf for select to authenticated using (auth_user_id = auth.uid());

-- 4) Pengaman sinkron murid otomatis (halaman Administrasi Kelas memperbarui nama/kelas murid dari database)
drop policy if exists kelas_murid_ubah_sendiri on kelas_murid;
create policy kelas_murid_ubah_sendiri on kelas_murid for update to authenticated
  using (guru_id = auth.uid()) with check (guru_id = auth.uid());

-- 5) Isi awal: semua guru/staf yang sudah ada di daftar tamu (Buku Tamu) disalin ke tabel ini.
--    Username & PIN langsung dibuat otomatis oleh trigger di atas. Jabatan diisi di langkah 6 / lewat Table Editor.
insert into guru_staf (nama, kelompok)
select distinct on (lower(btrim(regexp_replace(guest_name, '\s+', ' ', 'g'))))
       btrim(regexp_replace(guest_name, '\s+', ' ', 'g')),
       case when jenis_undangan ~* 'guru' then 'guru' else 'staf' end
from daftar_tamu_gabungan
where btrim(coalesce(guest_name, '')) <> ''
  and jenis_undangan ~* 'guru|staf|staff|karyawan|pegawai|tendik|tenaga|pimpinan|kepala sekolah|tata usaha|\ytu\y|satpam|security|cleaning|kebersihan'
  and jenis_undangan !~* 'siswa|murid|anak|orang ?tua|wali ?murid|alumni|tamu umum'
order by lower(btrim(regexp_replace(guest_name, '\s+', ' ', 'g')))
on conflict do nothing;

-- 6) Jabatan awal (cocokkan lewat awal nama; periksa hasilnya di Table Editor, lalu ubah seperlunya)
update guru_staf set jabatan = 'Kepala Sekolah',                    kelompok = 'pimpinan', foto = coalesce(foto, 'guru/nurbaiti.jpg') where nama ilike 'nurbaiti%';
update guru_staf set jabatan = 'Wakakur & Kesiswaan',               kelompok = 'pimpinan', foto = coalesce(foto, 'guru/nurlaila.jpg') where nama ilike 'nurlaila ningrum%';
update guru_staf set jabatan = 'Waka SarPras',                      kelompok = 'pimpinan', foto = coalesce(foto, 'guru/mahidin.jpg')  where nama ilike 'mahidin%';
update guru_staf set jabatan = 'Guru Seni Rupa dan Keterampilan',   kelompok = 'guru'  where nama ilike 'eki yogawanto%';
update guru_staf set jabatan = 'Staf Keuangan',                     kelompok = 'staf'  where nama ilike 'zulmy%';
update guru_staf set jabatan = 'Operator Sekolah',                  kelompok = 'staf'  where nama ~* '^redi\y';
update guru_staf set jabatan = 'Persuratan / Sekretaris',           kelompok = 'staf'  where nama ilike 'sri hartati%';

-- ------------------------------------------------------------
-- CATATAN
-- * Tambah guru/staf baru: Table Editor > guru_staf > Insert row, isi cukup "nama" (dan jabatan).
--   username & pin muncul otomatis. Akun login dibuat otomatis saat orang itu pertama kali masuk.
-- * Ganti PIN: ubah kolom pin (6 angka). Berlaku di login berikutnya.
-- * Guru yang SUDAH punya akun email lama dan ingin datanya (kelas, nilai) tetap terhubung:
--   isi kolom auth_user_id di barisnya dengan id akun itu (Authentication > Users > kolom User UID).
--   Setelah itu ia masuk dengan username + PIN, data lama tetap ada.
-- * Hapus dari halaman publik & blokir login: set aktif = false.
-- ------------------------------------------------------------
