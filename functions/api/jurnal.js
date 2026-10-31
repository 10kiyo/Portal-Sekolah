// Cloudflare Worker route: GET /api/jurnal  (publik; hanya jurnal berstatus "disetujui")
//   /api/jurnal?limit=30        -> daftar (isi dipotong jadi cuplikan)
//   /api/jurnal?id=<uuid>       -> satu jurnal lengkap
//   /api/jurnal?foto=<uuid>     -> gambar jurnal (dari bucket privat, hanya bila sudah disetujui)
import { json, cfg, dbGet } from '../_lib/util.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPUR = 'id,judul,isi,nama_anak,kelas,foto_path,tanggal_terbit';

export async function onRequestGet({ request, env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const q = new URL(request.url).searchParams, get = dbGet(c);
  const olah = (x, penuh) => ({
    id: x.id, judul: x.judul, nama: x.nama_anak, kelas: x.kelas, tanggal: x.tanggal_terbit,
    foto: x.foto_path ? `/api/jurnal?foto=${x.id}` : null,
    ...(penuh ? { isi: x.isi } : { cuplikan: x.isi.length > 240 ? x.isi.slice(0, 240).replace(/\s+\S*$/, '') + '…' : x.isi })
  });
  try {
    const foto = q.get('foto');
    if (foto) {
      if (!UUID.test(foto)) return json(400, { error: 'ID tidak valid.' });
      const x = (await get(`/jurnal_murid?id=eq.${foto}&status=eq.disetujui&select=foto_path`))[0];
      if (!x || !x.foto_path) return json(404, { error: 'Foto tidak ditemukan.' });
      const r = await fetch(`${c.URL}/storage/v1/object/jurnal/${x.foto_path}`, { headers: c.h });
      if (!r.ok) return json(404, { error: 'Foto tidak ditemukan.' });
      return new Response(r.body, { status: 200, headers: { 'Content-Type': r.headers.get('Content-Type') || 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
    }
    const id = q.get('id');
    if (id) {
      if (!UUID.test(id)) return json(400, { error: 'ID tidak valid.' });
      const x = (await get(`/jurnal_murid?id=eq.${id}&status=eq.disetujui&select=${CAMPUR}`))[0];
      return x ? json(200, { jurnal: olah(x, true) }) : json(404, { error: 'Jurnal tidak ditemukan.' });
    }
    const lim = Math.min(Math.max(parseInt(q.get('limit')) || 30, 1), 100);
    const rows = await get(`/jurnal_murid?status=eq.disetujui&order=tanggal_terbit.desc,created_at.desc&limit=${lim}&select=${CAMPUR}`);
    return json(200, { jurnal: rows.map(x => olah(x, false)) });
  } catch (e) {
    return json(500, { error: 'Jurnal belum bisa dibaca. Pastikan supabase-jurnal.sql sudah dijalankan.' });
  }
}
export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
