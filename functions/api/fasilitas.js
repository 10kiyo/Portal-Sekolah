// Cloudflare Worker route: GET /api/fasilitas (publik)
// Daftar fasilitas sekolah yang ditandai "tampil". Kondisi internal TIDAK dikirim ke publik.
// Dikelola Waka Sarana & Prasarana lewat Administrasi Guru dan Staf. Cache 1 menit.
import { json, cfg, dbGet } from '../_lib/util.js';

export async function onRequestGet({ env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });

  try {
    let rows;
    try {
      rows = await dbGet(c)('/fasilitas?tampil=eq.true&select=id,nama,kategori,deskripsi,lokasi,kapasitas,jumlah,foto,urutan_tampil&order=urutan_tampil.asc.nullslast,nama.asc&limit=500');
    } catch (e) {
      // Fallback jika nama kolom menggunakan 'urutan' atau 'is_active'
      rows = await dbGet(c)('/fasilitas?tampil=eq.true&select=id,nama,kategori,deskripsi,lokasi,kapasitas,jumlah,foto,urutan&order=urutan.asc.nullslast,nama.asc&limit=500');
    }

    const fasilitas = rows.map(r => {
      const fotoArr = Array.isArray(r.foto) 
        ? r.foto 
        : String(r.foto || '').split(',').map(x => x.trim()).filter(Boolean);

      return {
        id: r.id, 
        nama: r.nama, 
        kategori: r.kategori, 
        deskripsi: r.deskripsi, 
        lokasi: r.lokasi, 
        kapasitas: r.kapasitas, 
        jumlah: r.jumlah,
        foto: fotoArr.filter(u => /^https?:\/\//i.test(u))
      };
    });

    return new Response(JSON.stringify({ fasilitas }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } 
    });
  } catch (e) {
    return json(500, { error: 'Data fasilitas belum bisa dibaca dari database.' });
  }
}

export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });