-- ============================================================
-- TAHAP 2: (A) Kegiatan per tingkat kelas + pendaftaran umum
--          (B) Operator: edit/tambah data murid, tersinkron ke semua guru
-- Jalankan di Supabase > SQL Editor SETELAH supabase-kartu.sql. Aman dijalankan ulang.
-- JALANKAN SEBELUM DEPLOY kode baru (kode baru menyimpan kolom-kolom di bawah).
-- ============================================================

-- ---------- (A) KEGIATAN ----------
-- tingkat      : daftar tingkat yang boleh mendaftar, mis. {1,2,3}. NULL / kosong = semua kelas.
-- untuk_umum   : true = ada tautan pendaftaran terbuka untuk peserta dari sekolah lain (tanpa kode akses murid).
-- tampil_info  : true = kegiatan umum yang sedang dibuka ikut tampil di halaman Info Terbaru.
alter table kegiatan add column if not exists tingkat     smallint[];
alter table kegiatan add column if not exists untuk_umum  boolean not null default false;
alter table kegiatan add column if not exists tampil_info boolean not null default true;
alter table kegiatan drop constraint if exists kegiatan_tingkat_chk;
alter table kegiatan add constraint kegiatan_tingkat_chk
  check (tingkat is null or tingkat <@ array[1,2,3,4,5,6]::smallint[]);

-- Peserta umum yang kegiatannya gratis tidak punya bukti transfer; pastikan kolom-kolom ini boleh kosong.
do $$ declare c text; begin
  foreach c in array array['bukti_path','nama_pengirim','tanggal_transfer'] loop
    begin execute format('alter table pendaftaran_kegiatan alter column %I drop not null', c);
    exception when undefined_column or undefined_table then null; end;
  end loop;
end $$;

-- ---------- (B) DATA MURID OLEH OPERATOR ----------
-- Sumber utama murid tetap daftar_tamu_gabungan (tidak diubah sama sekali).
-- Perubahan operator disimpan sebagai "lapisan" di murid_profil, lalu digabung oleh fungsi murid_gabungan():
--   * baris murid yang sudah ada : kolom nama / kelas yang diisi menimpa nilai dari daftar tamu; nonaktif = true menyembunyikan murid
--   * murid baru buatan operator : sumber = 'operator' (guest_id berawalan OP-), wajib punya nama, kelas, jenis
-- Guru memakai guest_id yang sama sebagai kunci, jadi murid yang namanya/kelasnya diubah TIDAK dibuat ulang:
-- baris kelas_murid (beserta presensi, nilai, kode akses) tetap, hanya nama/kelasnya yang diperbarui.
alter table murid_profil add column if not exists nama      text;
alter table murid_profil add column if not exists kelas     text;
alter table murid_profil add column if not exists jenis     text;
alter table murid_profil add column if not exists nonaktif  boolean not null default false;
alter table murid_profil add column if not exists sumber    text    not null default 'database';
alter table murid_profil drop constraint if exists murid_profil_sumber_chk;
alter table murid_profil add constraint murid_profil_sumber_chk check (sumber in ('database','operator'));

-- Daftar murid gabungan: dibaca guru (sinkron murid), pustakawan, operator.
-- Bentuk kolom sama dengan daftar_tamu_gabungan agar kode lama tinggal memakainya.
create or replace function murid_gabungan()
returns table (guest_id text, guest_name text, jenis_undangan text, instansi_kelas text)
language sql stable security definer set search_path = public as $$
  select coalesce(g.guest_id::text, p.guest_id),
         coalesce(nullif(btrim(p.nama), ''),  g.guest_name),
         coalesce(g.jenis_undangan, p.jenis),
         coalesce(nullif(btrim(p.kelas), ''), g.instansi_kelas)
  from daftar_tamu_gabungan g
  full join murid_profil p on p.guest_id = g.guest_id::text
  where not coalesce(p.nonaktif, false)
    and (g.guest_id is not null or p.sumber = 'operator')
$$;
revoke all on function murid_gabungan() from public, anon;
grant execute on function murid_gabungan() to authenticated;
