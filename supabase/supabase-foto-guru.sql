-- ============================================================
-- FOTO GURU & STAF: diunggah sendiri oleh orangnya, langsung tampil di halaman Guru & Staff
-- Jalankan di Supabase > SQL Editor SETELAH supabase-guru.sql dan supabase-peran.sql. Aman dijalankan ulang.
-- ============================================================

-- 1) Bucket publik "foto-guru" (foto profil memang tampil di website). Satu file per orang: <auth uid>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-guru', 'foto-guru', true, 2097152, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

-- 2) Setiap guru/staf hanya boleh menulis/mengganti/menghapus FILE MILIKNYA SENDIRI.
drop policy if exists foto_guru_baca    on storage.objects;
drop policy if exists foto_guru_tambah  on storage.objects;
drop policy if exists foto_guru_ganti   on storage.objects;
drop policy if exists foto_guru_hapus   on storage.objects;
create policy foto_guru_baca   on storage.objects for select to authenticated using (bucket_id = 'foto-guru');
create policy foto_guru_tambah on storage.objects for insert to authenticated with check (bucket_id = 'foto-guru' and name = auth.uid()::text || '.jpg');
create policy foto_guru_ganti  on storage.objects for update to authenticated using (bucket_id = 'foto-guru' and name = auth.uid()::text || '.jpg') with check (bucket_id = 'foto-guru' and name = auth.uid()::text || '.jpg');
create policy foto_guru_hapus  on storage.objects for delete to authenticated using (bucket_id = 'foto-guru' and name = auth.uid()::text || '.jpg');

-- 3) Menghubungkan foto ke profil: guru hanya bisa mengisi kolom FOTO miliknya sendiri
--    (nama, jabatan, dan lainnya tetap hanya bisa diubah operator). Alamat dicek harus foto-guru/<uid-nya>.jpg.
create or replace function simpan_foto_saya(p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Belum login'; end if;
  if p_url is null or p_url !~ ('^https://[^/]+/storage/v1/object/public/foto-guru/' || auth.uid()::text || '\.jpg(\?v=[0-9]+)?$') then
    raise exception 'Alamat foto tidak valid';
  end if;
  update guru_staf set foto = p_url where auth_user_id = auth.uid();
  if not found then raise exception 'Akun ini belum terhubung ke daftar guru & staf (hubungi operator)'; end if;
end $$;
revoke all on function simpan_foto_saya(text) from public, anon;
grant execute on function simpan_foto_saya(text) to authenticated;
