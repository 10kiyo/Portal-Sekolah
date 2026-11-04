-- Selaraskan skema migration 01-06 dengan kontrak modul lama dan Worker API.
-- Jalankan setelah tambahan.sql. Data siswa/tamu sumber diimpor ke
-- daftar_tamu_gabungan melalui Supabase Table Editor atau CSV.

BEGIN;

-- tambahan.sql versi lama pernah membuat view bernama sama dari buku_tamu.
-- View tersebut bukan sumber roster dan tidak menyimpan data sendiri.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'daftar_tamu_gabungan'
      AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.daftar_tamu_gabungan;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.daftar_tamu_gabungan (
  guest_id TEXT PRIMARY KEY,
  guest_name TEXT NOT NULL,
  jenis_undangan TEXT,
  instansi_kelas TEXT,
  nomor_whatsapp TEXT,
  whatsapp_tersamar TEXT,
  whatsapp_full TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.daftar_tamu_gabungan
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS jenis_undangan TEXT,
  ADD COLUMN IF NOT EXISTS instansi_kelas TEXT,
  ADD COLUMN IF NOT EXISTS nomor_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_tersamar TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_full TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS daftar_tamu_gabungan_guest_id_uidx
  ON public.daftar_tamu_gabungan (guest_id);

-- Modul kelas
CREATE TABLE IF NOT EXISTS public.kelas_kelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL UNIQUE,
  dibuat_oleh UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.kelas_murid (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id UUID NOT NULL DEFAULT auth.uid(),
  kelas_id UUID NOT NULL REFERENCES public.kelas_kelas(id) ON DELETE CASCADE,
  guest_id TEXT,
  nama TEXT NOT NULL,
  kode_akses TEXT,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guru_id, guest_id)
);
CREATE TABLE IF NOT EXISTS public.kelas_mapel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.kelas_ajar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id UUID NOT NULL DEFAULT auth.uid(),
  kelas_id UUID NOT NULL REFERENCES public.kelas_kelas(id) ON DELETE CASCADE,
  mapel_id UUID NOT NULL REFERENCES public.kelas_mapel(id) ON DELETE CASCADE,
  UNIQUE (guru_id, kelas_id, mapel_id)
);
CREATE TABLE IF NOT EXISTS public.kelas_profil (
  guru_id UUID PRIMARY KEY DEFAULT auth.uid(),
  nama TEXT,
  wali_kelas_id UUID REFERENCES public.kelas_kelas(id) ON DELETE SET NULL,
  foto_path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.kelas_pertemuan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas_id UUID NOT NULL REFERENCES public.kelas_kelas(id) ON DELETE CASCADE,
  mapel_id UUID NOT NULL REFERENCES public.kelas_mapel(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  materi TEXT,
  alat_bahan TEXT,
  jurnal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kelas_id, mapel_id, tanggal)
);
CREATE TABLE IF NOT EXISTS public.kelas_presensi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pertemuan_id UUID NOT NULL REFERENCES public.kelas_pertemuan(id) ON DELETE CASCADE,
  murid_id UUID NOT NULL REFERENCES public.kelas_murid(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'H' CHECK (status IN ('H', 'I', 'S', 'A')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pertemuan_id, murid_id)
);
CREATE TABLE IF NOT EXISTS public.kelas_rubrik (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  kriteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.kelas_tugas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas_id UUID NOT NULL REFERENCES public.kelas_kelas(id) ON DELETE CASCADE,
  mapel_id UUID NOT NULL REFERENCES public.kelas_mapel(id) ON DELETE CASCADE,
  rubrik_id UUID REFERENCES public.kelas_rubrik(id) ON DELETE SET NULL,
  judul TEXT NOT NULL,
  instruksi TEXT,
  tenggat DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.kelas_nilai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tugas_id UUID NOT NULL REFERENCES public.kelas_tugas(id) ON DELETE CASCADE,
  murid_id UUID NOT NULL REFERENCES public.kelas_murid(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'belum' CHECK (status IN ('belum', 'dikumpulkan', 'dinilai')),
  nilai NUMERIC(5,2) CHECK (nilai IS NULL OR nilai BETWEEN 0 AND 100),
  skor JSONB,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tugas_id, murid_id)
);
CREATE TABLE IF NOT EXISTS public.kelas_jadwal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas_id UUID NOT NULL REFERENCES public.kelas_kelas(id) ON DELETE CASCADE,
  mapel_id UUID NOT NULL REFERENCES public.kelas_mapel(id) ON DELETE CASCADE,
  hari SMALLINT NOT NULL CHECK (hari BETWEEN 1 AND 7),
  jam_mulai TIME NOT NULL,
  jam_selesai TIME,
  ruang TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.kelas_karya (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tugas_id UUID NOT NULL REFERENCES public.kelas_tugas(id) ON DELETE CASCADE,
  murid_id UUID NOT NULL REFERENCES public.kelas_murid(id) ON DELETE CASCADE,
  path TEXT NOT NULL UNIQUE,
  tampil_ortu BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.kelas_kelas ADD COLUMN IF NOT EXISTS dibuat_oleh UUID DEFAULT auth.uid();
ALTER TABLE public.kelas_murid
  ADD COLUMN IF NOT EXISTS guru_id UUID DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS guest_id TEXT,
  ADD COLUMN IF NOT EXISTS nama TEXT,
  ADD COLUMN IF NOT EXISTS kode_akses TEXT,
  ADD COLUMN IF NOT EXISTS aktif BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.kelas_ajar
  ADD COLUMN IF NOT EXISTS guru_id UUID DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS kelas_id UUID,
  ADD COLUMN IF NOT EXISTS mapel_id UUID;
ALTER TABLE public.kelas_profil
  ADD COLUMN IF NOT EXISTS nama TEXT,
  ADD COLUMN IF NOT EXISTS wali_kelas_id UUID,
  ADD COLUMN IF NOT EXISTS foto_path TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS kelas_murid_guru_guest_uidx ON public.kelas_murid (guru_id, guest_id);
CREATE UNIQUE INDEX IF NOT EXISTS kelas_ajar_guru_kelas_mapel_uidx ON public.kelas_ajar (guru_id, kelas_id, mapel_id);
CREATE INDEX IF NOT EXISTS kelas_murid_kelas_aktif_idx ON public.kelas_murid (kelas_id, aktif);

-- Kode akses yang tampil di menu Kelas berasal dari kode kanonis Operator.
CREATE OR REPLACE FUNCTION public.portal_sinkron_kelas_murid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  nama_kelas TEXT;
BEGIN
  IF NEW.guest_id IS NULL OR BTRIM(NEW.guest_id) = '' THEN
    RETURN NEW;
  END IF;

  SELECT nama INTO nama_kelas
  FROM public.kelas_kelas
  WHERE id = NEW.kelas_id;

  INSERT INTO public.murid_profil (guest_id, nama_ref, nama, kelas, jenis, sumber)
  VALUES (NEW.guest_id, NEW.nama, NEW.nama, nama_kelas, 'murid', 'kelas')
  ON CONFLICT (guest_id) DO NOTHING;

  SELECT kode_akses_ortu INTO NEW.kode_akses
  FROM public.operator_kode_akses
  WHERE guest_id = NEW.guest_id;

  IF NEW.kode_akses IS NULL THEN
    RAISE EXCEPTION 'Kode akses murid belum tersedia; periksa trigger sinkronisasi murid_profil.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS portal_sinkron_kelas_murid ON public.kelas_murid;
CREATE TRIGGER portal_sinkron_kelas_murid
BEFORE INSERT OR UPDATE OF guest_id, kelas_id, nama ON public.kelas_murid
FOR EACH ROW EXECUTE FUNCTION public.portal_sinkron_kelas_murid();
UPDATE public.kelas_murid
SET nama = nama
WHERE guest_id IS NOT NULL;

-- Hak akses kelas: daftar murid hanya terlihat oleh guru pemilik baris.
CREATE OR REPLACE FUNCTION public.portal_guru_ajar(p_kelas UUID, p_mapel UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.portal_punya_peran(ARRAY['admin'])
    OR (
      public.portal_punya_peran(ARRAY['guru'])
      AND EXISTS (
        SELECT 1 FROM public.kelas_ajar a
        WHERE a.guru_id = auth.uid()
          AND a.kelas_id = p_kelas
          AND a.mapel_id = p_mapel
      )
    );
$$;

-- Bentuk kontrak daftar tamu yang dipakai JS lama: sumber roster + override Operator.
CREATE OR REPLACE FUNCTION public.murid_gabungan()
RETURNS TABLE (
  guest_id TEXT,
  guest_name TEXT,
  jenis_undangan TEXT,
  instansi_kelas TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.portal_punya_peran(ARRAY['guru', 'bk', 'operator', 'pustakawan', 'admin']) THEN
    RAISE EXCEPTION 'Akses daftar murid tidak diizinkan.';
  END IF;

  RETURN QUERY
  SELECT d.guest_id::TEXT,
         COALESCE(NULLIF(p.nama, ''), d.guest_name)::TEXT,
         COALESCE(NULLIF(p.jenis, ''), d.jenis_undangan)::TEXT,
         COALESCE(NULLIF(p.kelas, ''), d.instansi_kelas)::TEXT
  FROM public.daftar_tamu_gabungan d
  LEFT JOIN public.murid_profil p ON p.guest_id = d.guest_id
  WHERE COALESCE(p.nonaktif, FALSE) = FALSE
  UNION ALL
  SELECT p.guest_id::TEXT,
         p.nama::TEXT,
         COALESCE(NULLIF(p.jenis, ''), 'Orang Tua/Wali Siswa')::TEXT,
         p.kelas::TEXT
  FROM public.murid_profil p
  WHERE COALESCE(p.nonaktif, FALSE) = FALSE
    AND COALESCE(p.sumber, '') = 'operator'
    AND NULLIF(BTRIM(p.nama), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.daftar_tamu_gabungan d
      WHERE d.guest_id = p.guest_id
    );
END;
$$;

-- BK dan pengaturan
CREATE TABLE IF NOT EXISTS public.bk_jenis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kategori TEXT NOT NULL,
  nama TEXT NOT NULL,
  poin INTEGER NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  urut INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kategori, nama)
);
CREATE TABLE IF NOT EXISTS public.bk_pengaturan (
  kunci TEXT PRIMARY KEY,
  nilai JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.bk_kelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id UUID NOT NULL REFERENCES public.guru_staf(id) ON DELETE CASCADE,
  kelas TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guru_id, kelas)
);
CREATE TABLE IF NOT EXISTS public.bk_catatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  murid_id UUID REFERENCES public.murid(id) ON DELETE SET NULL,
  guru_bk_id UUID REFERENCES public.guru_staf(id) ON DELETE SET NULL,
  guest_id TEXT,
  nama TEXT,
  kelas TEXT,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  jam TIME,
  kategori TEXT NOT NULL,
  jenis_id UUID REFERENCES public.bk_jenis(id) ON DELETE SET NULL,
  jenis_nama TEXT,
  poin INTEGER NOT NULL DEFAULT 0,
  deskripsi TEXT,
  tindakan TEXT,
  keterangan TEXT,
  dicatat_oleh UUID REFERENCES public.guru_staf(id) ON DELETE SET NULL,
  is_confidential BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.bk_tindak (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id TEXT NOT NULL,
  nama TEXT NOT NULL,
  kelas TEXT,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  tingkat TEXT NOT NULL,
  semester TEXT NOT NULL,
  total_poin INTEGER,
  alasan TEXT,
  status TEXT NOT NULL DEFAULT 'dicatat',
  dicatat_oleh UUID REFERENCES public.guru_staf(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.bk_konseling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id TEXT NOT NULL,
  nama TEXT NOT NULL,
  kelas TEXT,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  bentuk TEXT NOT NULL,
  bidang TEXT NOT NULL,
  masalah TEXT NOT NULL,
  penanganan TEXT,
  hasil TEXT,
  rujukan_ke TEXT,
  jadwal_lanjut DATE,
  status TEXT NOT NULL DEFAULT 'baru',
  dicatat_oleh UUID REFERENCES public.guru_staf(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.bk_ortu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id TEXT NOT NULL,
  nama TEXT NOT NULL,
  kelas TEXT,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  bentuk TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'direncanakan',
  perihal TEXT NOT NULL,
  tgl_hadir DATE,
  jam_hadir TEXT,
  peserta TEXT,
  hasil TEXT,
  perjanjian TEXT,
  dicatat_oleh UUID REFERENCES public.guru_staf(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.bk_catatan
  ADD COLUMN IF NOT EXISTS guest_id TEXT,
  ADD COLUMN IF NOT EXISTS nama TEXT,
  ADD COLUMN IF NOT EXISTS kelas TEXT,
  ADD COLUMN IF NOT EXISTS tanggal DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS jam TIME,
  ADD COLUMN IF NOT EXISTS jenis_id UUID,
  ADD COLUMN IF NOT EXISTS jenis_nama TEXT,
  ADD COLUMN IF NOT EXISTS keterangan TEXT,
  ADD COLUMN IF NOT EXISTS dicatat_oleh UUID,
  ALTER COLUMN murid_id DROP NOT NULL,
  ALTER COLUMN deskripsi DROP NOT NULL;
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.bk_catatan'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%kategori%'
  LOOP
    EXECUTE FORMAT('ALTER TABLE public.bk_catatan DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS bk_catatan_guest_tanggal_idx ON public.bk_catatan (guest_id, tanggal DESC);
CREATE INDEX IF NOT EXISTS bk_tindak_guest_semester_idx ON public.bk_tindak (guest_id, semester);

CREATE OR REPLACE FUNCTION public.portal_sinkron_bk_catatan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.guest_id IS NOT NULL AND NEW.murid_id IS NULL THEN
    SELECT id INTO NEW.murid_id FROM public.murid WHERE guest_id = NEW.guest_id LIMIT 1;
  END IF;
  NEW.deskripsi := COALESCE(NULLIF(NEW.deskripsi, ''), NULLIF(NEW.jenis_nama, ''), NULLIF(NEW.keterangan, ''), NEW.kategori);
  NEW.tindakan := COALESCE(NEW.tindakan, NEW.keterangan);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS portal_sinkron_bk_catatan ON public.bk_catatan;
CREATE TRIGGER portal_sinkron_bk_catatan
BEFORE INSERT OR UPDATE ON public.bk_catatan
FOR EACH ROW EXECUTE FUNCTION public.portal_sinkron_bk_catatan();

CREATE OR REPLACE FUNCTION public.bk_pegangan()
RETURNS TABLE (guru_id UUID, kelas TEXT, nama TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.portal_punya_peran(ARRAY['bk', 'admin']) THEN
    RAISE EXCEPTION 'Akses data pegangan BK tidak diizinkan.';
  END IF;
  RETURN QUERY
  SELECT b.guru_id, b.kelas, g.nama
  FROM public.bk_kelas b
  JOIN public.guru_staf g ON g.id = b.guru_id
  ORDER BY b.kelas, g.nama;
END;
$$;

CREATE OR REPLACE FUNCTION public.simpan_foto_saya(p_url TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_url IS NULL OR p_url NOT LIKE 'https://%' THEN
    RAISE EXCEPTION 'Foto profil tidak valid.';
  END IF;
  UPDATE public.guru_staf
  SET foto = p_url
  WHERE auth_user_id = auth.uid() AND aktif = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akun guru/staf aktif tidak ditemukan.';
  END IF;
END;
$$;

-- Keuangan, perpustakaan, kartu, dan surat
CREATE TABLE IF NOT EXISTS public.keuangan_transaksi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  jenis TEXT NOT NULL CHECK (jenis IN ('masuk', 'keluar')),
  kategori TEXT,
  uraian TEXT NOT NULL,
  jumlah NUMERIC(14,2) NOT NULL CHECK (jumlah > 0),
  ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.keuangan_dokumen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis TEXT NOT NULL CHECK (jenis IN ('proposal', 'lpj')),
  judul TEXT NOT NULL,
  pengaju TEXT,
  nominal NUMERIC(14,2),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draf',
  terkait TEXT,
  link TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.perpus_pinjam (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul TEXT NOT NULL,
  peminjam TEXT NOT NULL,
  tgl_pinjam DATE NOT NULL DEFAULT CURRENT_DATE,
  tenggat DATE,
  status TEXT NOT NULL DEFAULT 'dipinjam',
  tgl_kembali DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.kartu_desain (
  id TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.surat_pengaturan (
  id TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.pengaturan_admin (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.buku_tamu
  ADD COLUMN IF NOT EXISTS guest_id TEXT,
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS jenis_undangan TEXT,
  ADD COLUMN IF NOT EXISTS instansi_kelas TEXT,
  ADD COLUMN IF NOT EXISTS nomor_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS keperluan TEXT,
  ADD COLUMN IF NOT EXISTS tujuan TEXT,
  ADD COLUMN IF NOT EXISTS telepon TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.kehadiran
  ALTER COLUMN murid_id DROP NOT NULL,
  ALTER COLUMN status DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_id TEXT,
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS status_kehadiran TEXT,
  ADD COLUMN IF NOT EXISTS tanda_tangan_data TEXT,
  ADD COLUMN IF NOT EXISTS nama_acara TEXT,
  ADD COLUMN IF NOT EXISTS jenis_undangan TEXT;
ALTER TABLE public.nilai
  ADD COLUMN IF NOT EXISTS catatan TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.jurnal_murid
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'menunggu',
  ADD COLUMN IF NOT EXISTS catatan_admin TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_terbit DATE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS foto_path TEXT;
UPDATE public.jurnal_murid
SET status = CASE WHEN is_approved THEN 'disetujui' ELSE status END,
    foto_path = COALESCE(foto_path, foto_url);

CREATE OR REPLACE FUNCTION public.portal_sinkron_status_jurnal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_approved THEN
      NEW.status := 'disetujui';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_approved := (NEW.status = 'disetujui');
  ELSIF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    NEW.status := CASE WHEN NEW.is_approved THEN 'disetujui' ELSE 'menunggu' END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS portal_sinkron_status_jurnal ON public.jurnal_murid;
CREATE TRIGGER portal_sinkron_status_jurnal
BEFORE INSERT OR UPDATE ON public.jurnal_murid
FOR EACH ROW EXECUTE FUNCTION public.portal_sinkron_status_jurnal();
ALTER TABLE public.surat
  ALTER COLUMN nomor_surat DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS nomor TEXT,
  ADD COLUMN IF NOT EXISTS jenis TEXT,
  ADD COLUMN IF NOT EXISTS tanggal DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS pihak TEXT,
  ADD COLUMN IF NOT EXISTS isi JSONB,
  ADD COLUMN IF NOT EXISTS catatan TEXT,
  ADD COLUMN IF NOT EXISTS link TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE public.surat
SET nomor = COALESCE(nomor, nomor_surat),
    jenis = COALESCE(jenis, CASE jenis_surat WHEN 'Masuk' THEN 'masuk' WHEN 'Keluar' THEN 'keluar' END),
    tanggal = COALESCE(tanggal, tanggal_surat),
    pihak = COALESCE(pihak, pengirim_atau_penerima);
CREATE INDEX IF NOT EXISTS surat_jenis_tanggal_idx ON public.surat (jenis, tanggal DESC);

-- Fasilitas dan informasi sekolah: pertahankan kolom migration lama, tambahkan
-- nama kolom yang dipakai UI dan Worker tanpa menghapus nilai lama.
ALTER TABLE public.fasilitas
  ALTER COLUMN nama_fasilitas DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS nama TEXT,
  ADD COLUMN IF NOT EXISTS lokasi TEXT,
  ADD COLUMN IF NOT EXISTS kapasitas TEXT,
  ADD COLUMN IF NOT EXISTS jumlah INTEGER,
  ADD COLUMN IF NOT EXISTS foto TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tampil BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS urutan INTEGER;
UPDATE public.fasilitas
SET nama = COALESCE(NULLIF(nama, ''), nama_fasilitas),
    foto = CASE WHEN cardinality(foto) = 0 AND foto_url IS NOT NULL THEN ARRAY[foto_url] ELSE foto END;
CREATE INDEX IF NOT EXISTS fasilitas_tampil_urutan_idx ON public.fasilitas (tampil, urutan);

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.info_sekolah'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%kategori%'
  LOOP
    EXECUTE FORMAT('ALTER TABLE public.info_sekolah DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.info_sekolah
  ADD COLUMN IF NOT EXISTS isi TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_terbit DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS tanggal_agenda DATE,
  ADD COLUMN IF NOT EXISTS lokasi TEXT,
  ADD COLUMN IF NOT EXISTS sematkan BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS terbit BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS lampiran_url TEXT,
  ADD COLUMN IF NOT EXISTS lampiran_nama TEXT,
  ADD COLUMN IF NOT EXISTS jenis_kegiatan TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE public.info_sekolah
SET isi = COALESCE(isi, konten, ringkasan),
    terbit = COALESCE(terbit, is_published, TRUE),
    tanggal_terbit = COALESCE(tanggal_terbit, created_at::date),
    lampiran_url = COALESCE(lampiran_url, gambar_url);
CREATE INDEX IF NOT EXISTS info_sekolah_terbit_tanggal_idx
  ON public.info_sekolah (terbit, sematkan DESC, tanggal_terbit DESC);
CREATE TABLE IF NOT EXISTS public.galeri_prestasi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foto_url TEXT NOT NULL,
  keterangan TEXT,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  tampil BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.galeri_prestasi
  ADD COLUMN IF NOT EXISTS tampil BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Pendaftaran kegiatan dan SPMB
CREATE TABLE IF NOT EXISTS public.kegiatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  deskripsi TEXT,
  jenis TEXT NOT NULL DEFAULT 'umum',
  biaya NUMERIC(12,2) NOT NULL DEFAULT 0,
  rekening TEXT,
  buka_daftar DATE NOT NULL,
  tutup_daftar DATE NOT NULL,
  tanggal_kegiatan DATE NOT NULL,
  kuota INTEGER,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  untuk_umum BOOLEAN NOT NULL DEFAULT FALSE,
  tampil_info BOOLEAN NOT NULL DEFAULT TRUE,
  tingkat INTEGER[],
  tanya_kaos BOOLEAN NOT NULL DEFAULT FALSE,
  tanya_kesehatan BOOLEAN NOT NULL DEFAULT FALSE,
  tanya_bidang BOOLEAN NOT NULL DEFAULT FALSE,
  opsi_bidang JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jenis IN ('umum', 'ekskul', 'club'))
);
CREATE TABLE IF NOT EXISTS public.pendaftaran_kegiatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatan_id UUID NOT NULL REFERENCES public.kegiatan(id) ON DELETE CASCADE,
  murid_id UUID REFERENCES public.murid(id) ON DELETE SET NULL,
  anak_key TEXT,
  nama_anak TEXT,
  kelas TEXT,
  nama_pengirim TEXT,
  tanggal_transfer DATE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  bukti_path TEXT,
  status TEXT NOT NULL DEFAULT 'menunggu',
  catatan_panitia TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS pendaftaran_kegiatan_anak_uidx
  ON public.pendaftaran_kegiatan (kegiatan_id, anak_key)
  WHERE anak_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS pendaftaran_kegiatan_kegiatan_status_idx
  ON public.pendaftaran_kegiatan (kegiatan_id, status);
ALTER TABLE public.pendaftaran_ekskul
  ADD COLUMN IF NOT EXISTS nama_anak TEXT,
  ADD COLUMN IF NOT EXISTS kelas TEXT,
  ADD COLUMN IF NOT EXISTS anak_key TEXT,
  ADD COLUMN IF NOT EXISTS nama_pengirim TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_transfer DATE,
  ADD COLUMN IF NOT EXISTS nominal_diterima NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS catatan TEXT,
  ADD COLUMN IF NOT EXISTS nilai_seleksi NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS bukti_path TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
UPDATE public.pendaftaran_ekskul
SET status = CASE LOWER(status)
  WHEN 'pending' THEN 'menunggu'
  WHEN 'diterima' THEN 'diterima'
  WHEN 'ditolak' THEN 'ditolak'
  ELSE LOWER(status)
END;
ALTER TABLE public.pendaftaran_ekskul ALTER COLUMN status SET DEFAULT 'menunggu';
CREATE UNIQUE INDEX IF NOT EXISTS pendaftaran_ekskul_murid_uidx
  ON public.pendaftaran_ekskul (ekskul_id, murid_id)
  WHERE murid_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pendaftaran_ekskul_anak_uidx
  ON public.pendaftaran_ekskul (ekskul_id, anak_key)
  WHERE anak_key IS NOT NULL;

-- Pendaftaran lama tetap mereferensikan ekskul. Buat baris penghubung dengan ID
-- kegiatan yang sama agar API lama dan UI baru memakai satu ID kegiatan.
CREATE OR REPLACE FUNCTION public.portal_sinkron_kegiatan_ekskul()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.jenis IN ('ekskul', 'club') THEN
    INSERT INTO public.ekskul (id, nama_ekskul)
    VALUES (NEW.id, NEW.nama)
    ON CONFLICT (id) DO UPDATE SET nama_ekskul = EXCLUDED.nama_ekskul;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS portal_sinkron_kegiatan_ekskul ON public.kegiatan;
CREATE TRIGGER portal_sinkron_kegiatan_ekskul
AFTER INSERT OR UPDATE OF nama, jenis ON public.kegiatan
FOR EACH ROW EXECUTE FUNCTION public.portal_sinkron_kegiatan_ekskul();
INSERT INTO public.ekskul (id, nama_ekskul)
SELECT id, nama FROM public.kegiatan WHERE jenis IN ('ekskul', 'club')
ON CONFLICT (id) DO UPDATE SET nama_ekskul = EXCLUDED.nama_ekskul;

CREATE OR REPLACE VIEW public.ekskul_pendaftar
WITH (security_invoker = true)
AS
SELECT id,
       ekskul_id AS kegiatan_id,
       murid_id,
       nama_anak,
       kelas,
       anak_key,
       status,
       catatan,
       nilai_seleksi,
       nama_pengirim,
       tanggal_transfer,
       nominal_diterima,
       data,
       COALESCE(bukti_path, bukti_bayar_url) AS bukti_path,
       created_at,
       verified_at
FROM public.pendaftaran_ekskul;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'spmb_pendaftar'
      AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.spmb_pendaftar
      ALTER COLUMN no_pendaftaran DROP NOT NULL,
      ALTER COLUMN nama_calon_siswa DROP NOT NULL,
      ALTER COLUMN nama_orang_tua DROP NOT NULL,
      ALTER COLUMN whatsapp DROP NOT NULL;
  END IF;
END $$;
ALTER TABLE public.spmb_pendaftar
  ADD COLUMN IF NOT EXISTS no_daftar TEXT,
  ADD COLUMN IF NOT EXISTS nama TEXT,
  ADD COLUMN IF NOT EXISTS nama_panggilan TEXT,
  ADD COLUMN IF NOT EXISTS tempat_lahir TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_lahir DATE,
  ADD COLUMN IF NOT EXISTS jenis_kelamin CHAR(1),
  ADD COLUMN IF NOT EXISTS alamat TEXT,
  ADD COLUMN IF NOT EXISTS kelurahan TEXT,
  ADD COLUMN IF NOT EXISTS kecamatan TEXT,
  ADD COLUMN IF NOT EXISTS kota TEXT,
  ADD COLUMN IF NOT EXISTS asal_tk TEXT,
  ADD COLUMN IF NOT EXISTS alamat_tk TEXT,
  ADD COLUMN IF NOT EXISTS kondisi_khusus TEXT,
  ADD COLUMN IF NOT EXISTS nama_ayah TEXT,
  ADD COLUMN IF NOT EXISTS pekerjaan_ayah TEXT,
  ADD COLUMN IF NOT EXISTS hp_ayah TEXT,
  ADD COLUMN IF NOT EXISTS nama_ibu TEXT,
  ADD COLUMN IF NOT EXISTS pekerjaan_ibu TEXT,
  ADD COLUMN IF NOT EXISTS hp_ibu TEXT,
  ADD COLUMN IF NOT EXISTS anak_ke INTEGER,
  ADD COLUMN IF NOT EXISTS jumlah_saudara INTEGER,
  ADD COLUMN IF NOT EXISTS nik TEXT,
  ADD COLUMN IF NOT EXISTS kontak TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS jalur TEXT,
  ADD COLUMN IF NOT EXISTS tahun_ajaran TEXT,
  ADD COLUMN IF NOT EXISTS kunci TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'baru',
  ADD COLUMN IF NOT EXISTS catatan_panitia TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS foto_path TEXT,
  ADD COLUMN IF NOT EXISTS akte_path TEXT,
  ADD COLUMN IF NOT EXISTS kk_path TEXT,
  ADD COLUMN IF NOT EXISTS bukti_path TEXT,
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS spmb_pendaftar_no_daftar_uidx ON public.spmb_pendaftar (no_daftar);
CREATE UNIQUE INDEX IF NOT EXISTS spmb_pendaftar_tahun_kunci_uidx ON public.spmb_pendaftar (tahun_ajaran, kunci);
CREATE INDEX IF NOT EXISTS spmb_pendaftar_status_created_idx ON public.spmb_pendaftar (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.portal_spmb_no_daftar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.no_daftar IS NULL OR BTRIM(NEW.no_daftar) = '' THEN
    NEW.no_daftar := 'SPMB-' || UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 10));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS portal_spmb_no_daftar ON public.spmb_pendaftar;
CREATE TRIGGER portal_spmb_no_daftar
BEFORE INSERT ON public.spmb_pendaftar
FOR EACH ROW EXECUTE FUNCTION public.portal_spmb_no_daftar();
UPDATE public.spmb_pendaftar
SET no_daftar = 'SPMB-' || UPPER(SUBSTRING(REPLACE(id::TEXT, '-', ''), 1, 10))
WHERE no_daftar IS NULL OR BTRIM(no_daftar) = '';

CREATE TABLE IF NOT EXISTS public.spmb_bukti_bayar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  kontak TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'valid', 'ditolak')),
  catatan TEXT,
  dipakai_oleh UUID REFERENCES public.spmb_pendaftar(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.spmb_pengaturan (
  jalur TEXT PRIMARY KEY CHECK (jalur IN ('dalam', 'luar')),
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  buka DATE NOT NULL,
  tutup DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (tutup >= buka)
);

-- Endpoints Worker memakai service role; data pendaftar tidak boleh dibaca anon
-- maupun authenticated langsung dari tabel.
DO $$
DECLARE
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'daftar_tamu_gabungan', 'kelas_kelas', 'kelas_murid', 'kelas_mapel',
    'kelas_ajar', 'kelas_profil', 'kelas_pertemuan', 'kelas_presensi',
    'kelas_rubrik', 'kelas_tugas', 'kelas_nilai', 'kelas_jadwal',
    'kelas_karya', 'bk_jenis', 'bk_pengaturan', 'bk_kelas', 'bk_catatan',
    'bk_tindak', 'bk_konseling', 'bk_ortu', 'keuangan_transaksi',
    'keuangan_dokumen', 'perpus_pinjam', 'kartu_desain', 'pengaturan_admin',
    'surat_pengaturan', 'surat', 'fasilitas', 'info_sekolah',
    'galeri_prestasi', 'kegiatan', 'pendaftaran_kegiatan',
    'pendaftaran_ekskul', 'spmb_pendaftar', 'spmb_bukti_bayar',
    'spmb_pengaturan', 'kehadiran', 'nilai', 'jurnal_murid', 'buku_tamu'
  ] LOOP
    EXECUTE FORMAT('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE FORMAT('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE FORMAT('GRANT ALL ON public.%I TO service_role', t);
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE FORMAT('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

GRANT SELECT ON public.daftar_tamu_gabungan TO authenticated;
GRANT EXECUTE ON FUNCTION public.murid_gabungan() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bk_pegangan() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_guru_ajar(UUID, UUID) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.kelas_kelas, public.kelas_murid, public.kelas_mapel, public.kelas_ajar,
  public.kelas_profil, public.kelas_pertemuan, public.kelas_presensi,
  public.kelas_rubrik, public.kelas_tugas, public.kelas_nilai,
  public.kelas_jadwal, public.kelas_karya
TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.bk_jenis, public.bk_pengaturan, public.bk_kelas, public.bk_catatan,
  public.bk_tindak, public.bk_konseling, public.bk_ortu
TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.keuangan_transaksi, public.keuangan_dokumen
TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perpus_pinjam, public.kartu_desain TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surat, public.surat_pengaturan TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fasilitas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pengaturan_admin TO service_role;
GRANT SELECT, UPDATE ON public.pendaftaran_ekskul TO authenticated;
GRANT SELECT, UPDATE ON public.ekskul_pendaftar TO authenticated;
CREATE POLICY "pustakawan membaca pendaftar ekskul"
ON public.pendaftaran_ekskul FOR SELECT TO authenticated
USING (public.portal_punya_peran(ARRAY['pustakawan', 'admin']));
CREATE POLICY "pustakawan memverifikasi pendaftar ekskul"
ON public.pendaftaran_ekskul FOR UPDATE TO authenticated
USING (public.portal_punya_peran(ARRAY['pustakawan', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['pustakawan', 'admin']));

CREATE POLICY "roster dapat dibaca staf sekolah"
ON public.daftar_tamu_gabungan FOR SELECT TO authenticated
USING (public.portal_punya_peran(ARRAY['guru', 'bk', 'operator', 'pustakawan', 'admin']));

CREATE POLICY "kelas dibaca guru"
ON public.kelas_kelas FOR SELECT TO authenticated
USING (public.portal_punya_peran(ARRAY['guru', 'admin']));
CREATE POLICY "guru membuat kelas"
ON public.kelas_kelas FOR INSERT TO authenticated
WITH CHECK (public.portal_punya_peran(ARRAY['guru', 'admin']) AND (dibuat_oleh = auth.uid() OR public.portal_punya_peran(ARRAY['admin'])));
CREATE POLICY "pemilik kelas mengubah kelas"
ON public.kelas_kelas FOR UPDATE TO authenticated
USING (dibuat_oleh = auth.uid() OR public.portal_punya_peran(ARRAY['admin']))
WITH CHECK (dibuat_oleh = auth.uid() OR public.portal_punya_peran(ARRAY['admin']));
CREATE POLICY "pemilik kelas menghapus kelas"
ON public.kelas_kelas FOR DELETE TO authenticated
USING (dibuat_oleh = auth.uid() OR public.portal_punya_peran(ARRAY['admin']));

CREATE POLICY "guru mengelola murid kelasnya"
ON public.kelas_murid FOR ALL TO authenticated
USING (guru_id = auth.uid() OR public.portal_punya_peran(ARRAY['admin']))
WITH CHECK ((guru_id = auth.uid() AND public.portal_punya_peran(ARRAY['guru'])) OR public.portal_punya_peran(ARRAY['admin']));
CREATE POLICY "guru membaca mapel"
ON public.kelas_mapel FOR SELECT TO authenticated
USING (public.portal_punya_peran(ARRAY['guru', 'admin']));
CREATE POLICY "guru mengelola mapel"
ON public.kelas_mapel FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['guru', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['guru', 'admin']));
CREATE POLICY "guru mengelola profil kelas"
ON public.kelas_profil FOR ALL TO authenticated
USING (guru_id = auth.uid() OR public.portal_punya_peran(ARRAY['admin']))
WITH CHECK (
  guru_id = auth.uid()
  AND public.portal_punya_peran(ARRAY['guru', 'pustakawan', 'keuangan', 'persuratan', 'operator', 'sarpras', 'bk', 'info', 'staf', 'spmb', 'admin'])
);
CREATE POLICY "guru mengelola penugasan mapel"
ON public.kelas_ajar FOR ALL TO authenticated
USING (guru_id = auth.uid() OR public.portal_punya_peran(ARRAY['admin']))
WITH CHECK ((guru_id = auth.uid() AND public.portal_punya_peran(ARRAY['guru'])) OR public.portal_punya_peran(ARRAY['admin']));

CREATE POLICY "guru mengelola pertemuan"
ON public.kelas_pertemuan FOR ALL TO authenticated
USING (public.portal_guru_ajar(kelas_id, mapel_id))
WITH CHECK (public.portal_guru_ajar(kelas_id, mapel_id));
CREATE POLICY "guru mengelola presensi kelas"
ON public.kelas_presensi FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.kelas_pertemuan p
  WHERE p.id = pertemuan_id AND public.portal_guru_ajar(p.kelas_id, p.mapel_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.kelas_pertemuan p
  WHERE p.id = pertemuan_id AND public.portal_guru_ajar(p.kelas_id, p.mapel_id)
));
CREATE POLICY "guru membaca rubrik"
ON public.kelas_rubrik FOR SELECT TO authenticated
USING (public.portal_punya_peran(ARRAY['guru', 'admin']));
CREATE POLICY "guru mengelola rubrik"
ON public.kelas_rubrik FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['guru', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['guru', 'admin']));
CREATE POLICY "guru mengelola tugas"
ON public.kelas_tugas FOR ALL TO authenticated
USING (public.portal_guru_ajar(kelas_id, mapel_id))
WITH CHECK (public.portal_guru_ajar(kelas_id, mapel_id));
CREATE POLICY "guru mengelola nilai"
ON public.kelas_nilai FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.kelas_tugas t
  WHERE t.id = tugas_id AND public.portal_guru_ajar(t.kelas_id, t.mapel_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.kelas_tugas t
  WHERE t.id = tugas_id AND public.portal_guru_ajar(t.kelas_id, t.mapel_id)
));
CREATE POLICY "guru mengelola jadwal"
ON public.kelas_jadwal FOR ALL TO authenticated
USING (public.portal_guru_ajar(kelas_id, mapel_id))
WITH CHECK (public.portal_guru_ajar(kelas_id, mapel_id));
CREATE POLICY "guru mengelola karya kelas"
ON public.kelas_karya FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.kelas_tugas t
  WHERE t.id = tugas_id AND public.portal_guru_ajar(t.kelas_id, t.mapel_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.kelas_tugas t
  WHERE t.id = tugas_id AND public.portal_guru_ajar(t.kelas_id, t.mapel_id)
));

CREATE POLICY "guru bk mengelola jenis"
ON public.bk_jenis FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['bk', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['bk', 'admin']));
CREATE POLICY "guru bk mengelola pengaturan"
ON public.bk_pengaturan FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['bk', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['bk', 'admin']));
CREATE POLICY "guru bk mengelola kelas pegangan"
ON public.bk_kelas FOR ALL TO authenticated
USING (guru_id = (SELECT id FROM public.guru_staf WHERE auth_user_id = auth.uid()) OR public.portal_punya_peran(ARRAY['admin']))
WITH CHECK (guru_id = (SELECT id FROM public.guru_staf WHERE auth_user_id = auth.uid()) OR public.portal_punya_peran(ARRAY['admin']));
CREATE POLICY "guru bk membaca catatan"
ON public.bk_catatan FOR SELECT TO authenticated
USING (public.portal_punya_peran(ARRAY['bk', 'admin']));
CREATE POLICY "guru bk mengelola catatan"
ON public.bk_catatan FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['bk', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['bk', 'admin']));
CREATE POLICY "guru bk mengelola tindak lanjut"
ON public.bk_tindak FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['bk', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['bk', 'admin']));
CREATE POLICY "guru bk mengelola konseling rahasia"
ON public.bk_konseling FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['bk', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['bk', 'admin']));
CREATE POLICY "guru bk mengelola komunikasi ortu"
ON public.bk_ortu FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['bk', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['bk', 'admin']));

CREATE POLICY "staf keuangan mengelola transaksi"
ON public.keuangan_transaksi FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['keuangan', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['keuangan', 'admin']));
CREATE POLICY "staf keuangan mengelola dokumen"
ON public.keuangan_dokumen FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['keuangan', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['keuangan', 'admin']));
CREATE POLICY "pustakawan mengelola peminjaman"
ON public.perpus_pinjam FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['pustakawan', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['pustakawan', 'admin']));
CREATE POLICY "pustakawan mengelola desain kartu"
ON public.kartu_desain FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['pustakawan', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['pustakawan', 'admin']));
CREATE POLICY "staf persuratan mengelola surat"
ON public.surat FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['persuratan', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['persuratan', 'admin']));
CREATE POLICY "staf persuratan mengelola pengaturan"
ON public.surat_pengaturan FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['persuratan', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['persuratan', 'admin']));
CREATE POLICY "staf sarpras mengelola fasilitas"
ON public.fasilitas FOR ALL TO authenticated
USING (public.portal_punya_peran(ARRAY['sarpras', 'admin']))
WITH CHECK (public.portal_punya_peran(ARRAY['sarpras', 'admin']));

GRANT SELECT ON public.fasilitas, public.info_sekolah, public.galeri_prestasi TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kegiatan, public.pendaftaran_kegiatan,
  public.spmb_pendaftar, public.spmb_bukti_bayar, public.spmb_pengaturan,
  public.galeri_prestasi, public.info_sekolah, public.kehadiran,
  public.nilai, public.jurnal_murid, public.buku_tamu
TO service_role;

-- Bucket publik fasilitas/info; berkas siswa dan pembayaran privat.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('fasilitas', 'fasilitas', TRUE),
  ('info', 'info', TRUE),
  ('foto-guru', 'foto-guru', TRUE),
  ('karya', 'karya', FALSE),
  ('jurnal', 'jurnal', FALSE),
  ('spmb', 'spmb', FALSE),
  ('bukti-bayar', 'bukti-bayar', FALSE),
  ('bukti', 'bukti', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "fasilitas publik baca foto" ON storage.objects;
CREATE POLICY "fasilitas publik baca foto"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'fasilitas');
DROP POLICY IF EXISTS "sarpras unggah foto fasilitas" ON storage.objects;
CREATE POLICY "sarpras unggah foto fasilitas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'fasilitas' AND public.portal_punya_peran(ARRAY['sarpras', 'admin']));
DROP POLICY IF EXISTS "sarpras ubah foto fasilitas" ON storage.objects;
CREATE POLICY "sarpras ubah foto fasilitas"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'fasilitas' AND public.portal_punya_peran(ARRAY['sarpras', 'admin']))
WITH CHECK (bucket_id = 'fasilitas' AND public.portal_punya_peran(ARRAY['sarpras', 'admin']));
DROP POLICY IF EXISTS "sarpras hapus foto fasilitas" ON storage.objects;
CREATE POLICY "sarpras hapus foto fasilitas"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'fasilitas' AND public.portal_punya_peran(ARRAY['sarpras', 'admin']));
DROP POLICY IF EXISTS "karya hanya dikelola guru" ON storage.objects;
DROP POLICY IF EXISTS "guru melihat karya kelasnya" ON storage.objects;
CREATE POLICY "guru melihat karya kelasnya"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'karya'
  AND public.portal_punya_peran(ARRAY['guru', 'admin'])
  AND (
    (storage.foldername(name))[1] = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1
      FROM public.kelas_karya k
      JOIN public.kelas_tugas t ON t.id = k.tugas_id
      WHERE k.path = name AND public.portal_guru_ajar(t.kelas_id, t.mapel_id)
    )
  )
);
DROP POLICY IF EXISTS "guru unggah karya sendiri" ON storage.objects;
CREATE POLICY "guru unggah karya sendiri"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'karya'
  AND (storage.foldername(name))[1] = auth.uid()::TEXT
  AND public.portal_punya_peran(ARRAY['guru', 'admin'])
);
DROP POLICY IF EXISTS "guru ubah karya sendiri" ON storage.objects;
CREATE POLICY "guru ubah karya sendiri"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'karya'
  AND (storage.foldername(name))[1] = auth.uid()::TEXT
  AND public.portal_punya_peran(ARRAY['guru', 'admin'])
)
WITH CHECK (
  bucket_id = 'karya'
  AND (storage.foldername(name))[1] = auth.uid()::TEXT
  AND public.portal_punya_peran(ARRAY['guru', 'admin'])
);
DROP POLICY IF EXISTS "guru hapus karya sendiri" ON storage.objects;
CREATE POLICY "guru hapus karya sendiri"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'karya'
  AND (storage.foldername(name))[1] = auth.uid()::TEXT
  AND public.portal_punya_peran(ARRAY['guru', 'admin'])
);
DROP POLICY IF EXISTS "foto guru dapat dibaca publik" ON storage.objects;
CREATE POLICY "foto guru dapat dibaca publik"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'foto-guru');
DROP POLICY IF EXISTS "staf unggah foto sendiri" ON storage.objects;
CREATE POLICY "staf unggah foto sendiri"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'foto-guru'
  AND name = auth.uid()::TEXT || '.jpg'
  AND EXISTS (SELECT 1 FROM public.guru_staf g WHERE g.auth_user_id = auth.uid() AND g.aktif)
);
DROP POLICY IF EXISTS "staf perbarui foto sendiri" ON storage.objects;
CREATE POLICY "staf perbarui foto sendiri"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'foto-guru' AND name = auth.uid()::TEXT || '.jpg')
WITH CHECK (bucket_id = 'foto-guru' AND name = auth.uid()::TEXT || '.jpg');
DROP POLICY IF EXISTS "staf hapus foto sendiri" ON storage.objects;
CREATE POLICY "staf hapus foto sendiri"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'foto-guru' AND name = auth.uid()::TEXT || '.jpg');

REVOKE ALL ON FUNCTION public.portal_sinkron_kelas_murid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_sinkron_bk_catatan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_sinkron_kegiatan_ekskul() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_spmb_no_daftar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_sinkron_status_jurnal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.simpan_foto_saya(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simpan_foto_saya(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.murid_gabungan() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bk_pegangan() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_guru_ajar(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.murid_gabungan() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bk_pegangan() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_guru_ajar(UUID, UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
