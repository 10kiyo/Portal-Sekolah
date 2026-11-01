// Cloudflare Worker route: GET/POST /api/admin-info  (khusus admin, token dari /api/admin-auth)
import { json, cfg, dbGet, hariIni, infoOk } from '../_lib/util.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TGL = /^\d{4}-\d{2}-\d{2}$/;
const KAT = ['pengumuman', 'agenda', 'surat', 'kegiatan', 'prestasi', 'lainnya'];
const MAXFILE = 4 * 1024 * 1024;
const TIPE = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function onRequest({ request, env }) {
  if (!(await infoOk(request, env))) return json(401, { error: 'Sesi tidak valid atau akun tidak punya akses Info & Galeri. Silakan login ulang.' });
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const get = dbGet(c);
  const jh = { ...c.h, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const prefix = `${c.URL}/storage/v1/object/public/info/`;
  const hapusFile = url => (url && url.startsWith(prefix))
    ? fetch(`${c.URL}/storage/v1/object/info/${url.slice(prefix.length)}`, { method: 'DELETE', headers: c.h }).catch(() => {}) : null;

  try {
    if (request.method === 'GET') {
      const rows = await get('/info_sekolah?order=tanggal_terbit.desc,created_at.desc&limit=500&select=*').catch(() => null);
      if (!rows) return json(500, { error: 'Tabel info_sekolah belum ada. Jalankan supabase-info.sql di Supabase SQL Editor.' });
      // Galeri Prestasi (supabase-galeri.sql). null = tabel belum dibuat; info tetap berfungsi.
      const galeri = await get('/galeri_prestasi?order=tanggal.desc,created_at.desc&limit=1000&select=*').catch(() => null);
      return json(200, { today: hariIni(), info: rows, galeri });
    }
    if (request.method !== 'POST') return json(405, { error: 'Metode tidak diizinkan.' });
    const b = await request.json().catch(() => ({}));

    if (b.action === 'upload') {
      const s = String(b.file || ''), i = s.indexOf(','), m = /^data:([a-z]+\/[a-z0-9.+-]+);base64$/i.exec(s.slice(0, i));
      if (!m || !TIPE[m[1].toLowerCase()]) return json(400, { error: 'Hanya file PDF, JPG, PNG, atau WEBP.' });
      let bytes;
      try { bytes = Uint8Array.from(atob(s.slice(i + 1)), ch => ch.charCodeAt(0)); } catch (e) { return json(400, { error: 'File tidak valid.' }); }
      if (bytes.length > MAXFILE) return json(400, { error: 'Ukuran file maksimal 4 MB.' });
      const tipe = m[1].toLowerCase(), galeriFoto = b.folder === 'galeri';
      if (galeriFoto && tipe === 'application/pdf') return json(400, { error: 'Galeri hanya menerima foto (JPG, PNG, WEBP).' });
      const path = `${galeriFoto ? 'galeri/' : ''}${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${TIPE[tipe]}`;
      const up = await fetch(`${c.URL}/storage/v1/object/info/${path}`, { method: 'POST', headers: { ...c.h, 'Content-Type': tipe }, body: bytes });
      if (!up.ok) return json(500, { error: 'Gagal mengunggah. Pastikan bucket "info" sudah dibuat (lihat supabase-info.sql).' });
      return json(200, { url: prefix + path });
    }

    if (b.action === 'simpan') {
      const lamp = String(b.lampiran_url || '').trim();
      const k = {
        judul: String(b.judul || '').trim().slice(0, 150),
        kategori: String(b.kategori || ''),
        isi: String(b.isi || '').trim().slice(0, 8000) || null,
        tanggal_terbit: String(b.tanggal_terbit || hariIni()),
        tanggal_agenda: b.tanggal_agenda ? String(b.tanggal_agenda) : null,
        lokasi: String(b.lokasi || '').trim().slice(0, 150) || null,
        sematkan: b.sematkan === true,
        terbit: b.terbit !== false,
        lampiran_url: lamp || null,
        lampiran_nama: lamp ? (String(b.lampiran_nama || '').trim().slice(0, 100) || 'Lampiran') : null,
        updated_at: new Date().toISOString()
      };
      const jk = String(b.jenis_kegiatan || '');
      if (jk && !['ekskul', 'club', 'unggulan'].includes(jk)) return json(400, { error: 'Jenis kegiatan tidak valid.' });
      if (jk || b.id) k.jenis_kegiatan = jk || null;   // kolom dari supabase-jurnal.sql
      if (!k.judul) return json(400, { error: 'Judul wajib diisi.' });
      if (!KAT.includes(k.kategori)) return json(400, { error: 'Kategori tidak valid.' });
      if (!TGL.test(k.tanggal_terbit) || (k.tanggal_agenda && !TGL.test(k.tanggal_agenda))) return json(400, { error: 'Format tanggal tidak valid.' });
      if (lamp && (!/^https:\/\//i.test(lamp) || lamp.length > 600)) return json(400, { error: 'Tautan lampiran harus diawali https://' });
      const id = b.id ? String(b.id) : '';
      if (id && !UUID.test(id)) return json(400, { error: 'ID tidak valid.' });
      let r;
      if (id) {
        const old = (await get(`/info_sekolah?id=eq.${id}&select=lampiran_url`))[0];
        r = await fetch(`${c.REST}/info_sekolah?id=eq.${id}`, { method: 'PATCH', headers: jh, body: JSON.stringify(k) });
        if (r.ok && old && old.lampiran_url && old.lampiran_url !== k.lampiran_url) await hapusFile(old.lampiran_url);
      } else r = await fetch(`${c.REST}/info_sekolah`, { method: 'POST', headers: jh, body: JSON.stringify(k) });
      return r.ok ? json(200, { ok: true }) : json(500, { error: 'Gagal menyimpan. Pastikan supabase-info.sql sudah dijalankan.' });
    }

    // ---- Galeri Prestasi: unggah banyak foto sekaligus (file diunggah satu per satu lewat action 'upload', lalu didaftarkan di sini) ----
    if (b.action === 'galeri_tambah') {
      const items = Array.isArray(b.items) ? b.items.slice(0, 50) : [], tanggal = String(b.tanggal || hariIni());
      if (!items.length) return json(400, { error: 'Tidak ada foto.' });
      if (!TGL.test(tanggal)) return json(400, { error: 'Format tanggal tidak valid.' });
      const baris = items.map(i => ({ foto_url: String((i && i.url) || ''), keterangan: String((i && i.keterangan) || '').trim().slice(0, 150) || null, tanggal }));
      if (baris.some(x => !x.foto_url.startsWith(prefix + 'galeri/'))) return json(400, { error: 'Foto harus diunggah lewat panel ini.' });
      const r = await fetch(`${c.REST}/galeri_prestasi`, { method: 'POST', headers: jh, body: JSON.stringify(baris) });
      return r.ok ? json(200, { ok: true, jumlah: baris.length }) : json(500, { error: 'Gagal menyimpan. Pastikan supabase-galeri.sql sudah dijalankan.' });
    }
    if (b.action === 'galeri_ubah') {
      const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).map(String).filter(x => UUID.test(x)).slice(0, 200);
      if (!ids.length) return json(400, { error: 'ID tidak valid.' });
      const f = {};
      if (typeof b.tampil === 'boolean') f.tampil = b.tampil;
      if (typeof b.keterangan === 'string') f.keterangan = b.keterangan.trim().slice(0, 150) || null;
      if (b.tanggal) { if (!TGL.test(String(b.tanggal))) return json(400, { error: 'Format tanggal tidak valid.' }); f.tanggal = String(b.tanggal); }
      if (!Object.keys(f).length) return json(400, { error: 'Tidak ada perubahan.' });
      const r = await fetch(`${c.REST}/galeri_prestasi?id=in.(${ids.join(',')})`, { method: 'PATCH', headers: jh, body: JSON.stringify(f) });
      return r.ok ? json(200, { ok: true }) : json(500, { error: 'Gagal menyimpan.' });
    }
    if (b.action === 'galeri_hapus') {
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter(x => UUID.test(x)).slice(0, 200);
      if (!ids.length) return json(400, { error: 'ID tidak valid.' });
      const lama = await get(`/galeri_prestasi?id=in.(${ids.join(',')})&select=foto_url`).catch(() => []);
      const r = await fetch(`${c.REST}/galeri_prestasi?id=in.(${ids.join(',')})`, { method: 'DELETE', headers: c.h });
      if (!r.ok) return json(500, { error: 'Gagal menghapus.' });
      await Promise.all(lama.map(x => hapusFile(x.foto_url)));
      return json(200, { ok: true });
    }

    if (b.action === 'terbit' || b.action === 'sematkan') {
      if (!UUID.test(String(b.id || ''))) return json(400, { error: 'ID tidak valid.' });
      const f = b.action === 'terbit' ? { terbit: b.nilai === true } : { sematkan: b.nilai === true };
      const r = await fetch(`${c.REST}/info_sekolah?id=eq.${b.id}`, { method: 'PATCH', headers: jh, body: JSON.stringify(f) });
      return r.ok ? json(200, { ok: true }) : json(500, { error: 'Gagal menyimpan.' });
    }

    if (b.action === 'hapus') {
      if (!UUID.test(String(b.id || ''))) return json(400, { error: 'ID tidak valid.' });
      const old = (await get(`/info_sekolah?id=eq.${b.id}&select=lampiran_url`))[0];
      const r = await fetch(`${c.REST}/info_sekolah?id=eq.${b.id}`, { method: 'DELETE', headers: c.h });
      if (!r.ok) return json(500, { error: 'Gagal menghapus.' });
      if (old) await hapusFile(old.lampiran_url);
      return json(200, { ok: true });
    }
    return json(400, { error: 'Aksi tidak dikenal.' });
  } catch (e) {
    return json(500, { error: 'Terjadi kesalahan pada server.' });
  }
}
