-- 1. BIMBINGAN KONSELING (BK) & KEDISIPLINAN
CREATE TABLE public.bk_catatan (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    murid_id UUID NOT NULL REFERENCES public.murid(id) ON DELETE CASCADE,
    guru_bk_id UUID REFERENCES public.guru_staf(id),
    kategori VARCHAR(20) CHECK (kategori IN ('Pelanggaran', 'Prestasi', 'Konseling')),
    poin INT DEFAULT 0,
    deskripsi TEXT NOT NULL,
    tindakan TEXT,
    is_confidential BOOLEAN DEFAULT true, -- Sangat rahasia
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EKSKUL & CLUB
CREATE TABLE public.ekskul (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_ekskul VARCHAR(50) NOT NULL,
    pembina_id UUID REFERENCES public.guru_staf(id),
    kuota INT,
    hari VARCHAR(15),
    jam VARCHAR(20)
);

CREATE TABLE public.pendaftaran_ekskul (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    murid_id UUID REFERENCES public.murid(id) ON DELETE CASCADE,
    ekskul_id UUID REFERENCES public.ekskul(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, Diterima, Ditolak
    bukti_bayar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(murid_id, ekskul_id)
);

-- 3. SPMB (PENDAFTARAN SISWA BARU)
CREATE TABLE public.spmb_pendaftar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    no_pendaftaran VARCHAR(30) UNIQUE NOT NULL,
    nama_calon_siswa VARCHAR(100) NOT NULL,
    nama_orang_tua VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    status_seleksi VARCHAR(20) DEFAULT 'Didaftarkan',
    created_at TIMESTAMPTZ DEFAULT NOW()
);