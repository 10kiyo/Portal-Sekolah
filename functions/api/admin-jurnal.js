// Cloudflare Worker route: GET/POST /api/admin-jurnal (PIN admin ATAU akun guru/staf berperan 'info' / admin)
//   GET                                           -> semua jurnal (terbaru dulu) + info murid & foto sementara
//   POST { action:'status', id, status, catatan } -> status: disetujui | revisi | ditolak | menunggu
//   POST { action:'hapus', id }
import { json, cfg, dbGet, hariIni, infoOk, urlFoto, UUID, headerTulis } from '../_lib/util.js';

const SELECT_ADMIN = 'id,judul,isi,status,catatan_admin,foto_url,tanggal_terbit,verified_at,created_at,updated_at,murid(id,nama_lengkap,kelas(nama_kelas))';

export async function onRequest({ request, env }) {
  if (!(await infoOk(request, env))) {
    return json(401, { error: 'Sesi tidak valid atau akun tidak punya akses Info & Galeri. Silakan login ulang.' });
  }

  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });

  const get = dbGet(c), jh = headerTulis(c);

  try {
    if (request.method === 'GET') {
      const rows = await get(`/jurnal_murid?order=created_at.desc&limit=300&select=${SELECT_ADMIN}`).catch(() => null);
      if (!rows) return json(500, { error: 'Tabel jurnal_murid belum ada di Supabase.' });

      const jurnal = await Promise.all(rows.map(async x => {
        const fotoPath = x.foto_url || x.foto_path;
        return {
          ...x,
          nama_anak: x.murid ? x.murid.nama_lengkap : (x.nama_anak || '-'),
          kelas: (x.murid && x.murid.kelas) ? x.murid.kelas.nama_kelas : (x.kelas || '-'),
          foto: await urlFoto(c, fotoPath),
          foto_url: undefined,
          foto_path: undefined
        };
      }));

      return json(200, { jurnal });
    }

    if (request.method !== 'POST') return json(405, { error: 'Metode tidak diizinkan.' });

    const b = await request.json().catch(() => ({}));
    const id = String(b.id || '');
    if (!UUID.test(id)) return json(400, { error: 'ID tidak valid.' });

    if (b.action === 'status') {
      const st = String(b.status || ''), catatan = String(b.catatan || '').trim().slice(0, 500);
      if (!['disetujui', 'revisi', 'ditolak', 'menunggu'].includes(st)) {
        return json(400, { error: 'Status tidak valid.' });
      }
      if ((st === 'revisi' || st === 'ditolak') && !catatan) {
        return json(400, { error: 'Tulis catatan singkat untuk murid (alasan revisi/penolakan).' });
      }

      const f = { 
        status: st, 
        catatan_admin: st === 'disetujui' || st === 'menunggu' ? null : catatan, 
        verified_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      };
      if (st === 'disetujui') f.tanggal_terbit = hariIni();

      const r = await fetch(`${c.REST}/jurnal_murid?id=eq.${id}`, { method: 'PATCH', headers: jh, body: JSON.stringify(f) });
      return r.ok ? json(200, { ok: true }) : json(500, { error: 'Gagal menyimpan status jurnal.' });
    }

    if (b.action === 'hapus') {
      const old = (await get(`/jurnal_murid?id=eq.${id}&select=foto_url`))[0];
      const path = old ? (old.foto_url || old.foto_path) : null;

      const r = await fetch(`${c.REST}/jurnal_murid?id=eq.${id}`, { method: 'DELETE', headers: c.h });
      if (!r.ok) return json(500, { error: 'Gagal menghapus jurnal.' });

      if (path) {
        await fetch(`${c.URL}/storage/v1/object/jurnal/${path}`, { method: 'DELETE', headers: c.h }).catch(() => {});
      }
      return json(200, { ok: true });
    }

    return json(400, { error: 'Aksi tidak dikenal.' });
  } catch (e) {
    return json(500, { error: 'Terjadi kesalahan pada server.' });
  }
}