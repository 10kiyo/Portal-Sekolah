-- 1. BUKU TAMU ONLINE
CREATE TABLE public.buku_tamu (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_tamu VARCHAR(100) NOT NULL,
    instansi_atau_ortu VARCHAR(100),
    whatsapp_tersamar VARCHAR(20),
    whatsapp_full VARCHAR(20), -- Hanya terlihat oleh Admin
    tujuan_kunjungan TEXT NOT NULL,
    tanda_tangan_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PERSURATAN
CREATE TABLE public.surat (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomor_surat VARCHAR(50) UNIQUE NOT NULL,
    jenis_surat VARCHAR(20) CHECK (jenis_surat IN ('Masuk', 'Keluar')),
    perihal VARCHAR(200) NOT NULL,
    pengirim_atau_penerima VARCHAR(100),
    file_url TEXT,
    tanggal_surat DATE DEFAULT CURRENT_DATE
);

-- 3. FASILITAS SEKOLAH
CREATE TABLE public.fasilitas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_fasilitas VARCHAR(100) NOT NULL,
    kategori VARCHAR(50),
    kondisi VARCHAR(20) DEFAULT 'Baik',
    foto_url TEXT,
    deskripsi TEXT
);

-- 4. INFO TERBARU & GALERI PRESTASI
CREATE TABLE public.info_sekolah (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    judul VARCHAR(200) NOT NULL,
    kategori VARCHAR(30) CHECK (kategori IN ('Pengumuman', 'Agenda', 'Prestasi', 'Edaran')),
    ringkasan TEXT,
    konten TEXT,
    gambar_url TEXT,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);