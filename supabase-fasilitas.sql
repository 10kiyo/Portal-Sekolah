-- ============================================================
-- FASILITAS SEKOLAH: halaman publik (menu Profil > Fasilitas), dikelola Waka Sarana & Prasarana (peran "sarpras")
-- Jalankan di Supabase > SQL Editor SETELAH supabase-peran.sql. JALANKAN SEBELUM DEPLOY. Aman dijalankan ulang.
-- ============================================================

-- 1) PERAN TAMBAHAN. Satu orang bisa punya lebih dari satu menu: peran utama (kolom peran) + peran_tambahan.
--    Contoh Pak Mahidin: peran = guru (wali kelas) + peran_tambahan = {sarpras} (Waka Sarana & Prasarana) -> kedua menu tampil.
--    Peran baru "sarpras" = menu Kelola fasilitas. Operator mengatur peran tambahan di Akun guru & staf.
alter table guru_staf add column if not exists peran_tambahan text[] not null default '{}';
alter table guru_staf drop constraint if exists guru_staf_peran_chk;
alter table guru_staf add constraint guru_staf_peran_chk
  check (peran is null or peran in ('guru','pustakawan','keuangan','persuratan','operator','sarpras','staf','admin'));
alter table guru_staf drop constraint if exists guru_staf_peran_tambahan_chk;
alter table guru_staf add constraint guru_staf_peran_tambahan_chk
  check (peran_tambahan <@ array['guru','pustakawan','keuangan','persuratan','operator','sarpras']::text[]);

create or replace function guru_staf_isi() returns trigger language plpgsql as $$
declare dasar text; calon text; n int := 1; ubah_jabatan boolean := true;
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
    new.pin := lpad((abs(('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
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
  -- Jabatan sarpras/sarana/prasarana: menu Kelola fasilitas ditambahkan (tanpa mengganti peran utama). Hanya saat baris baru / jabatan berubah,
  -- supaya operator tetap bisa mencabutnya.
  if tg_op = 'UPDATE' then ubah_jabatan := old.jabatan is distinct from new.jabatan; end if;
  if ubah_jabatan and coalesce(new.jabatan, '') ~* 'sarpras|sarana|prasarana' and not ('sarpras' = any(new.peran_tambahan)) then
    new.peran_tambahan := array_append(new.peran_tambahan, 'sarpras');
  end if;
  return new;
end $$;

-- Fungsi akses: benar bila peran utama ATAU peran tambahan cocok (admin selalu boleh)
create or replace function punya_peran(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select peran = 'admin' or peran = p or p = any(peran_tambahan) from guru_staf where auth_user_id = auth.uid() and aktif limit 1), false)
$$;
revoke all on function punya_peran(text) from public, anon;
grant execute on function punya_peran(text) to authenticated;

-- Pak Mahidin / pejabat sarpras yang sudah ada: tambahkan menu sarpras. Bila sebelumnya sempat diberi peran utama 'sarpras'
-- padahal guru/pimpinan (wali kelas), kembalikan peran utamanya ke guru.
update guru_staf set peran = 'guru' where peran = 'sarpras' and kelompok in ('guru','pimpinan');
update guru_staf set peran_tambahan = array_append(peran_tambahan, 'sarpras')
 where (coalesce(jabatan, '') ~* 'sarpras|sarana|prasarana' or nama ilike 'mahidin%') and peran is distinct from 'sarpras' and not ('sarpras' = any(peran_tambahan));

-- 2) Tabel fasilitas
create table if not exists fasilitas (
  id         uuid primary key default gen_random_uuid(),
  nama       text not null,
  kategori   text not null default 'Lainnya',
  deskripsi  text,
  lokasi     text,                                  -- mis. "Gedung A lantai 2"
  kapasitas  text,                                  -- mis. "30 siswa"
  jumlah     int check (jumlah is null or jumlah >= 0),
  kondisi    text not null default 'baik' check (kondisi in ('baik','perlu_perbaikan','dalam_perbaikan')),  -- hanya untuk internal, tidak tampil ke publik
  foto       text[] not null default '{}',          -- alamat https foto; foto pertama = sampul
  tampil     boolean not null default true,         -- false = disembunyikan dari halaman publik
  urutan     int,                                   -- angka kecil tampil lebih dulu
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function fasilitas_waktu() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists fasilitas_waktu_trg on fasilitas;
create trigger fasilitas_waktu_trg before update on fasilitas for each row execute function fasilitas_waktu();

-- 3) Akses: hanya peran sarpras (dan admin). Halaman publik membaca lewat /api/fasilitas (server), bukan langsung.
alter table fasilitas enable row level security;
revoke all on fasilitas from anon;
drop policy if exists fasilitas_peran on fasilitas;
create policy fasilitas_peran on fasilitas for all to authenticated
  using (punya_peran('sarpras')) with check (punya_peran('sarpras'));

-- 4) Bucket foto publik "fasilitas" (foto memang tampil di website); hanya sarpras/admin yang boleh mengunggah & menghapus.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fasilitas', 'fasilitas', true, 3145728, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];
drop policy if exists fasilitas_foto_baca  on storage.objects;
drop policy if exists fasilitas_foto_tulis on storage.objects;
drop policy if exists fasilitas_foto_ganti on storage.objects;
drop policy if exists fasilitas_foto_hapus on storage.objects;
create policy fasilitas_foto_baca  on storage.objects for select to authenticated using (bucket_id = 'fasilitas');
create policy fasilitas_foto_tulis on storage.objects for insert to authenticated with check (bucket_id = 'fasilitas' and punya_peran('sarpras'));
create policy fasilitas_foto_ganti on storage.objects for update to authenticated using (bucket_id = 'fasilitas' and punya_peran('sarpras')) with check (bucket_id = 'fasilitas' and punya_peran('sarpras'));
create policy fasilitas_foto_hapus on storage.objects for delete to authenticated using (bucket_id = 'fasilitas' and punya_peran('sarpras'));
