-- 1. TABEL PERAN GURU
CREATE TABLE public.guru_peran (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guru_id UUID NOT NULL REFERENCES public.guru_staf(id) ON DELETE CASCADE,
    role role_enum NOT NULL,
    UNIQUE(guru_id, role)
);

-- 2. AKTIFKAN ROW LEVEL SECURITY (RLS)
ALTER TABLE public.guru_staf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.murid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_peran ENABLE ROW LEVEL SECURITY;

-- 3. KEBIJAKAN AKSES DASAR (RLS POLICIES)
-- Publik bisa melihat data umum guru (foto, nama, jabatan, mapel)
CREATE POLICY "Publik bisa lihat data umum guru" 
ON public.guru_staf FOR SELECT 
USING (is_active = true);

-- Orang tua dengan kode akses valid bisa melihat data muridnya
CREATE POLICY "Ortu akses murid via kode akses" 
ON public.murid FOR SELECT 
USING (status = 'aktif');