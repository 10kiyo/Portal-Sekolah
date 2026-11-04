// Cloudflare Worker endpoint: GET /api/slims-member
// Dilindungi parameter ?key= dengan SLIMS_SECRET dari environment
// Ambil data murid aktif (is_active = true) dari Supabase beserta relasi nama kelas
// Output JSON array untuk sinkronisasi ke SLiMS

import { json, cfg, dbGet } from '../_lib/util.js';

export async function onRequestGet({ request, env }) {
  // Validasi key
  const url = new URL(request.url);
  const providedKey = url.searchParams.get('key');
  const expectedKey = env.SLIMS_SECRET;

  if (!providedKey || providedKey !== expectedKey) {
    return json(403, { error: 'Akses ditolak: kunci invalid atau tidak diberikan.' });
  }

  try {
    const c = cfg(env);
    if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });

    // Ambil data murid aktif dengan relasi kelas
    // Tabel: murid, relasi: kelas_kelas(nama)
    const rows = await dbGet(c)(`
      /murid?is_active=eq.true&select=nisn,nama,jenis_kelamin,kelas_kelas(nama)&order=nama.asc
    `);

    // Transformasi ke format SLiMS
    const members = rows.map(m => ({
      member_id: m.nisn || String(m.id),
      member_name: m.nama || '',
      // gender: 1 untuk L (Laki-laki), 0 untuk P (Perempuan)
      gender: (m.jenis_kelamin || '').toUpperCase() === 'L' ? 1 : 0,
      member_type_id: 1,
      inst_name: 'Sekolah',
      is_active: 1
    }));

    return json(200, members);
  } catch (e) {
    console.error('Error fetching slims-member:', e);
    return json(500, { error: 'Gagal mengambil data murid dari Supabase.' });
  }
}

// Bukan GET, kembalikan 405
export async function onRequest() {
  return json(405, { error: 'Metode tidak diizinkan.' });
}