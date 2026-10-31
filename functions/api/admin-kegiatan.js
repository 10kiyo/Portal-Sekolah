// Cloudflare Worker route: GET/POST /api/admin-kegiatan  (khusus admin, butuh token dari /api/admin-auth)
import { json, cfg, dbGet, hariIni, fase, adminOk } from '../_lib/util.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TGL = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequest({ request, env }) {
  if (!(await adminOk(request, env))) return json(401, { error: 'Sesi admin tidak valid. Silakan login ulang.' });
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const get = dbGet(c);
  const jh = { ...c.h, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

  try {
    if (request.method === 'GET') {
      const today = hariIni();
      const [ks, ps, mu] = await Promise.all([
        get('/kegiatan?order=tanggal_kegiatan.desc&select=*'),
        get('/pendaftaran_kegiatan?order=created_at.desc&limit=10000&select=id,kegiatan_id,anak_key,nama_anak,kelas,status,nama_pengirim,tanggal_transfer,data,catatan_panitia,created_at,verified_at,bukti_path'),
        get('/kelas_murid?aktif=eq.true&select=id,guest_id,nama,kelas_kelas(nama)&limit=5000').catch(() => [])
      ]).catch(() => null);
      if (!ks) return json(500, { error: 'Tabel kegiatan belum ada atau tidak terbaca. Jalankan supabase-kegiatan.sql di Supabase SQL Editor.' });
      const tp = {}; ps.forEach(p => { if (p.status !== 'ditolak') tp[p.kegiatan_id] = (tp[p.kegiatan_id] || 0) + 1; });
      // Ekskul & club: panitia HANYA menerima jumlah (tanpa nama/data). Rinciannya milik pustakawan.
      const ec = await get('/ekskul_pendaftar?select=kegiatan_id,status&limit=10000').catch(() => []);
      const jumlahEC = {}, jenisK = Object.fromEntries(ks.map(k => [k.id, k.jenis || 'umum']));
      ec.forEach(r => {
        jumlahEC[r.kegiatan_id] = (jumlahEC[r.kegiatan_id] || 0) + 1;
        if (jenisK[r.kegiatan_id] === 'club' ? r.status === 'diterima' : r.status !== 'ditolak') tp[r.kegiatan_id] = (tp[r.kegiatan_id] || 0) + 1;
      });
      // Daftar murid unik (satu anak bisa punya beberapa baris dari beberapa guru).
      const mm = new Map();
      mu.forEach(m => {
        const key = m.guest_id || 'm:' + m.id, kl = m.kelas_kelas && m.kelas_kelas.nama;
        const e = mm.get(key) || { key, nama: m.nama, kelas: new Set() };
        if (kl) e.kelas.add(kl); mm.set(key, e);
      });
      return json(200, {
        today,
        kegiatan: ks.map(k => ({ ...k, jenis: k.jenis || 'umum', jumlah_ec: jumlahEC[k.id] || 0, terpakai: tp[k.id] || 0, fase: fase(k, tp[k.id] || 0, today) })),
        pendaftar: ps.map(p => ({ ...p, has_bukti: !!p.bukti_path, bukti_path: undefined })),
        murid: [...mm.values()].map(e => ({ key: e.key, nama: e.nama, kelas: [...e.kelas].join(', ') }))
      });
    }
    if (request.method !== 'POST') return json(405, { error: 'Metode tidak diizinkan.' });
    const b = await request.json().catch(() => ({}));

    if (b.action === 'simpan') {
      const k = {
        nama: String(b.nama || '').trim().slice(0, 100),
        deskripsi: String(b.deskripsi || '').trim().slice(0, 1000) || null,
        rekening: String(b.rekening || '').trim().slice(0, 300) || null,
        biaya: Number(b.biaya), buka_daftar: String(b.buka_daftar || ''), tutup_daftar: String(b.tutup_daftar || ''),
        tanggal_kegiatan: String(b.tanggal_kegiatan || ''),
        kuota: b.kuota === null || b.kuota === '' || b.kuota === undefined ? null : Number(b.kuota),
        aktif: b.aktif !== false,
        tanya_kaos: b.tanya_kaos === true, tanya_kesehatan: b.tanya_kesehatan === true,
        // tingkat kosong/null = semua kelas; selain itu hanya murid di tingkat tersebut yang bisa mendaftar
        tingkat: [...new Set((Array.isArray(b.tingkat) ? b.tingkat : []).map(Number))].filter(n => Number.isInteger(n) && n >= 1 && n <= 6).sort(),
        untuk_umum: b.untuk_umum === true, tampil_info: b.tampil_info !== false,
        jenis: ['umum', 'ekskul', 'club'].includes(b.jenis) ? b.jenis : 'umum'
      };
      // Ekskul & club hanya lewat tautan murid (kode akses): tidak ada pendaftaran umum. Club selalu gratis.
      if (k.jenis !== 'umum') { k.untuk_umum = false; k.tampil_info = false; k.tanya_kaos = k.jenis === 'ekskul' ? k.tanya_kaos : false; }
      if (k.jenis === 'club') { k.biaya = 0; k.rekening = null; }
      if (k.jenis === 'ekskul' && k.biaya > 0 && !k.rekening) return json(400, { error: 'Isi rekening tujuan transfer (rekening Bu Laras) untuk ekskul berbayar.' });
      if (!k.tingkat.length) k.tingkat = null;
      if (!k.nama) return json(400, { error: 'Nama kegiatan wajib diisi.' });
      if (!Number.isInteger(k.biaya) || k.biaya < 0 || k.biaya > 100000000) return json(400, { error: 'Biaya tidak valid.' });
      if (![k.buka_daftar, k.tutup_daftar, k.tanggal_kegiatan].every(d => TGL.test(d))) return json(400, { error: 'Tanggal tidak lengkap.' });
      if (k.buka_daftar > k.tutup_daftar) return json(400, { error: 'Tanggal tutup harus sama atau setelah tanggal buka.' });
      if (k.kuota !== null && (!Number.isInteger(k.kuota) || k.kuota < 1 || k.kuota > 10000)) return json(400, { error: 'Kuota tidak valid.' });
      const id = b.id ? String(b.id) : '';
      if (id && !UUID.test(id)) return json(400, { error: 'ID tidak valid.' });
      const r = id
        ? await fetch(`${c.REST}/kegiatan?id=eq.${id}`, { method: 'PATCH', headers: jh, body: JSON.stringify(k) })
        : await fetch(`${c.REST}/kegiatan`, { method: 'POST', headers: jh, body: JSON.stringify(k) });
      if (!r.ok) return json(500, { error: 'Gagal menyimpan. Pastikan supabase-kegiatan.sql, supabase-kegiatan-opsi.sql, dan supabase-kegiatan-tingkat.sql sudah dijalankan, dan supabase-ekskul-club.sql sudah dijalankan.' });
      return json(200, { ok: true });
    }

    if (b.action === 'aktif') {
      if (!UUID.test(String(b.id || ''))) return json(400, { error: 'ID tidak valid.' });
      const r = await fetch(`${c.REST}/kegiatan?id=eq.${b.id}`, { method: 'PATCH', headers: jh, body: JSON.stringify({ aktif: b.aktif === true }) });
      return r.ok ? json(200, { ok: true }) : json(500, { error: 'Gagal menyimpan.' });
    }

    if (b.action === 'hapus') {
      if (!UUID.test(String(b.id || ''))) return json(400, { error: 'ID tidak valid.' });
      const n = [...await get(`/pendaftaran_kegiatan?kegiatan_id=eq.${b.id}&select=id&limit=1`), ...await get(`/ekskul_pendaftar?kegiatan_id=eq.${b.id}&select=id&limit=1`).catch(() => [])];
      if (n.length) return json(400, { error: 'Kegiatan sudah punya pendaftar, jadi tidak bisa dihapus. Gunakan "Tutup pendaftaran" saja.' });
      const r = await fetch(`${c.REST}/kegiatan?id=eq.${b.id}`, { method: 'DELETE', headers: c.h });
      return r.ok ? json(200, { ok: true }) : json(500, { error: 'Gagal menghapus.' });
    }

    if (b.action === 'verifikasi') {
      const status = String(b.status || ''), catatan = String(b.catatan || '').trim().slice(0, 300);
      if (!UUID.test(String(b.id || '')) || !['menunggu', 'lunas', 'ditolak'].includes(status)) return json(400, { error: 'Data tidak valid.' });
      if (status === 'ditolak' && !catatan) return json(400, { error: 'Tulis alasan penolakan agar orang tua tahu apa yang perlu diperbaiki.' });
      const r = await fetch(`${c.REST}/pendaftaran_kegiatan?id=eq.${b.id}`, { method: 'PATCH', headers: jh, body: JSON.stringify({ status, catatan_panitia: catatan || null, verified_at: status === 'menunggu' ? null : new Date().toISOString() }) });
      return r.ok ? json(200, { ok: true }) : json(500, { error: 'Gagal menyimpan.' });
    }

    if (b.action === 'bukti') {
      if (!UUID.test(String(b.id || ''))) return json(400, { error: 'ID tidak valid.' });
      const row = (await get(`/pendaftaran_kegiatan?id=eq.${b.id}&select=bukti_path`))[0];
      if (!row || !row.bukti_path) return json(404, { error: 'Bukti tidak ditemukan.' });
      const r = await fetch(`${c.URL}/storage/v1/object/sign/bukti/${row.bukti_path}`, { method: 'POST', headers: { ...c.h, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 600 }) });
      const d = await r.json().catch(() => ({}));
      return d.signedURL ? json(200, { url: `${c.URL}/storage/v1${d.signedURL}` }) : json(500, { error: 'Gagal membuat tautan bukti.' });
    }
    return json(400, { error: 'Aksi tidak dikenal.' });
  } catch (e) {
    return json(500, { error: 'Kesalahan server.' });
  }
}
