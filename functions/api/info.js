// Cloudflare Worker route: GET /api/info  (publik, hanya info yang berstatus terbit)
// Query opsional: ?limit=3
import { json, cfg, dbGet, hariIni } from '../_lib/util.js';

export async function onRequestGet({ request, env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const lim = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('limit')) || 100, 1), 200);
  try {
    const rows = await dbGet(c)(`/info_sekolah?terbit=eq.true&order=sematkan.desc,tanggal_terbit.desc,created_at.desc&limit=${lim}&select=id,judul,kategori,isi,tanggal_terbit,tanggal_agenda,lokasi,sematkan,lampiran_url,lampiran_nama`);
    return json(200, { today: hariIni(), info: rows });
  } catch (e) {
    return json(500, { error: 'Data info belum bisa dibaca. Pastikan supabase-info.sql sudah dijalankan.' });
  }
}
export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
