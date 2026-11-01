// Cloudflare Worker route: GET/POST /api/umum-kegiatan   (PUBLIK, tanpa login / kode akses)
// Pendaftaran kegiatan terbuka untuk umum (mis. lomba yang boleh diikuti sekolah lain).
//   GET  ?id=<uuid>                      -> detail satu kegiatan (hanya yang "untuk_umum")
//   POST { action:'daftar', kegiatanId, nama, asal_sekolah, kelas_peserta, nama_ortu, kontak, kaos, kesehatan,
//          nama_pengirim, tanggal_transfer, bukti:'data:image/jpeg;base64,...', setuju, website }
//   POST { action:'cek', kegiatanId, nama, asal_sekolah, kontak }  -> status pendaftaran sendiri
import { json, cfg, dbGet, hariIni, fase, bacaFoto, terpakaiMap, terlaluSering, kunciUmum } from '../_lib/util.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TGL = /^\d{4}-\d{2}-\d{2}$/;
const t = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);

const publik = (k, terpakai, today) => ({
  id: k.id, nama: k.nama, deskripsi: k.deskripsi, biaya: k.biaya, rekening: k.biaya ? k.rekening : null,
  buka_daftar: k.buka_daftar, tutup_daftar: k.tutup_daftar, tanggal_kegiatan: k.tanggal_kegiatan,
  sisa: k.kuota != null ? Math.max(0, k.kuota - terpakai) : null,
  tanya_kaos: !!k.tanya_kaos, tanya_kesehatan: !!k.tanya_kesehatan, fase: fase(k, terpakai, today)
});
async function ambil(get, id) {
  if (!UUID.test(String(id || ''))) return null;
  const k = (await get(`/kegiatan?id=eq.${id}&untuk_umum=eq.true&select=*`))[0];
  return k || null;
}

export async function onRequestGet({ request, env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'Layanan belum siap.' });
  try {
    const get = dbGet(c), id = new URL(request.url).searchParams.get('id');
    const k = await ambil(get, id);
    if (!k) return json(404, { error: 'Pendaftaran tidak ditemukan atau tidak dibuka untuk umum.' });
    const tp = await terpakaiMap(get, [k.id]);
    return json(200, { kegiatan: publik(k, tp[k.id] || 0, hariIni()) });
  } catch (e) {
    return json(500, { error: 'Data belum bisa dibaca. Pastikan supabase-kegiatan-tingkat.sql sudah dijalankan.' });
  }
}

export async function onRequestPost({ request, env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'Layanan belum siap.' });
  let b = {}; try { b = await request.json(); } catch (e) {}
  const get = dbGet(c), today = hariIni();
  try {
    if (b.website) return json(200, { ok: true });          // kolom jebakan untuk robot: pura-pura berhasil

    const k = await ambil(get, b.kegiatanId);
    if (!k) return json(404, { error: 'Pendaftaran tidak ditemukan atau tidak dibuka untuk umum.' });
    const nama = t(b.nama, 80), asal = t(b.asal_sekolah, 100), kontak = t(b.kontak, 40);
    if (!nama || !asal || !kontak) return json(400, { error: 'Lengkapi nama peserta, asal sekolah, dan nomor WhatsApp.' });
    const key = await kunciUmum(nama, asal);

    if (b.action === 'cek') {
      if (terlaluSering(request, 'cek', 10)) return json(429, { error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });
      const r = (await get(`/pendaftaran_kegiatan?kegiatan_id=eq.${k.id}&anak_key=eq.${encodeURIComponent(key)}&select=status,catatan_panitia,data,created_at`))[0];
      // kontak harus cocok agar status orang lain tidak bisa diintip
      const sama = r && String((r.data || {}).kontak || '').replace(/\D/g, '') === kontak.replace(/\D/g, '');
      if (!sama) return json(404, { error: 'Pendaftaran tidak ditemukan. Periksa nama, asal sekolah, dan nomor WhatsApp yang dipakai saat mendaftar.' });
      return json(200, { status: r.status, catatan: r.catatan_panitia || null, created_at: r.created_at });
    }

    if (b.action !== 'daftar') return json(400, { error: 'Aksi tidak dikenal.' });
    if (terlaluSering(request, 'daftar', 6)) return json(429, { error: 'Terlalu banyak pendaftaran dari perangkat ini. Coba lagi beberapa menit lagi.' });

    const [tp, ex] = await Promise.all([
      terpakaiMap(get, [k.id]),
      get(`/pendaftaran_kegiatan?kegiatan_id=eq.${k.id}&anak_key=eq.${encodeURIComponent(key)}&select=id,status,bukti_path`)
    ]);
    const f = fase(k, tp[k.id] || 0, today), old = ex[0] || null;
    if (old && old.status !== 'ditolak') return json(409, { error: 'Peserta ini sudah terdaftar untuk kegiatan ini. Gunakan "Cek status pendaftaran".' });
    if (!(f === 'dibuka' || (old && f === 'ditutup'))) return json(400, { error: f === 'penuh' ? 'Mohon maaf, kuota sudah penuh.' : f === 'selesai' ? 'Kegiatan ini sudah selesai.' : 'Pendaftaran tidak sedang dibuka.' });
    if (b.setuju !== true) return json(400, { error: 'Centang persetujuan orang tua/wali terlebih dahulu.' });
    const kaos = k.tanya_kaos ? t(b.kaos, 20) : '';
    if (k.tanya_kaos && !kaos) return json(400, { error: 'Isi ukuran kaos.' });

    // Pembayaran: wajib bila berbiaya; kegiatan gratis tidak butuh bukti.
    let nama_pengirim = nama, tanggal_transfer = today, path = null;
    if (k.biaya > 0) {
      nama_pengirim = t(b.nama_pengirim, 60); tanggal_transfer = String(b.tanggal_transfer || '');
      if (!nama_pengirim || !TGL.test(tanggal_transfer)) return json(400, { error: 'Lengkapi nama pengirim dan tanggal transfer.' });
      const foto = bacaFoto(b.bukti);
      if (foto.err) return json(400, { error: foto.err.replace('Foto harus', 'Bukti transfer harus') });
      path = `${k.id}/${crypto.randomUUID()}.${foto.ext}`;
      const up = await fetch(`${c.URL}/storage/v1/object/bukti/${path}`, { method: 'POST', headers: { ...c.h, 'Content-Type': foto.mime }, body: foto.bytes });
      if (!up.ok) return json(500, { error: 'Gagal mengunggah bukti. Coba lagi beberapa saat.' });
    }

    const data = { umum: true, asal_sekolah: asal, kelas_peserta: t(b.kelas_peserta, 30), nama_ortu: t(b.nama_ortu, 80), kontak };
    if (k.tanya_kaos) data.kaos = kaos;
    if (k.tanya_kesehatan) data.kesehatan = t(b.kesehatan, 200);
    const row = { nama_pengirim, tanggal_transfer, data, bukti_path: path, status: 'menunggu', catatan_panitia: null, verified_at: null, created_at: new Date().toISOString() };
    const jh = { ...c.h, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    const w = old
      ? await fetch(`${c.REST}/pendaftaran_kegiatan?id=eq.${old.id}`, { method: 'PATCH', headers: jh, body: JSON.stringify(row) })
      : await fetch(`${c.REST}/pendaftaran_kegiatan`, { method: 'POST', headers: jh, body: JSON.stringify({ ...row, kegiatan_id: k.id, anak_key: key, nama_anak: nama, kelas: 'Umum' }) });
    if (!w.ok) {
      if (path) await fetch(`${c.URL}/storage/v1/object/bukti/${path}`, { method: 'DELETE', headers: c.h }).catch(() => {});
      return json(w.status === 409 ? 409 : 500, { error: w.status === 409 ? 'Peserta ini sudah terdaftar untuk kegiatan ini.' : 'Gagal menyimpan pendaftaran.' });
    }
    if (old && old.bukti_path) await fetch(`${c.URL}/storage/v1/object/bukti/${old.bukti_path}`, { method: 'DELETE', headers: c.h }).catch(() => {});
    return json(200, { ok: true, gratis: !(k.biaya > 0) });
  } catch (e) {
    return json(500, { error: 'Terjadi kesalahan server.' });
  }
}
export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
