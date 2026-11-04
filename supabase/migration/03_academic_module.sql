-- 1. PRESENSI / KEHADIRAN
CREATE TABLE public.kehadiran (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    murid_id UUID NOT NULL REFERENCES public.murid(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(10) NOT NULL CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alfa')),
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(murid_id, tanggal)
);

-- 2. NILAI & TUGAS
CREATE TABLE public.nilai (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    murid_id UUID NOT NULL REFERENCES public.murid(id) ON DELETE CASCADE,
    mata_pelajaran VARCHAR(50) NOT NULL,
    jenis_penilaian VARCHAR(30) NOT NULL, -- Contoh: "Tugas 1", "UTS", "UAS"
    nilai NUMERIC(5,2) CHECK (nilai BETWEEN 0 AND 100),
    tanggal DATE DEFAULT CURRENT_DATE
);

-- 3. JURNAL MURID
CREATE TABLE public.jurnal_murid (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    murid_id UUID NOT NULL REFERENCES public.murid(id) ON DELETE CASCADE,
    judul VARCHAR(150) NOT NULL,
    isi TEXT NOT NULL,
    foto_url TEXT,
    is_approved BOOLEAN DEFAULT false, -- Butuh verifikasi Admin Info
    created_at TIMESTAMPTZ DEFAULT NOW()
);