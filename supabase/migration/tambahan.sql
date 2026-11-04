-- Kompatibilitas skema awal Supabase dengan halaman Administrasi Guru dan Staf.
-- Jalankan satu kali setelah 01_master_core.sql dan 02_auth_and_roles.sql.
-- Migrasi ini menambah kolom yang dipakai aplikasi tanpa mengganti/menghapus
-- data kanonis guru_staf (nama_lengkap, pin_hash, foto_url, is_active).

BEGIN;

-- Aplikasi lama dan endpoint publik memakai nama kolom berbeda. Pertahankan
-- kolom asli migrasi, lalu sinkronkan kedua format lewat trigger.
ALTER TABLE public.guru_staf
  ADD COLUMN IF NOT EXISTS nama TEXT,
  ADD COLUMN IF NOT EXISTS pin TEXT,
  ADD COLUMN IF NOT EXISTS foto TEXT,
  ADD COLUMN IF NOT EXISTS aktif BOOLEAN,
  ADD COLUMN IF NOT EXISTS kelompok TEXT,
  ADD COLUMN IF NOT EXISTS urutan_tampil INTEGER,
  ADD COLUMN IF NOT EXISTS peran TEXT,
  ADD COLUMN IF NOT EXISTS peran_tambahan JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- PIN lama yang disimpan di pin_hash tidak dapat dipakai sebagai PIN teks
-- aplikasi. Biarkan kolom lama nullable; jangan menyalin hash ke kolom pin.
ALTER TABLE public.guru_staf ALTER COLUMN pin_hash DROP NOT NULL;

ALTER TABLE public.murid
  ADD COLUMN IF NOT EXISTS guest_id TEXT,
  ADD COLUMN IF NOT EXISTS kelas_label TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS murid_guest_id_uidx
  ON public.murid (guest_id);

-- Jika tambahan.sql versi sebelumnya sudah mengubah peran_tambahan menjadi
-- TEXT, konversikan nilainya sebelum mengganti tipe kolom. Tidak ada data peran
-- yang dibuang: JSON array dipertahankan, teks biasa dijadikan array satu item.
DO $$
DECLARE
  tipe TEXT;
  r RECORD;
  nilai JSONB;
BEGIN
  SELECT data_type INTO tipe
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'guru_staf'
    AND column_name = 'peran_tambahan';

  IF tipe IS NOT NULL AND tipe <> 'jsonb' THEN
    ALTER TABLE public.guru_staf ADD COLUMN IF NOT EXISTS peran_tambahan_json JSONB;
    FOR r IN EXECUTE 'SELECT id, peran_tambahan::text AS isi FROM public.guru_staf' LOOP
      nilai := '[]'::jsonb;
      IF NULLIF(BTRIM(r.isi), '') IS NOT NULL THEN
        BEGIN
          nilai := r.isi::jsonb;
          IF jsonb_typeof(nilai) = 'string' THEN
            nilai := jsonb_build_array(nilai #>> '{}');
          ELSIF jsonb_typeof(nilai) <> 'array' THEN
            nilai := jsonb_build_array(r.isi);
          END IF;
        EXCEPTION WHEN others THEN
          nilai := jsonb_build_array(BTRIM(r.isi));
        END;
      END IF;
      UPDATE public.guru_staf
      SET peran_tambahan_json = nilai
      WHERE id = r.id;
    END LOOP;

    ALTER TABLE public.guru_staf DROP COLUMN peran_tambahan;
    ALTER TABLE public.guru_staf RENAME COLUMN peran_tambahan_json TO peran_tambahan;
    ALTER TABLE public.guru_staf ALTER COLUMN peran_tambahan SET DEFAULT '[]'::jsonb;
    ALTER TABLE public.guru_staf ALTER COLUMN peran_tambahan SET NOT NULL;
  END IF;
END $$;

UPDATE public.guru_staf
SET nama = COALESCE(NULLIF(BTRIM(nama), ''), nama_lengkap),
    nama_lengkap = COALESCE(NULLIF(BTRIM(nama_lengkap), ''), nama),
    foto = COALESCE(foto, foto_url),
    foto_url = COALESCE(foto_url, foto),
    aktif = COALESCE(aktif, is_active, TRUE),
    is_active = COALESCE(is_active, aktif, TRUE),
    peran_tambahan = CASE
      WHEN peran_tambahan IS NULL OR jsonb_typeof(peran_tambahan) = 'null' THEN '[]'::jsonb
      WHEN jsonb_typeof(peran_tambahan) = 'array' THEN peran_tambahan
      WHEN jsonb_typeof(peran_tambahan) = 'string' THEN jsonb_build_array(peran_tambahan #>> '{}')
      ELSE jsonb_build_array(peran_tambahan::text)
    END;

CREATE OR REPLACE FUNCTION public.portal_sinkron_guru_staf()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  dasar TEXT;
  kandidat TEXT;
  nomor INTEGER := 1;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.nama := COALESCE(NULLIF(BTRIM(NEW.nama), ''), NULLIF(BTRIM(NEW.nama_lengkap), ''));
    NEW.nama_lengkap := COALESCE(NULLIF(BTRIM(NEW.nama_lengkap), ''), NEW.nama);
    NEW.foto := COALESCE(NEW.foto, NEW.foto_url);
    NEW.foto_url := COALESCE(NEW.foto_url, NEW.foto);
    NEW.aktif := COALESCE(NEW.aktif, NEW.is_active, TRUE);
    NEW.is_active := COALESCE(NEW.is_active, NEW.aktif, TRUE);
  ELSE
    IF NEW.nama IS DISTINCT FROM OLD.nama THEN
      NEW.nama_lengkap := NEW.nama;
    ELSIF NEW.nama_lengkap IS DISTINCT FROM OLD.nama_lengkap THEN
      NEW.nama := NEW.nama_lengkap;
    END IF;
    IF NEW.foto IS DISTINCT FROM OLD.foto THEN
      NEW.foto_url := NEW.foto;
    ELSIF NEW.foto_url IS DISTINCT FROM OLD.foto_url THEN
      NEW.foto := NEW.foto_url;
    END IF;
    IF NEW.aktif IS DISTINCT FROM OLD.aktif THEN
      NEW.is_active := NEW.aktif;
    ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      NEW.aktif := NEW.is_active;
    END IF;
  END IF;

  IF NEW.nama IS NULL OR BTRIM(NEW.nama) = '' THEN
    RAISE EXCEPTION 'Nama guru/staf wajib diisi.';
  END IF;

  IF NEW.username IS NULL OR BTRIM(NEW.username) = '' THEN
    dasar := LEFT(
      TRIM(BOTH '.' FROM REGEXP_REPLACE(LOWER(NEW.nama), '[^a-z0-9]+', '.', 'g')),
      34
    );
    IF LENGTH(dasar) < 2 THEN dasar := 'staf'; END IF;
    kandidat := dasar;
    WHILE EXISTS (
      SELECT 1 FROM public.guru_staf
      WHERE username = kandidat AND (TG_OP = 'INSERT' OR id <> NEW.id)
    ) LOOP
      nomor := nomor + 1;
      kandidat := LEFT(dasar, 40 - LENGTH(nomor::text) - 1) || '.' || nomor::text;
    END LOOP;
    NEW.username := kandidat;
  END IF;

  -- PIN enam digit dibuat secara kriptografis untuk akun baru atau reset PIN.
  IF NEW.pin IS NULL OR BTRIM(NEW.pin) = '' THEN
    NEW.pin := (100000 + (('x' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 900000))::text;
  END IF;
  IF NEW.pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'PIN harus terdiri dari enam angka.';
  END IF;
  NEW.peran_tambahan := COALESCE(NEW.peran_tambahan, '[]'::jsonb);
  IF jsonb_typeof(NEW.peran_tambahan) <> 'array' THEN
    RAISE EXCEPTION 'peran_tambahan harus berupa JSON array.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portal_sinkron_guru_staf ON public.guru_staf;
CREATE TRIGGER portal_sinkron_guru_staf
BEFORE INSERT OR UPDATE ON public.guru_staf
FOR EACH ROW EXECUTE FUNCTION public.portal_sinkron_guru_staf();

-- Isi kredensial untuk baris lama yang belum mempunyai username/PIN.
-- PIN yang dihasilkan dapat di-reset dan dilihat Operator lewat menu Akun.
UPDATE public.guru_staf
SET username = NULLIF(username, ''),
    pin = COALESCE(pin, '');

-- Peran aplikasi disimpan di guru_staf.peran dan peran_tambahan; enum/tabel
-- guru_peran dari skema baru tidak menjadi sumber otorisasi aplikasi.
CREATE OR REPLACE FUNCTION public.portal_punya_peran(peran_dicari TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.guru_staf g
    WHERE g.auth_user_id = auth.uid()
      AND g.aktif = TRUE
      AND (
        g.peran = ANY(peran_dicari)
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(g.peran_tambahan) AS p(role)
          WHERE p.role = ANY(peran_dicari)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.portal_boleh_baca_profil_murid(id_tamu TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  boleh BOOLEAN := FALSE;
BEGIN
  IF public.portal_punya_peran(ARRAY['operator', 'admin', 'pustakawan']) THEN
    RETURN TRUE;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  IF to_regclass('public.kelas_murid') IS NULL THEN
    RETURN FALSE;
  END IF;
  EXECUTE
    'SELECT EXISTS (
       SELECT 1 FROM public.kelas_murid
       WHERE guru_id = $1 AND guest_id = $2 AND aktif = TRUE
     )'
    INTO boleh
    USING auth.uid(), id_tamu;
  RETURN COALESCE(boleh, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_punya_peran(TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_boleh_baca_profil_murid(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_punya_peran(TEXT[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_boleh_baca_profil_murid(TEXT) TO authenticated, service_role;

DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('guru_staf', 'murid', 'guru_peran')
  LOOP
    EXECUTE FORMAT('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- Hilangkan policy lama yang membocorkan seluruh kolom (termasuk PIN) ke publik.
DROP POLICY IF EXISTS "Publik bisa lihat data umum guru" ON public.guru_staf;
DROP POLICY IF EXISTS "Ortu akses murid via kode akses" ON public.murid;
DROP POLICY IF EXISTS "Akses penuh guru_peran" ON public.guru_peran;

ALTER TABLE public.guru_staf ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guru_staf FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guru_staf TO authenticated;

-- Akses data murid untuk publik/orang tua harus melalui endpoint Worker yang
-- memvalidasi kode akses, bukan policy SELECT publik yang mencakup semua murid.
ALTER TABLE public.murid ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.murid FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.murid TO service_role;

DROP POLICY IF EXISTS "portal staf baca profil sendiri atau operator" ON public.guru_staf;
CREATE POLICY "portal staf baca profil sendiri atau operator"
ON public.guru_staf FOR SELECT TO authenticated
USING (auth_user_id = auth.uid() OR public.portal_punya_peran(ARRAY['operator', 'admin']));

DROP POLICY IF EXISTS "portal operator tambah akun staf" ON public.guru_staf;
CREATE POLICY "portal operator tambah akun staf"
ON public.guru_staf FOR INSERT TO authenticated
WITH CHECK (public.portal_punya_peran(ARRAY['operator', 'admin']));

DROP POLICY IF EXISTS "portal operator ubah akun staf" ON public.guru_staf;
CREATE POLICY "portal operator ubah akun staf"
ON public.guru_staf FOR UPDATE TO authenticated
USING (public.portal_punya_peran(ARRAY['operator', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['operator', 'admin']));

DROP POLICY IF EXISTS "portal operator hapus akun staf" ON public.guru_staf;
CREATE POLICY "portal operator hapus akun staf"
ON public.guru_staf FOR DELETE TO authenticated
USING (public.portal_punya_peran(ARRAY['operator', 'admin']));

-- Daftar pekerjaan operator mengikuti kolom yang dipakai modul-staf.js.
CREATE TABLE IF NOT EXISTS public.tugas_operator (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul TEXT NOT NULL,
  kategori TEXT,
  tenggat DATE,
  catatan TEXT,
  status TEXT NOT NULL DEFAULT 'belum' CHECK (status IN ('belum', 'proses', 'selesai')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.tugas_operator
  ADD COLUMN IF NOT EXISTS judul TEXT,
  ADD COLUMN IF NOT EXISTS kategori TEXT,
  ADD COLUMN IF NOT EXISTS tenggat DATE,
  ADD COLUMN IF NOT EXISTS catatan TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'belum',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tugas_operator'
      AND column_name = 'guru_staf_id'
  ) THEN
    ALTER TABLE public.tugas_operator ALTER COLUMN guru_staf_id DROP NOT NULL;
  END IF;
END $$;
UPDATE public.tugas_operator SET judul = COALESCE(judul, 'Tugas lama'), status = COALESCE(status, 'belum');
ALTER TABLE public.tugas_operator ALTER COLUMN judul SET NOT NULL;
ALTER TABLE public.tugas_operator ALTER COLUMN status SET DEFAULT 'belum';
ALTER TABLE public.tugas_operator ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tugas_operator FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tugas_operator TO authenticated;

DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tugas_operator'
  LOOP
    EXECUTE FORMAT('DROP POLICY %I ON public.tugas_operator', p.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Akses penuh tugas_operator" ON public.tugas_operator;
DROP POLICY IF EXISTS "portal operator kelola tugas" ON public.tugas_operator;
CREATE POLICY "portal operator kelola tugas"
ON public.tugas_operator FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['operator', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['operator', 'admin']));

-- murid_profil adalah lapisan edit/import operator, bukan view dari tabel murid.
-- Aplikasi melakukan INSERT/UPDATE/UPSERT ke sini dengan guest_id sebagai ID.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'murid_profil' AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.murid_profil;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.murid_profil (
  guest_id TEXT PRIMARY KEY,
  nama_ref TEXT,
  nama TEXT,
  kelas TEXT,
  jenis TEXT,
  nonaktif BOOLEAN NOT NULL DEFAULT FALSE,
  sumber TEXT,
  nis TEXT,
  nisn TEXT,
  nama_panggilan TEXT,
  jenis_kelamin CHAR(1) CHECK (jenis_kelamin IN ('L', 'P')),
  tempat_lahir TEXT,
  tanggal_lahir DATE,
  alamat TEXT,
  foto_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.murid_profil
  ADD COLUMN IF NOT EXISTS nama_ref TEXT,
  ADD COLUMN IF NOT EXISTS nama TEXT,
  ADD COLUMN IF NOT EXISTS kelas TEXT,
  ADD COLUMN IF NOT EXISTS jenis TEXT,
  ADD COLUMN IF NOT EXISTS nonaktif BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sumber TEXT,
  ADD COLUMN IF NOT EXISTS nis TEXT,
  ADD COLUMN IF NOT EXISTS nisn TEXT,
  ADD COLUMN IF NOT EXISTS nama_panggilan TEXT,
  ADD COLUMN IF NOT EXISTS jenis_kelamin CHAR(1),
  ADD COLUMN IF NOT EXISTS tempat_lahir TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_lahir DATE,
  ADD COLUMN IF NOT EXISTS alamat TEXT,
  ADD COLUMN IF NOT EXISTS foto_path TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS murid_profil_guest_id_uidx
  ON public.murid_profil (guest_id);

-- Kode akses disimpan terpisah agar guru tidak dapat membacanya lewat
-- kebijakan baca profil kelas.
CREATE TABLE IF NOT EXISTS public.operator_kode_akses (
  guest_id TEXT PRIMARY KEY REFERENCES public.murid_profil(guest_id) ON DELETE CASCADE,
  murid_id UUID NOT NULL UNIQUE REFERENCES public.murid(id) ON DELETE CASCADE,
  kode_akses_ortu VARCHAR(10) NOT NULL UNIQUE
);
ALTER TABLE public.operator_kode_akses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operator_kode_akses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.operator_kode_akses TO authenticated;

DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('murid_profil', 'operator_kode_akses')
  LOOP
    EXECUTE FORMAT('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "portal operator baca kode akses murid" ON public.operator_kode_akses;
CREATE POLICY "portal operator baca kode akses murid"
ON public.operator_kode_akses FOR SELECT TO authenticated
USING (public.portal_punya_peran(ARRAY['operator', 'admin']));

CREATE OR REPLACE FUNCTION public.portal_sinkron_murid_profil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_murid_id UUID;
  v_kelas_id UUID;
  v_kode TEXT;
BEGIN
  IF COALESCE(NEW.sumber, '') <> 'operator'
     AND COALESCE(NEW.jenis, '') !~* '(siswa|murid|anak)' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_murid_id FROM public.murid WHERE guest_id = NEW.guest_id;
  IF v_murid_id IS NULL AND NULLIF(BTRIM(NEW.nisn), '') IS NOT NULL THEN
    SELECT id INTO v_murid_id FROM public.murid WHERE nisn = NEW.nisn;
  END IF;
  IF v_murid_id IS NULL AND NULLIF(BTRIM(NEW.nis), '') IS NOT NULL THEN
    SELECT id INTO v_murid_id FROM public.murid WHERE nis = NEW.nis;
  END IF;

  SELECT id INTO v_kelas_id
  FROM public.kelas
  WHERE nama_kelas = NEW.kelas
  ORDER BY tahun_ajaran DESC
  LIMIT 1;

  IF v_murid_id IS NULL THEN
    INSERT INTO public.murid (
      guest_id, nis, nisn, nama_lengkap, jenis_kelamin, kelas_id, kelas_label, status
    ) VALUES (
      NEW.guest_id, NULLIF(BTRIM(NEW.nis), ''), NULLIF(BTRIM(NEW.nisn), ''),
      NEW.nama, NEW.jenis_kelamin, v_kelas_id, NEW.kelas,
      CASE WHEN NEW.nonaktif THEN 'nonaktif'::status_murid_enum ELSE 'aktif'::status_murid_enum END
    ) RETURNING id INTO v_murid_id;
  ELSE
      IF EXISTS (
        SELECT 1 FROM public.murid
        WHERE id = v_murid_id AND guest_id IS NOT NULL AND guest_id <> NEW.guest_id
      ) THEN
        RAISE EXCEPTION 'Profil murid % sudah tertaut ke ID tamu lain.', NEW.guest_id;
      END IF;
      UPDATE public.murid AS m
      SET guest_id = NEW.guest_id,
          nis = COALESCE(NULLIF(BTRIM(NEW.nis), ''), m.nis),
          nisn = COALESCE(NULLIF(BTRIM(NEW.nisn), ''), m.nisn),
          nama_lengkap = NEW.nama,
          jenis_kelamin = COALESCE(NEW.jenis_kelamin, m.jenis_kelamin),
        kelas_id = v_kelas_id,
        kelas_label = NEW.kelas,
        status = CASE
          WHEN NEW.nonaktif THEN 'nonaktif'::status_murid_enum
          WHEN m.status = 'nonaktif'::status_murid_enum THEN 'aktif'::status_murid_enum
          ELSE m.status
        END
    WHERE m.id = v_murid_id;
  END IF;

  SELECT kode_akses_ortu INTO v_kode FROM public.murid WHERE id = v_murid_id;
  IF v_kode IS NULL OR BTRIM(v_kode) = '' THEN
    LOOP
      v_kode := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 10));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.murid
        WHERE kode_akses_ortu = v_kode AND id <> v_murid_id
      );
    END LOOP;
    UPDATE public.murid SET kode_akses_ortu = v_kode WHERE id = v_murid_id;
  END IF;

  INSERT INTO public.operator_kode_akses (guest_id, murid_id, kode_akses_ortu)
  VALUES (NEW.guest_id, v_murid_id, v_kode)
  ON CONFLICT (guest_id) DO UPDATE
  SET murid_id = EXCLUDED.murid_id,
      kode_akses_ortu = EXCLUDED.kode_akses_ortu;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portal_sinkron_murid_profil ON public.murid_profil;
CREATE TRIGGER portal_sinkron_murid_profil
AFTER INSERT OR UPDATE ON public.murid_profil
FOR EACH ROW EXECUTE FUNCTION public.portal_sinkron_murid_profil();

-- Sinkronkan profil lama juga; pembaruan berada dalam transaksi migrasi ini.
UPDATE public.murid_profil
SET updated_at = updated_at
WHERE COALESCE(sumber, '') = 'operator'
   OR COALESCE(jenis, '') ~* '(siswa|murid|anak)';

ALTER TABLE public.murid_profil ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.murid_profil FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.murid_profil TO authenticated;

DROP POLICY IF EXISTS "portal staf baca profil murid" ON public.murid_profil;
CREATE POLICY "portal staf baca profil murid"
ON public.murid_profil FOR SELECT TO authenticated
USING (public.portal_boleh_baca_profil_murid(guest_id));

DROP POLICY IF EXISTS "portal operator tambah profil murid" ON public.murid_profil;
CREATE POLICY "portal operator tambah profil murid"
ON public.murid_profil FOR INSERT TO authenticated
WITH CHECK (public.portal_punya_peran(ARRAY['operator', 'admin']));

DROP POLICY IF EXISTS "portal operator ubah profil murid" ON public.murid_profil;
CREATE POLICY "portal operator ubah profil murid"
ON public.murid_profil FOR UPDATE TO authenticated
USING (public.portal_punya_peran(ARRAY['operator', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['operator', 'admin']));

DROP POLICY IF EXISTS "portal operator hapus profil murid" ON public.murid_profil;
CREATE POLICY "portal operator hapus profil murid"
ON public.murid_profil FOR DELETE TO authenticated
USING (public.portal_punya_peran(ARRAY['operator', 'admin']));

-- guru_peran bukan sumber peran yang digunakan aplikasi, dan policy lama
-- "Akses penuh" dihapus agar tabel ini tidak terbuka untuk pengguna umum.
ALTER TABLE public.guru_peran ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guru_peran FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;


-- perbaikan SQL
-- 1. Hapus view lama jika ada
DROP VIEW IF EXISTS public.daftar_tamu_gabungan CASCADE;

-- 2. Buat View daftar_tamu_gabungan dengan nama kolom yang benar
CREATE VIEW public.daftar_tamu_gabungan AS
SELECT 
    id,
    created_at,
    nama_tamu AS guest_name,
    nama_tamu AS nama,
    id AS guest_id,
    instansi_atau_ortu AS instansi,
    tujuan_kunjungan AS tujuan,
    whatsapp_full AS telepon,
    whatsapp_tersamar,
    whatsapp_full,
    tanda_tangan_url,
    keperluan,
    'selesai'::text AS status
FROM public.buku_tamu;

-- 3. Berikan hak akses ke view
GRANT ALL ON public.daftar_tamu_gabungan TO anon, authenticated, service_role;

-- 4. Reload Schema Cache Supabase
NOTIFY pgrst, 'reload schema';

-- SQL lagi tabel daftar tamu gabungan
-- 1. Hapus view lama agar tidak terjadi konflik struktur
DROP VIEW IF EXISTS public.daftar_tamu_gabungan CASCADE;

-- 2. Buat ulang View daftar_tamu_gabungan dengan seluruh kolom yang dibutuhkan aplikasi
CREATE VIEW public.daftar_tamu_gabungan AS
SELECT 
    id,
    created_at,
    nama_tamu AS guest_name,
    nama_tamu AS nama,
    id AS guest_id,
    instansi_atau_ortu AS instansi,
    tujuan_kunjungan AS tujuan,
    whatsapp_full AS telepon,
    whatsapp_tersamar,
    whatsapp_full,
    tanda_tangan_url,
    keperluan,
    'Umum'::text AS jenis_undangan,
    'selesai'::text AS status
FROM public.buku_tamu;

-- 3. Berikan hak akses ke view
GRANT ALL ON public.daftar_tamu_gabungan TO anon, authenticated, service_role;

-- 4. Reload Schema Cache Supabase
NOTIFY pgrst, 'reload schema';

-- GATAU YANG MANA

-- 1. Hapus view lama agar tidak terjadi konflik struktur
DROP VIEW IF EXISTS public.daftar_tamu_gabungan CASCADE;

-- 2. Buat ulang View daftar_tamu_gabungan dengan semua alias kolom aplikasi
CREATE VIEW public.daftar_tamu_gabungan AS
SELECT 
    id,
    created_at,
    nama_tamu AS guest_name,
    nama_tamu AS nama,
    id AS guest_id,
    instansi_atau_ortu AS instansi,
    instansi_atau_ortu AS instansi_kelas,
    tujuan_kunjungan AS tujuan,
    whatsapp_full AS telepon,
    whatsapp_tersamar,
    whatsapp_full,
    tanda_tangan_url,
    keperluan,
    'Umum'::text AS jenis_undangan,
    'selesai'::text AS status
FROM public.buku_tamu;

-- 3. Berikan hak akses ke view
GRANT ALL ON public.daftar_tamu_gabungan TO anon, authenticated, service_role;

-- 4. Reload Schema Cache Supabase
NOTIFY pgrst, 'reload schema';

--- gatau seberapa banyak lagi
-- 1. Tambahkan kolom nama_panggilan ke tabel murid jika belum ada
ALTER TABLE public.murid 
  ADD COLUMN IF NOT EXISTS nama_panggilan TEXT;

-- 2. Hapus View murid_profil lama agar tidak konflik
DROP VIEW IF EXISTS public.murid_profil CASCADE;

-- 3. Buat ulang View murid_profil dengan kolom nama_panggilan dan pemetaan lengkap
CREATE VIEW public.murid_profil AS
SELECT 
    id,
    created_at,
    nama_lengkap AS nama,
    nama_lengkap,
    COALESCE(nama_panggilan, nama_lengkap) AS nama_panggilan,
    nama_lengkap AS guest_name,
    nisn,
    nis,
    kelas_id,
    guest_id
FROM public.murid;

-- 4. Berikan hak akses penuh ke View
GRANT ALL ON public.murid_profil TO anon, authenticated, service_role;

-- 5. Reload Schema Cache Supabase
NOTIFY pgrst, 'reload schema';

-- KUHARAP KAMU TAU
-- 1. Tambahkan seluruh kolom biodata yang dibutuhkan aplikasi ke tabel murid
ALTER TABLE public.murid 
  ADD COLUMN IF NOT EXISTS nama_panggilan TEXT,
  ADD COLUMN IF NOT EXISTS jenis_kelamin TEXT DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS tempat_lahir TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_lahir DATE,
  ADD COLUMN IF NOT EXISTS agama TEXT DEFAULT 'Islam',
  ADD COLUMN IF NOT EXISTS alamat TEXT,
  ADD COLUMN IF NOT EXISTS nama_ayah TEXT,
  ADD COLUMN IF NOT EXISTS nama_ibu TEXT,
  ADD COLUMN IF NOT EXISTS telepon_ortu TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aktif';

-- 2. Hapus View murid_profil lama
DROP VIEW IF EXISTS public.murid_profil CASCADE;

-- 3. Buat ulang View murid_profil dengan seluruh kolom biodata
CREATE VIEW public.murid_profil AS
SELECT 
    id,
    created_at,
    nama_lengkap AS nama,
    nama_lengkap,
    COALESCE(nama_panggilan, nama_lengkap) AS nama_panggilan,
    nama_lengkap AS guest_name,
    nisn,
    nis,
    kelas_id,
    guest_id,
    jenis_kelamin,
    tempat_lahir,
    tanggal_lahir,
    agama,
    alamat,
    nama_ayah,
    nama_ibu,
    telepon_ortu,
    status
FROM public.murid;

-- 4. Berikan hak akses penuh ke View murid_profil
GRANT ALL ON public.murid_profil TO anon, authenticated, service_role;

-- 5. Reload Schema Cache Supabase
NOTIFY pgrst, 'reload schema';

-- ENTAHLAH YG KEBERAPA
-- 1. Tambahkan seluruh kolom tambahan yang dicari frontend ke tabel murid
ALTER TABLE public.murid 
  ADD COLUMN IF NOT EXISTS nama_panggilan TEXT,
  ADD COLUMN IF NOT EXISTS jenis_kelamin TEXT DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS tempat_lahir TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_lahir DATE,
  ADD COLUMN IF NOT EXISTS agama TEXT DEFAULT 'Islam',
  ADD COLUMN IF NOT EXISTS alamat TEXT,
  ADD COLUMN IF NOT EXISTS nama_ayah TEXT,
  ADD COLUMN IF NOT EXISTS nama_ibu TEXT,
  ADD COLUMN IF NOT EXISTS telepon_ortu TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aktif',
  ADD COLUMN IF NOT EXISTS tingkat INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nama_kelas TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS kartu_diunduh BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qr_code_url TEXT;

-- 2. Hapus View murid_profil lama
DROP VIEW IF EXISTS public.murid_profil CASCADE;

-- 3. Buat ulang View murid_profil dengan seluruh kolom tambahan
CREATE VIEW public.murid_profil AS
SELECT 
    id,
    created_at,
    nama_lengkap AS nama,
    nama_lengkap,
    COALESCE(nama_panggilan, nama_lengkap) AS nama_panggilan,
    nama_lengkap AS guest_name,
    nisn,
    nis,
    kelas_id,
    guest_id,
    jenis_kelamin,
    tempat_lahir,
    tanggal_lahir,
    agama,
    alamat,
    nama_ayah,
    nama_ibu,
    telepon_ortu,
    status,
    tingkat,
    nama_kelas,
    kartu_diunduh,
    qr_code_url
FROM public.murid;

-- 4. Hak akses dan reload cache schema
GRANT ALL ON public.murid_profil TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';

-- LAGII

-- 1. Tambahkan kolom ke tabel dasar murid
ALTER TABLE public.murid 
  ADD COLUMN IF NOT EXISTS nama_lengkap TEXT,
  ADD COLUMN IF NOT EXISTS nama_panggilan TEXT,
  ADD COLUMN IF NOT EXISTS jenis_kelamin TEXT DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS tempat_lahir TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_lahir DATE,
  ADD COLUMN IF NOT EXISTS agama TEXT DEFAULT 'Islam',
  ADD COLUMN IF NOT EXISTS alamat TEXT,
  ADD COLUMN IF NOT EXISTS nama_ayah TEXT,
  ADD COLUMN IF NOT EXISTS nama_ibu TEXT,
  ADD COLUMN IF NOT EXISTS telepon_ortu TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aktif',
  ADD COLUMN IF NOT EXISTS tingkat INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nama_kelas TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS kartu_diunduh BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qr_code_url TEXT;

-- 2. Hapus view murid_profil lama
DROP VIEW IF EXISTS public.murid_profil CASCADE;

-- 3. Buat View murid_profil dengan SELURUH alias kolom (Indonesia & Inggris)
CREATE VIEW public.murid_profil AS
SELECT 
    id,
    created_at,
    -- Identitas Nama
    nama_lengkap AS nama,
    nama_lengkap,
    COALESCE(nama_panggilan, nama_lengkap) AS nama_panggilan,
    nama_lengkap AS guest_name,
    id AS guest_id,
    
    -- Nomor Induk
    nisn,
    nis,
    
    -- Kelas & Tingkat
    kelas_id,
    tingkat,
    nama_kelas,
    nama_kelas AS kelas,
    
    -- Biodata
    jenis_kelamin,
    jenis_kelamin AS gender,
    tempat_lahir,
    tanggal_lahir,
    agama,
    alamat,
    
    -- Ortu & Kontak
    nama_ayah,
    nama_ibu,
    telepon_ortu,
    telepon_ortu AS telepon,
    
    -- Status & Sistem Kartu
    status,
    kartu_diunduh,
    qr_code_url,
    qr_code_url AS qr_code
FROM public.murid;

-- 4. Berikan akses dan reload schema API
GRANT ALL ON public.murid_profil TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';

-- gatau deh
-- Pastikan RLS diizinkan untuk dibaca oleh anon & authenticated
ALTER TABLE public.murid ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Izinkan baca murid public" ON public.murid;
CREATE POLICY "Izinkan baca murid public" ON public.murid 
FOR SELECT 
USING (true);

-- Berikan hak akses penuh ke View
GRANT SELECT ON public.murid_profil TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- capeek
-- 1. Berikan izin baca pada tabel dasar murid
ALTER TABLE public.murid ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Izinkan baca publik murid" ON public.murid;
CREATE POLICY "Izinkan baca publik murid" ON public.murid 
FOR SELECT 
USING (true);

-- 2. Berikan izin penuh pada View murid_profil untuk semua role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.murid_profil TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.murid TO anon, authenticated, service_role;

-- 3. Paksa Supabase memuat ulang API Schema Cache
NOTIFY pgrst, 'reload schema';

-- tau ah
-- 1. Lengkapi semua kolom fisik di tabel dasar murid
ALTER TABLE public.murid 
  ADD COLUMN IF NOT EXISTS nama_lengkap TEXT,
  ADD COLUMN IF NOT EXISTS nama_panggilan TEXT,
  ADD COLUMN IF NOT EXISTS nisn TEXT,
  ADD COLUMN IF NOT EXISTS nis TEXT,
  ADD COLUMN IF NOT EXISTS kelas_id UUID,
  ADD COLUMN IF NOT EXISTS jenis_kelamin TEXT DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS tempat_lahir TEXT DEFAULT '-',
  ADD COLUMN IF NOT EXISTS tanggal_lahir DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS agama TEXT DEFAULT 'Islam',
  ADD COLUMN IF NOT EXISTS alamat TEXT DEFAULT '-',
  ADD COLUMN IF NOT EXISTS nama_ayah TEXT DEFAULT '-',
  ADD COLUMN IF NOT EXISTS nama_ibu TEXT DEFAULT '-',
  ADD COLUMN IF NOT EXISTS telepon_ortu TEXT DEFAULT '-',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aktif',
  ADD COLUMN IF NOT EXISTS tingkat INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nama_kelas TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS kartu_diunduh BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qr_code_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS guest_id TEXT;

-- 2. Hapus View lama agar terbarui penuh
DROP VIEW IF EXISTS public.murid_profil CASCADE;

-- 3. Buat View murid_profil dengan seluruh pemetaan kolom kompatibilitas
CREATE VIEW public.murid_profil AS
SELECT 
    id,
    created_at,
    
    -- Pemetaan Nama
    COALESCE(nama_lengkap, '') AS nama,
    COALESCE(nama_lengkap, '') AS nama_lengkap,
    COALESCE(nama_panggilan, nama_lengkap, '') AS nama_panggilan,
    COALESCE(nama_lengkap, '') AS guest_name,
    COALESCE(guest_id, id::text) AS guest_id,
    
    -- Induk
    nisn,
    nis,
    
    -- Kelas & Tingkat
    kelas_id,
    tingkat,
    nama_kelas,
    nama_kelas AS kelas,
    
    -- Biodata
    jenis_kelamin,
    jenis_kelamin AS gender,
    tempat_lahir,
    tanggal_lahir,
    agama,
    alamat,
    
    -- Ortu & Kontak
    nama_ayah,
    nama_ibu,
    telepon_ortu,
    telepon_ortu AS telepon,
    
    -- Status & Kartu
    status,
    kartu_diunduh,
    qr_code_url,
    qr_code_url AS qr_code
FROM public.murid;

-- 4. Berikan Hak Akses Penuh
GRANT SELECT, INSERT, UPDATE, DELETE ON public.murid_profil TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.murid TO anon, authenticated, service_role;

-- 5. Reload Schema Cache PostgREST Supabase
NOTIFY pgrst, 'reload schema';

--lagii
-- 1. Lengkapi kolom di tabel murid
ALTER TABLE public.murid 
  ADD COLUMN IF NOT EXISTS nama_lengkap TEXT,
  ADD COLUMN IF NOT EXISTS nama_panggilan TEXT,
  ADD COLUMN IF NOT EXISTS nisn TEXT,
  ADD COLUMN IF NOT EXISTS nis TEXT,
  ADD COLUMN IF NOT EXISTS kelas_id UUID,
  ADD COLUMN IF NOT EXISTS jenis_kelamin TEXT DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS tempat_lahir TEXT DEFAULT '-',
  ADD COLUMN IF NOT EXISTS tanggal_lahir DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS agama TEXT DEFAULT 'Islam',
  ADD COLUMN IF NOT EXISTS alamat TEXT DEFAULT '-',
  ADD COLUMN IF NOT EXISTS nama_ayah TEXT DEFAULT '-',
  ADD COLUMN IF NOT EXISTS nama_ibu TEXT DEFAULT '-',
  ADD COLUMN IF NOT EXISTS telepon_ortu TEXT DEFAULT '-',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aktif',
  ADD COLUMN IF NOT EXISTS tingkat INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nama_kelas TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS kartu_diunduh BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qr_code_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS guest_id TEXT;

-- 2. Buat ulang View murid_profil
DROP VIEW IF EXISTS public.murid_profil CASCADE;
CREATE VIEW public.murid_profil AS
SELECT 
    id,
    created_at,
    COALESCE(nama_lengkap, '') AS nama,
    COALESCE(nama_lengkap, '') AS nama_lengkap,
    COALESCE(nama_panggilan, nama_lengkap, '') AS nama_panggilan,
    COALESCE(nama_lengkap, '') AS guest_name,
    COALESCE(guest_id, id::text) AS guest_id,
    nisn,
    nis,
    kelas_id,
    tingkat,
    nama_kelas,
    nama_kelas AS kelas,
    jenis_kelamin,
    jenis_kelamin AS gender,
    tempat_lahir,
    tanggal_lahir,
    agama,
    alamat,
    nama_ayah,
    nama_ibu,
    telepon_ortu,
    telepon_ortu AS telepon,
    status,
    kartu_diunduh,
    qr_code_url,
    qr_code_url AS qr_code
FROM public.murid;

-- 3. Buat View murid_gabungan yang dipanggil oleh Network Tab
DROP VIEW IF EXISTS public.murid_gabungan CASCADE;
CREATE VIEW public.murid_gabungan AS
SELECT 
    id,
    created_at,
    COALESCE(nama_lengkap, '') AS nama,
    COALESCE(nama_lengkap, '') AS nama_lengkap,
    COALESCE(nama_panggilan, nama_lengkap, '') AS nama_panggilan,
    COALESCE(nama_lengkap, '') AS guest_name,
    COALESCE(guest_id, id::text) AS guest_id,
    nisn,
    nis,
    kelas_id,
    tingkat,
    nama_kelas,
    nama_kelas AS kelas,
    jenis_kelamin,
    jenis_kelamin AS gender,
    tempat_lahir,
    tanggal_lahir,
    agama,
    alamat,
    nama_ayah,
    nama_ibu,
    telepon_ortu,
    telepon_ortu AS telepon,
    status,
    kartu_diunduh,
    qr_code_url,
    qr_code_url AS qr_code
FROM public.murid;

-- 4. Berikan Hak Akses Penuh
GRANT SELECT, INSERT, UPDATE, DELETE ON public.murid_profil TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.murid_gabungan TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.murid TO anon, authenticated, service_role;

-- 5. Reload Schema Cache Supabase
NOTIFY pgrst, 'reload schema';