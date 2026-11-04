-- 1. EXTENSIONS & ENUM
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE role_enum AS ENUM (
  'guru', 'pustakawan', 'keuangan', 'persuratan', 
  'operator', 'bk', 'sarpras', 'admin_info', 'admin'
);

CREATE TYPE status_murid_enum AS ENUM ('aktif', 'lulus', 'pindah', 'nonaktif');

-- 2. TABEL GURU & STAF
CREATE TABLE public.guru_staf (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nip VARCHAR(30) UNIQUE,
    nama_lengkap VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    foto_url TEXT,
    jabatan VARCHAR(50),
    mata_pelajaran TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL KELAS
CREATE TABLE public.kelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_kelas VARCHAR(20) NOT NULL, -- Contoh: "1-A", "6-B"
    tingkat INT NOT NULL CHECK (tingkat BETWEEN 1 AND 6),
    tahun_ajaran VARCHAR(10) NOT NULL, -- Contoh: "2026/2027"
    wali_kelas_id UUID REFERENCES public.guru_staf(id) ON DELETE SET NULL,
    UNIQUE(nama_kelas, tahun_ajaran)
);

-- 4. TABEL MURID
CREATE TABLE public.murid (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nis VARCHAR(20) UNIQUE,
    nisn VARCHAR(20) UNIQUE,
    nama_lengkap VARCHAR(100) NOT NULL,
    jenis_kelamin CHAR(1) CHECK (jenis_kelamin IN ('L', 'P')),
    kelas_id UUID REFERENCES public.kelas(id) ON DELETE SET NULL,
    kode_akses_ortu VARCHAR(10) UNIQUE,
    status status_murid_enum DEFAULT 'aktif',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);