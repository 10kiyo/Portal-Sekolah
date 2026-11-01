// Cloudflare Worker route: GET /api/guru  (publik)
// Sumber utama: tabel Supabase "guru_staf" (jabatan, kelompok, mapel, wali kelas, foto). Username/PIN TIDAK pernah dikirim.
// Cadangan: guru/staf di "daftar_tamu_gabungan" (yang sama dengan Buku Tamu) yang belum ada di tabel guru_staf tetap tampil.
// Nomor WhatsApp TIDAK pernah dikirim ke publik. Data diperbarui otomatis (cache 1 menit).
//
//  - Cek jenis undangan apa saja yang ada:  /api/guru?jenis=1
//  - Pilih jenis secara manual (opsional): isi variabel GURU_JENIS di Cloudflare, mis. "Guru,Staf TU,Karyawan"
//    (huruf besar/kecil tidak berpengaruh). Tanpa variabel ini, dipakai pola otomatis di bawah.
import { json, cfg, dbGet } from '../_lib/util.js';

const POLA_GURU = /guru|staf|staff|karyawan|pegawai|tendik|tenaga|pimpinan|kepala sekolah|tata usaha|\btu\b|satpam|security|cleaning|kebersihan/i;
const BUKAN = /siswa|murid|anak|orang ?tua|wali ?murid|alumni|tamu umum/i;
const PIMPINAN = /kepala sekolah|wakil|waka\b|wakakur|pimpinan/i;
const kunci = n => String(n || '').replace(/,.*$/, '').toLowerCase().replace(/[^a-z]/g, '');
const ttl = s => ({ 'Cache-Control': `public, max-age=${s}` });

async function semuaTamu(c) {
  const get = dbGet(c), out = [];
  for (let off = 0; off < 20000; off += 1000) {
    const rows = await get(`/daftar_tamu_gabungan?select=guest_id,guest_name,jenis_undangan,instansi_kelas&order=guest_id&limit=1000&offset=${off}`);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function dariTabel(c) {            // null bila tabel guru_staf belum dibuat
  try { return await dbGet(c)('/guru_staf?select=nama,jabatan,kelompok,mapel,walikelas,foto,urutan,aktif&order=nama&limit=2000'); } catch (e) { return null; }
}

export async function onRequestGet({ request, env, ctx }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const url = new URL(request.url), cache = caches.default;
  const key = new Request(new URL('/api/guru' + (url.searchParams.get('jenis') ? '?jenis=1' : ''), request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const tamu = await semuaTamu(c);
    let res;
    if (url.searchParams.get('jenis')) {                       // bantuan: daftar jenis undangan yang ada
      const n = {};
      tamu.forEach(x => { const j = String(x.jenis_undangan || '(kosong)').trim(); n[j] = (n[j] || 0) + 1; });
      res = new Response(JSON.stringify({ jenis_undangan: n, dipilih_otomatis: Object.keys(n).filter(j => POLA_GURU.test(j) && !BUKAN.test(j)) }), { status: 200, headers: { 'Content-Type': 'application/json', ...ttl(60) } });
    } else {
      const manual = String(env.GURU_JENIS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const cocok = j => { j = String(j || '').trim(); return manual.length ? manual.includes(j.toLowerCase()) : (POLA_GURU.test(j) && !BUKAN.test(j)); };
      const tabel = await dariTabel(c), seen = new Set(), guru = [];
      (tabel || []).forEach(r => {
        const k = kunci(r.nama); if (!k || seen.has(k)) return; seen.add(k);          // baris nonaktif ikut dicatat agar tidak muncul dari daftar tamu
        if (r.aktif === false) return;
        guru.push({ nama: String(r.nama).trim(), jabatan: String(r.jabatan || '').trim(), kelompok: r.kelompok || 'guru', urutan: r.urutan,
          mapel: String(r.mapel || '').split(',').map(x => x.trim()).filter(Boolean), walikelas: String(r.walikelas || '').trim(), foto: String(r.foto || '').trim(), dariTabel: true });
      });
      for (const x of (tabel && tabel.length ? [] : tamu)) {     // tabel guru_staf terisi = satu-satunya sumber (hindari nama ganda)
        const nama = String(x.guest_name || '').trim().replace(/\s+/g, ' ');
        if (!nama || !cocok(x.jenis_undangan)) continue;
        const k = kunci(nama) || nama.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        const jenis = String(x.jenis_undangan || '').trim(), ket = String(x.instansi_kelas || '').trim();
        guru.push({ nama, jenis, keterangan: ket, kelompok: PIMPINAN.test(ket + ' ' + jenis) ? 'pimpinan' : /guru/i.test(jenis) ? 'guru' : 'staf' });
      }
      guru.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
      res = new Response(JSON.stringify({ guru }), { status: 200, headers: { 'Content-Type': 'application/json', ...ttl(60) } });
    }
    ctx && ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    return json(500, { error: 'Data guru belum bisa dibaca dari Supabase (tabel daftar_tamu_gabungan).' });
  }
}
export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
