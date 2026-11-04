// Cloudflare Worker route: GET/POST /api/spmb-daftar (PUBLIK, tanpa login)
// Pendaftaran SPMB online. Dua jalur: "dalam" (TK At-Taqwa) dan "luar" (TK Luar At-Taqwa).
//   GET                                                   -> status buka/tutup tiap jalur + batas tanggal lahir
//   POST multipart/form-data { jalur, <isian>, foto, akte, kk, bukti?, setuju, website }  -> kirim pendaftaran
//   POST JSON { action:'cek', nama, tanggal_lahir, kontak }                               -> status pendaftaran sendiri
import { json, cfg, dbGet, hariIni, headerTulis, terlaluSering, TGL } from '../_lib/util.js';
import { TAHUN_AJARAN, TGL_LAHIR_MAKS, JALUR, JENIS_BERKAS, t, pengaturan, fase, bersihkan, kunciPendaftar, bacaBerkas, simpanBerkas, hapusBerkas } from '../_lib/spmb.js';

const PESAN_FASE = {
  akan: 'Pendaftaran jalur ini belum dibuka.',
  ditutup: 'Pendaftaran jalur ini sudah ditutup. Hubungi panitia SPMB untuk informasi gelombang berikutnya.',
  dialihkan: 'Mulai 1 Januari 2027 pendaftar dari TK At-Taqwa mengikuti ketentuan jalur TK Luar. Gunakan formulir jalur TK Luar.'
};
const NAMA_JALUR = { dalam: 'TK At-Taqwa', luar: 'TK Luar' };
const cariKunci = (get, key) => get(`/spmb_pendaftar?tahun_ajaran=eq.${encodeURIComponent(TAHUN_AJARAN)}&kunci=eq.${key}`);

export async function onRequestGet({ env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'Layanan belum siap.' });
  const p = await pengaturan(dbGet(c)), today = hariIni();
  return json(200, {
    tahun_ajaran: TAHUN_AJARAN, 
    tgl_lahir_maks: TGL_LAHIR_MAKS,
    jalur: Object.fromEntries(JALUR.map(j => [j, { fase: fase(p[j], j, today), buka: p[j].buka, tutup: p[j].tutup }]))
  });
}

export async function onRequestPost({ request, env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'Layanan belum siap.' });
  const multi = (request.headers.get('content-type') || '').includes('multipart/form-data');
  try { 
    return multi ? await daftar(request, env, c) : await cek(request, env, c); 
  } catch (e) { 
    return json(500, { error: 'Terjadi kesalahan server. Coba lagi beberapa saat.' }); 
  }
}

async function cek(request, env, c) {
  let b = {}; 
  try { b = await request.json(); } catch (e) {}
  if (b.action !== 'cek') return json(400, { error: 'Aksi tidak dikenal.' });
  if (await terlaluSering(env, request, 'spmb-cek', 10)) return json(429, { error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });

  const nama = t(b.nama, 80), tgl = String(b.tanggal_lahir || ''), hp = String(b.kontak || '').replace(/\D/g, '');
  if (!nama || !TGL.test(tgl) || hp.length < 9) return json(400, { error: 'Lengkapi nama calon murid, tanggal lahir, dan nomor WhatsApp.' });

  const r = (await cariKunci(dbGet(c), await kunciPendaftar(nama, tgl)))[0];
  if (!r || String(r.kontak || '').replace(/\D/g, '').slice(-9) !== hp.slice(-9)) {
    return json(404, { error: 'Pendaftaran tidak ditemukan. Periksa nama, tanggal lahir, dan nomor WhatsApp yang dipakai saat mendaftar.' });
  }

  return json(200, { no_daftar: r.no_daftar, jalur: r.jalur, status: r.status, catatan: r.catatan_panitia || null, created_at: r.created_at });
}

async function daftar(request, env, c) {
  let f; 
  try { f = await request.formData(); } catch (e) { return json(400, { error: 'Data tidak terbaca. Coba kirim ulang.' }); }
  if (f.get('website')) return json(200, { ok: true });
  if (await terlaluSering(env, request, 'spmb-daftar', 8)) return json(429, { error: 'Terlalu banyak pendaftaran dari perangkat ini. Coba lagi beberapa menit lagi.' });

  const b = Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === 'string'));
  const jalur = b.jalur;
  if (!JALUR.includes(jalur)) return json(400, { error: 'Jalur pendaftaran tidak dikenal.' });

  const get = dbGet(c), fs = fase((await pengaturan(get))[jalur], jalur, hariIni());
  if (fs !== 'dibuka') return json(400, { error: PESAN_FASE[fs] });

  const v = bersihkan(b, jalur);
  if (v.err) return json(400, { error: v.err });
  if (b.setuju !== 'true') return json(400, { error: 'Centang pernyataan orang tua/wali terlebih dahulu.' });

  let pembayaran = null;
  if (jalur === 'luar') {
    const token = String(b.token_bayar || '');
    if (!/^[0-9a-f-]{36}$/i.test(token)) return json(403, { kode: 'bayar', error: 'Bukti transfer belum diverifikasi. Cek status pembayaran terlebih dahulu.' });
    pembayaran = (await get(`/spmb_bukti_bayar?token=eq.${token}&select=id,nama,kontak,status,dipakai_oleh&limit=1`))[0];
    if (!pembayaran || pembayaran.status !== 'valid') {
      return json(403, { kode: 'bayar', error: 'Bukti transfer belum disetujui panitia. Periksa status pembayaran atau unggah ulang bukti.' });
    }
    const no = x => String(x || '').replace(/\D/g, '').slice(-9);
    if (String(pembayaran.nama).trim().toLowerCase() !== v.row.nama.toLowerCase() || no(pembayaran.kontak) !== no(v.row.kontak)) {
      return json(403, { kode: 'bayar', error: 'Nama dan nomor WhatsApp harus sama dengan data pada bukti pembayaran.' });
    }
  }

  const berkas = {};
  for (const [k, label, pdf, wajib] of [['foto', 'Foto calon murid', false, true], ['akte', 'Akte kelahiran', true, true], ['kk', 'Kartu Keluarga', true, true], ['bukti', 'Bukti pembayaran formulir', true, false]]) {
    if (k === 'bukti' && jalur !== 'luar') continue;
    const r = await bacaBerkas(f.get(k), { pdf });
    if (r.err) return json(400, { error: `${label}: ${r.err}` });
    if (r.kosong) { if (wajib) return json(400, { error: `Unggah ${label.toLowerCase()}.` }); continue; }
    berkas[k] = r;
  }

  const key = await kunciPendaftar(v.row.nama, v.row.tanggal_lahir), ex = (await cariKunci(get, key))[0] || null;
  if (ex && ex.status !== 'perbaikan') return json(409, { error: 'Calon murid ini sudah terdaftar. Gunakan "Cek status pendaftaran" di bawah formulir.' });
  if (ex && ex.jalur !== jalur) return json(409, { error: `Pendaftaran ini tercatat pada jalur ${NAMA_JALUR[ex.jalur]}. Perbaiki lewat formulir jalur tersebut.` });

  const id = ex ? ex.id : crypto.randomUUID();
  let klaimBaru = false;
  if (pembayaran) {
    if (pembayaran.dipakai_oleh && pembayaran.dipakai_oleh !== id) {
      return json(409, { error: 'Bukti pembayaran ini sudah dipakai untuk pendaftaran lain.' });
    }
    if (!pembayaran.dipakai_oleh) {
      const klaim = await fetch(`${c.REST}/spmb_bukti_bayar?id=eq.${pembayaran.id}&status=eq.valid&dipakai_oleh=is.null`, {
        method: 'PATCH', 
        headers: { ...headerTulis(c), Prefer: 'return=representation' },
        body: JSON.stringify({ dipakai_oleh: id })
      });
      const rows = klaim.ok ? await klaim.json().catch(() => []) : [];
      if (!rows.length) return json(409, { error: 'Bukti pembayaran sudah dipakai atau tidak lagi valid.' });
      klaimBaru = true;
    }
  }

  const baru = {};
  try {
    for (const [k, r] of Object.entries(berkas)) {
      const path = `${id}/${k}-${crypto.randomUUID().slice(0, 8)}.${r.ext}`;
      if (!(await simpanBerkas(c, path, r))) {
        await hapusBerkas(c, Object.values(baru));
        if (klaimBaru) await fetch(`${c.REST}/spmb_bukti_bayar?id=eq.${pembayaran.id}&dipakai_oleh=eq.${id}`, {
          method: 'PATCH', headers: headerTulis(c), body: JSON.stringify({ dipakai_oleh: null })
        });
        return json(500, { error: 'Gagal mengunggah berkas. Coba lagi beberapa saat.' });
      }
      baru[k] = path;
    }

    const lama = k => (ex && ex[JENIS_BERKAS[k]]) || null;
    const row = {
      ...v.row, 
      jalur, 
      tahun_ajaran: TAHUN_AJARAN, 
      kunci: key, 
      status: 'baru', 
      catatan_panitia: null, 
      verified_at: null,
      foto_path: baru.foto || lama('foto'), 
      akte_path: baru.akte || lama('akte'), 
      kk_path: baru.kk || lama('kk'), 
      bukti_path: baru.bukti || lama('bukti')
    };

    const jh = { ...headerTulis(c), Prefer: 'return=representation' };
    const w = ex
      ? await fetch(`${c.REST}/spmb_pendaftar?id=eq.${id}`, { method: 'PATCH', headers: jh, body: JSON.stringify(row) })
      : await fetch(`${c.REST}/spmb_pendaftar`, { method: 'POST', headers: jh, body: JSON.stringify({ ...row, id }) });

    if (!w.ok) {
      await hapusBerkas(c, Object.values(baru));
      if (klaimBaru) await fetch(`${c.REST}/spmb_bukti_bayar?id=eq.${pembayaran.id}&dipakai_oleh=eq.${id}`, {
        method: 'PATCH', headers: headerTulis(c), body: JSON.stringify({ dipakai_oleh: null })
      });
      return w.status === 409 ? json(409, { error: 'Calon murid ini sudah terdaftar.' }) : json(500, { error: 'Gagal menyimpan pendaftaran. Coba lagi beberapa saat.' });
    }

    await hapusBerkas(c, Object.keys(baru).map(lama));
    const hasil = (await w.json().catch(() => []))[0] || {};
    return json(200, { ok: true, no_daftar: hasil.no_daftar || null, diperbaiki: !!ex });
  } catch (e) {
    await hapusBerkas(c, Object.values(baru));
    if (klaimBaru) await fetch(`${c.REST}/spmb_bukti_bayar?id=eq.${pembayaran.id}&dipakai_oleh=eq.${id}`, {
      method: 'PATCH', headers: headerTulis(c), body: JSON.stringify({ dipakai_oleh: null })
    });
    throw e;
  }
}

export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });