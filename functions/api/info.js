// Cloudflare Worker route: GET /api/info  (publik, hanya info yang berstatus terbit)
// Query opsional: ?limit=3&kategori=prestasi&jenis=ekskul   (jenis: ekskul | club | unggulan)
import { json, cfg, dbGet, hariIni, fase, terpakaiMap } from '../_lib/util.js';

export async function onRequestGet({ request, env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const lim = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('limit')) || 100, 1), 1000);
  const kat = new URL(request.url).searchParams.get('kategori') || '';
  const fk = ['pengumuman', 'agenda', 'surat', 'kegiatan', 'prestasi', 'lainnya'].includes(kat) ? `&kategori=eq.${kat}` : '';
  const jn = new URL(request.url).searchParams.get('jenis') || '';
  const fj = ['ekskul', 'club', 'unggulan'].includes(jn) ? `&jenis_kegiatan=eq.${jn}` : '';
  const base = `/info_sekolah?terbit=eq.true${fk}`, urut = `&order=sematkan.desc,tanggal_terbit.desc,created_at.desc&limit=${lim}`;
  const kol = 'id,judul,kategori,isi,tanggal_terbit,tanggal_agenda,lokasi,sematkan,lampiran_url,lampiran_nama';
  // Pendaftaran kegiatan yang dibuka untuk umum (tampil di bagian atas halaman Info). Gagal membaca tidak boleh mengganggu info biasa.
  const today = hariIni();
  const pendaftaran = async () => {
    try {
      const get = dbGet(c);
      const ks = await get(`/kegiatan?untuk_umum=eq.true&tampil_info=eq.true&aktif=eq.true&buka_daftar=lte.${today}&tutup_daftar=gte.${today}&tanggal_kegiatan=gte.${today}&order=tanggal_kegiatan.asc&limit=20&select=id,nama,deskripsi,biaya,kuota,buka_daftar,tutup_daftar,tanggal_kegiatan,aktif`);
      const tp = await terpakaiMap(get, ks.map(k => k.id));
      return ks.map(k => ({ id: k.id, nama: k.nama, deskripsi: k.deskripsi ? String(k.deskripsi).slice(0, 300) : null, biaya: k.biaya, tutup_daftar: k.tutup_daftar, tanggal_kegiatan: k.tanggal_kegiatan,
        sisa: k.kuota != null ? Math.max(0, k.kuota - (tp[k.id] || 0)) : null, fase: fase(k, tp[k.id] || 0, today) })).filter(k => k.fase === 'dibuka' || k.fase === 'penuh');
    } catch (e) { return []; }
  };
  try {
    let rows;
    try { rows = await dbGet(c)(`${base}${fj}${urut}&select=${kol},jenis_kegiatan`); }
    catch (e) {                                   // kolom jenis_kegiatan belum ada (supabase-jurnal.sql belum dijalankan)
      if (fj) return json(200, { today, info: [], pendaftaran: [] });
      rows = await dbGet(c)(`${base}${urut}&select=${kol}`);
    }
    return json(200, { today, info: rows, pendaftaran: fj ? [] : await pendaftaran() });
  } catch (e) {
    return json(500, { error: 'Data info belum bisa dibaca. Pastikan supabase-info.sql sudah dijalankan.' });
  }
}
export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
