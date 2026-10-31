// Cloudflare Worker route: GET/POST /api/admin-jurnal  (khusus admin info, token dari /api/admin-auth)
//   GET                                           -> semua jurnal (terbaru dulu) + foto sementara
//   POST { action:'status', id, status, catatan } -> status: disetujui | revisi | ditolak | menunggu
//   POST { action:'hapus', id }
import { json, cfg, dbGet, hariIni, adminOk, urlFoto } from '../_lib/util.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequest({ request, env }) {
  if (!(await adminOk(request, env))) return json(401, { error: 'Sesi admin tidak valid. Silakan login ulang.' });
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const get = dbGet(c), jh = { ...c.h, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  try {
    if (request.method === 'GET') {
      const rows = await get('/jurnal_murid?order=created_at.desc&limit=300&select=*').catch(() => null);
      if (!rows) return json(500, { error: 'Tabel jurnal_murid belum ada. Jalankan supabase-jurnal.sql di Supabase SQL Editor.' });
      const jurnal = await Promise.all(rows.map(async x => ({ ...x, foto: await urlFoto(c, x.foto_path), foto_path: undefined })));
      return json(200, { jurnal });
    }
    if (request.method !== 'POST') return json(405, { error: 'Metode tidak diizinkan.' });
    const b = await request.json().catch(() => ({}));
    const id = String(b.id || '');
    if (!UUID.test(id)) return json(400, { error: 'ID tidak valid.' });

    if (b.action === 'status') {
      const st = String(b.status || ''), catatan = String(b.catatan || '').trim().slice(0, 500);
      if (!['disetujui', 'revisi', 'ditolak', 'menunggu'].includes(st)) return json(400, { error: 'Status tidak valid.' });
      if ((st === 'revisi' || st === 'ditolak') && !catatan) return json(400, { error: 'Tulis catatan singkat untuk murid (alasan revisi/penolakan).' });
      const f = { status: st, catatan_admin: st === 'disetujui' || st === 'menunggu' ? null : catatan, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (st === 'disetujui') f.tanggal_terbit = hariIni();
      const r = await fetch(`${c.REST}/jurnal_murid?id=eq.${id}`, { method: 'PATCH', headers: jh, body: JSON.stringify(f) });
      return r.ok ? json(200, { ok: true }) : json(500, { error: 'Gagal menyimpan.' });
    }
    if (b.action === 'hapus') {
      const old = (await get(`/jurnal_murid?id=eq.${id}&select=foto_path`))[0];
      const r = await fetch(`${c.REST}/jurnal_murid?id=eq.${id}`, { method: 'DELETE', headers: c.h });
      if (!r.ok) return json(500, { error: 'Gagal menghapus.' });
      if (old && old.foto_path) await fetch(`${c.URL}/storage/v1/object/jurnal/${old.foto_path}`, { method: 'DELETE', headers: c.h }).catch(() => {});
      return json(200, { ok: true });
    }
    return json(400, { error: 'Aksi tidak dikenal.' });
  } catch (e) {
    return json(500, { error: 'Terjadi kesalahan pada server.' });
  }
}
