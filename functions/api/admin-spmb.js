// Cloudflare Worker route: GET/POST /api/admin-spmb (khusus panitia SPMB)
// Akses: PIN admin (token dari /api/admin-auth) ATAU akun guru/staf berperan SPMB / operator / admin.
//   GET                                          -> semua pendaftar, bukti transfer TK Luar + pengaturan
//   POST { action:'berkas', id }                 -> tautan sementara foto / akte / KK / bukti pembayaran
//   POST { action:'berkas_bayar', id }           -> tautan sementara bukti transfer formulir TK Luar
//   POST { action:'verifikasi_bayar', id, status, catatan } -> verifikasi pembayaran formulir
//   POST { action:'status', id, status, catatan }-> ubah status verifikasi (catatan tampil ke orang tua)
//   POST { action:'checklist', id, checklist }   -> centang kelengkapan berkas fisik dan tahapan
//   POST { action:'pengaturan', jalur, aktif, buka, tutup }
//   POST { action:'hapus', id }                  -> hapus pendaftar beserta berkasnya
import { json, cfg, dbGet, hariIni, UUID, TGL, headerTulis } from '../_lib/util.js';
import { spmbOk, pengaturan, TAHUN_AJARAN, TGL_LAHIR_MAKS, STATUS, CHECKLIST, JALUR, JENIS_BERKAS, t, urlBerkas, hapusBerkas } from '../_lib/spmb.js';

export async function onRequest({ request, env }) {
  if (!(await spmbOk(request, env))) {
    return json(401, { error: 'Sesi tidak valid. Silakan login ulang.' });
  }

  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });

  const get = dbGet(c), jh = headerTulis(c);
  const ubah = (id, data) => fetch(`${c.REST}/spmb_pendaftar?id=eq.${id}`, { method: 'PATCH', headers: jh, body: JSON.stringify(data) });

  try {
    if (request.method === 'GET') {
      const rows = await get('/spmb_pendaftar?order=created_at.desc&limit=5000&select=*').catch(() => null);
      if (!rows) return json(500, { error: 'Tabel SPMB belum ada di Supabase.' });

      const pembayaran = await get('/spmb_bukti_bayar?order=created_at.desc&limit=1000&select=id,nama,kontak,status,catatan,dipakai_oleh,created_at')
        .catch(() => null);
      if (!pembayaran) return json(500, { error: 'Tabel pembayaran belum tersedia di Supabase.' });

      return json(200, {
        today: hariIni(), 
        tahun_ajaran: TAHUN_AJARAN, 
        tgl_lahir_maks: TGL_LAHIR_MAKS, 
        pengaturan: await pengaturan(get),
        pembayaran,
        pendaftar: rows.map(r => {
          const o = { ...r }; 
          delete o.kunci;
          for (const [j, k] of Object.entries(JENIS_BERKAS)) { 
            o['ada_' + j] = !!r[k]; 
            delete o[k]; 
          }
          return o;
        })
      });
    }

    if (request.method !== 'POST') return json(405, { error: 'Metode tidak diizinkan.' });

    const b = await request.json().catch(() => ({}));

    if (b.action === 'pengaturan') {
      const jalur = String(b.jalur || ''), buka = String(b.buka || ''), tutup = String(b.tutup || '');
      if (!JALUR.includes(jalur)) return json(400, { error: 'Jalur tidak dikenal.' });
      if (!TGL.test(buka) || !TGL.test(tutup)) return json(400, { error: 'Tanggal buka dan tutup wajib diisi.' });
      if (buka > tutup) return json(400, { error: 'Tanggal tutup harus sama atau setelah tanggal buka.' });

      const r = await fetch(`${c.REST}/spmb_pengaturan`, { 
        method: 'POST', 
        headers: { ...jh, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ jalur, aktif: b.aktif !== false, buka, tutup, updated_at: new Date().toISOString() }) 
      });

      return r.ok ? json(200, { ok: true }) : json(500, { error: 'Gagal menyimpan pengaturan SPMB.' });
    }

    if (b.action === 'berkas_bayar' || b.action === 'verifikasi_bayar') {
      if (!UUID.test(String(b.id || ''))) return json(400, { error: 'ID pembayaran tidak valid.' });

      if (b.action === 'berkas_bayar') {
        const pathRows = await get(`/spmb_bukti_bayar?id=eq.${b.id}&select=file_path`);
        if (!pathRows || !pathRows[0]) return json(404, { error: 'Bukti pembayaran tidak ditemukan.' });

        const url = await urlBerkas(c, pathRows[0].file_path, 'bukti-bayar');
        return url ? json(200, { url, pdf: /\.pdf$/i.test(pathRows[0].file_path) })
          : json(500, { error: 'Tautan bukti pembayaran tidak dapat dibuat.' });
      }

      const status = String(b.status || '');
      if (!['valid', 'ditolak'].includes(status)) return json(400, { error: 'Status pembayaran tidak valid.' });

      const catatan = t(b.catatan, 300);
      if (status === 'ditolak' && !catatan) return json(400, { error: 'Tulis alasan penolakan agar pendaftar tahu apa yang perlu diperbaiki.' });

      const current = (await get(`/spmb_bukti_bayar?id=eq.${b.id}&select=id,status,dipakai_oleh`))[0];
      if (!current) return json(404, { error: 'Bukti pembayaran tidak ditemukan.' });
      if (current.dipakai_oleh) return json(409, { error: 'Bukti pembayaran sudah dipakai untuk pendaftaran.' });
      if (current.status !== 'menunggu') return json(409, { error: 'Bukti pembayaran ini sudah diverifikasi.' });

      const saved = await fetch(`${c.REST}/spmb_bukti_bayar?id=eq.${b.id}&status=eq.menunggu&dipakai_oleh=is.null`, {
        method: 'PATCH', 
        headers: { ...jh, Prefer: 'return=representation' },
        body: JSON.stringify({ status, catatan: catatan || null, verified_at: new Date().toISOString() })
      });

      if (!saved.ok) return json(500, { error: 'Gagal menyimpan verifikasi pembayaran.' });
      const changed = await saved.json().catch(() => []);
      return changed.length ? json(200, { ok: true }) : json(409, { error: 'Bukti pembayaran sudah dipakai atau sudah diverifikasi.' });
    }

    // Aksi untuk satu calon pendaftar
    if (!UUID.test(String(b.id || ''))) return json(400, { error: 'ID tidak valid.' });

    if (b.action === 'berkas') {
      const row = (await get(`/spmb_pendaftar?id=eq.${b.id}&select=foto_path,akte_path,kk_path,bukti_path`))[0];
      if (!row) return json(404, { error: 'Pendaftar tidak ditemukan.' });

      const out = {};
      await Promise.all(Object.entries(JENIS_BERKAS).map(async ([j, k]) => {
        if (row[k]) out[j] = { url: await urlBerkas(c, row[k]), pdf: /\.pdf$/i.test(row[k]) };
      }));
      return json(200, { berkas: out });
    }

    if (b.action === 'status') {
      const status = String(b.status || ''), catatan = t(b.catatan, 300);
      if (!STATUS.includes(status)) return json(400, { error: 'Status tidak valid.' });
      if (status === 'perbaikan' && !catatan) return json(400, { error: 'Tulis bagian yang perlu diperbaiki agar orang tua tahu apa yang harus dilakukan.' });

      const r = await ubah(b.id, { status, catatan_panitia: catatan || null, verified_at: status === 'baru' ? null : new Date().toISOString() });
      return r.ok ? json(200, { ok: true }) : json(500, { error: 'Gagal menyimpan status pendaftaran.' });
    }

    if (b.action === 'checklist') {
      const cl = Object.fromEntries(CHECKLIST.map(k => [k, !!(b.checklist || {})[k]]));
      const r = await ubah(b.id, { checklist: cl });
      return r.ok ? json(200, { ok: true }) : json(500, { error: 'Gagal menyimpan checklist berkas.' });
    }

    if (b.action === 'hapus') {
      const row = (await get(`/spmb_pendaftar?id=eq.${b.id}&select=foto_path,akte_path,kk_path,bukti_path`))[0];
      if (!row) return json(404, { error: 'Pendaftar tidak ditemukan.' });

      const r = await fetch(`${c.REST}/spmb_pendaftar?id=eq.${b.id}`, { method: 'DELETE', headers: c.h });
      if (!r.ok) return json(500, { error: 'Gagal menghapus data pendaftar.' });

      await hapusBerkas(c, Object.values(JENIS_BERKAS).map(k => row[k]));
      return json(200, { ok: true });
    }

    return json(400, { error: 'Aksi tidak dikenal.' });
  } catch (e) {
    return json(500, { error: 'Terjadi kesalahan pada server.' });
  }
}

export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });