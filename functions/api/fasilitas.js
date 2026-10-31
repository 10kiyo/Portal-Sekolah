// Cloudflare Worker route: GET /api/fasilitas  (publik)
// Daftar fasilitas sekolah yang ditandai "tampil". Kondisi (baik/perlu perbaikan) bersifat internal dan TIDAK dikirim ke publik.
// Dikelola Waka Sarana & Prasarana lewat Administrasi Guru dan Staf > Kelola fasilitas. Cache 1 menit.
import { json, cfg, dbGet } from '../_lib/util.js';

export async function onRequestGet({ env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  try {
    const rows = await dbGet(c)('/fasilitas?tampil=eq.true&select=id,nama,kategori,deskripsi,lokasi,kapasitas,jumlah,foto,urutan&order=urutan.asc.nullslast,nama.asc&limit=500');
    const fasilitas = rows.map(r => ({
      id: r.id, nama: r.nama, kategori: r.kategori, deskripsi: r.deskripsi, lokasi: r.lokasi, kapasitas: r.kapasitas, jumlah: r.jumlah,
      foto: (r.foto || []).filter(u => /^https:\/\//i.test(u))
    }));
    return new Response(JSON.stringify({ fasilitas }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
  } catch (e) {
    return json(500, { error: 'Data fasilitas belum bisa dibaca. Pastikan supabase-fasilitas.sql sudah dijalankan.' });
  }
}
export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
