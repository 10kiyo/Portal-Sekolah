// Cloudflare Worker route: GET /api/info  (publik, hanya info yang berstatus terbit)
// Query opsional: ?limit=3&kategori=prestasi&jenis=ekskul   (jenis: ekskul | club | unggulan)
import { json, cfg, dbGet, hariIni } from '../_lib/util.js';

export async function onRequestGet({ request, env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const lim = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('limit')) || 100, 1), 200);
  const kat = new URL(request.url).searchParams.get('kategori') || '';
  const fk = ['pengumuman', 'agenda', 'surat', 'kegiatan', 'prestasi', 'lainnya'].includes(kat) ? `&kategori=eq.${kat}` : '';
  const jn = new URL(request.url).searchParams.get('jenis') || '';
  const fj = ['ekskul', 'club', 'unggulan'].includes(jn) ? `&jenis_kegiatan=eq.${jn}` : '';
  const base = `/info_sekolah?terbit=eq.true${fk}`, urut = `&order=sematkan.desc,tanggal_terbit.desc,created_at.desc&limit=${lim}`;
  const kol = 'id,judul,kategori,isi,tanggal_terbit,tanggal_agenda,lokasi,sematkan,lampiran_url,lampiran_nama';
  try {
    let rows;
    try { rows = await dbGet(c)(`${base}${fj}${urut}&select=${kol},jenis_kegiatan`); }
    catch (e) {                                   // kolom jenis_kegiatan belum ada (supabase-jurnal.sql belum dijalankan)
      if (fj) return json(200, { today: hariIni(), info: [] });
      rows = await dbGet(c)(`${base}${urut}&select=${kol}`);
    }
    return json(200, { today: hariIni(), info: rows });
  } catch (e) {
    return json(500, { error: 'Data info belum bisa dibaca. Pastikan supabase-info.sql sudah dijalankan.' });
  }
}
export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
