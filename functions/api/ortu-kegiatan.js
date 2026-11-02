// Cloudflare Worker route: POST /api/ortu-kegiatan
// Orang tua (lewat kode akses anak): melihat kegiatan yang sedang relevan + mendaftar dengan bukti transfer.
//   { kode, action: 'list', id? }   (id = tautan khusus satu kegiatan; hanya kegiatan yang sesuai tingkat kelas anak yang ditampilkan)
//   { kode, action: 'daftar', kegiatanId, nama_pengirim, tanggal_transfer, kaos, kesehatan, kontak, setuju, bukti: 'data:image/jpeg;base64,...' }
import { json, cfg, dbGet, hariIni, fase, cariAnak, bolehTingkat, labelTingkat, tingkatKegiatan } from '../_lib/util.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_B64 = 2_800_000; // ~2 MB setelah decode

// Jumlah terpakai kuota. Kegiatan umum & ekskul: semua yang belum ditolak. Club: hanya yang sudah DITERIMA (seleksi).
async function terpakaiMap(get, ks) {
  const m = {}; if (!ks.length) return m;
  const u = ks.filter(k => !k.jenis || k.jenis === 'umum'), e = ks.filter(k => k.jenis && k.jenis !== 'umum');
  if (u.length) (await get(`/pendaftaran_kegiatan?kegiatan_id=in.(${u.map(k => k.id).join(',')})&status=neq.ditolak&select=kegiatan_id&limit=10000`)).forEach(r => m[r.kegiatan_id] = (m[r.kegiatan_id] || 0) + 1);
  if (e.length) {
    const club = new Set(e.filter(k => k.jenis === 'club').map(k => k.id));
    (await get(`/ekskul_pendaftar?kegiatan_id=in.(${e.map(k => k.id).join(',')})&select=kegiatan_id,status&limit=10000`).catch(() => []))
      .forEach(r => { if (club.has(r.kegiatan_id) ? r.status === 'diterima' : r.status !== 'ditolak') m[r.kegiatan_id] = (m[r.kegiatan_id] || 0) + 1; });
  }
  return m;
}

export async function onRequestPost({ request, env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const get = dbGet(c);
  let b = {};
  try { b = await request.json(); } catch (e) {}

  try {
    const { anak, err } = await cariAnak(request, b.kode, c);
    if (err) return err;
    const today = hariIni();

    if (b.action === 'list') {
      const sem = await get(`/kegiatan?buka_daftar=lte.${today}&tanggal_kegiatan=gte.${today}&order=tanggal_kegiatan.asc&select=*`);
      const fokus = /^[0-9a-f-]{36}$/i.test(String(b.id || '')) ? String(b.id).toLowerCase() : '';
      const ks = sem.filter(k => bolehTingkat(k, anak));
      // Tautan khusus kegiatan yang bukan untuk tingkat anak ini: beri tahu alasannya (tanpa membuka isi kegiatan).
      const terkunci = fokus ? sem.filter(k => k.id === fokus && !bolehTingkat(k, anak)).map(k => ({ nama: k.nama, untuk: labelTingkat(k) }))[0] || null : null;
      const idU = ks.filter(k => !k.jenis || k.jenis === 'umum').map(k => k.id), idE = ks.filter(k => k.jenis && k.jenis !== 'umum').map(k => k.id);
      const ak = encodeURIComponent(anak.key);
      const [tp, mineU, mineE] = await Promise.all([
        terpakaiMap(get, ks),
        idU.length ? get(`/pendaftaran_kegiatan?anak_key=eq.${ak}&kegiatan_id=in.(${idU.join(',')})&select=kegiatan_id,status,catatan_panitia,nama_pengirim,tanggal_transfer,created_at`) : [],
        idE.length ? get(`/ekskul_pendaftar?anak_key=eq.${ak}&kegiatan_id=in.(${idE.join(',')})&select=kegiatan_id,status,catatan,nama_pengirim,tanggal_transfer,created_at`).catch(() => []) : []
      ]);
      const mm = Object.fromEntries([...mineU, ...mineE.map(x => ({ ...x, catatan_panitia: x.catatan }))].map(x => [x.kegiatan_id, x]));
      return json(200, {
        terkunci, anakKelas: anak.kelas,
        kegiatan: ks.map(k => ({
          id: k.id, nama: k.nama, deskripsi: k.deskripsi, biaya: k.biaya, rekening: k.rekening, jenis: k.jenis || 'umum',
          buka_daftar: k.buka_daftar, tutup_daftar: k.tutup_daftar, tanggal_kegiatan: k.tanggal_kegiatan,
          sisa: k.kuota != null ? Math.max(0, k.kuota - (tp[k.id] || 0)) : null,
          tanya_kaos: !!k.tanya_kaos, tanya_kesehatan: !!k.tanya_kesehatan, tanya_bidang: !!k.tanya_bidang, opsi_bidang: Array.isArray(k.opsi_bidang) ? k.opsi_bidang : [], untuk: labelTingkat(k), terbatas: tingkatKegiatan(k).length > 0,
          fase: fase(k, tp[k.id] || 0, today), daftar: mm[k.id] || null
        }))
      });
    }

    if (b.action === 'daftar') {
      const kid = String(b.kegiatanId || '');
      if (!UUID.test(kid)) return json(400, { error: 'Kegiatan tidak valid.' });
      const k = (await get(`/kegiatan?id=eq.${kid}&select=*`))[0];
      if (!k) return json(404, { error: 'Kegiatan tidak ditemukan.' });
      if (!bolehTingkat(k, anak)) return json(403, { error: `Kegiatan ini khusus untuk ${labelTingkat(k)}. Anak ini berada di kelas ${anak.kelas || '-'}.` });
      const ec = k.jenis === 'ekskul' || k.jenis === 'club', club = k.jenis === 'club', TB = ec ? 'ekskul_pendaftar' : 'pendaftaran_kegiatan';
      const [tp, ex] = await Promise.all([
        terpakaiMap(get, [k]),
        get(`/${TB}?kegiatan_id=eq.${kid}&anak_key=eq.${encodeURIComponent(anak.key)}&select=id,status,bukti_path`)
      ]);
      const f = fase(k, tp[kid] || 0, today), old = ex[0] || null;
      if (old && (club || old.status !== 'ditolak')) return json(409, { error: 'Anak ini sudah terdaftar untuk kegiatan ini.' });
      if (!(f === 'dibuka' || (old && f === 'ditutup'))) return json(400, { error: f === 'penuh' ? 'Mohon maaf, kuota sudah penuh.' : 'Pendaftaran tidak sedang dibuka.' });

      // Kegiatan gratis (bukan ekskul/club): nama pengirim, tanggal, dan bukti transfer boleh kosong.
      const opsiBukti = !(Number(k.biaya) > 0) && !ec, TGLRE = /^\d{4}-\d{2}-\d{2}$/;
      let nama_pengirim = String(b.nama_pengirim || '').trim().slice(0, 60);
      let tanggal_transfer = String(b.tanggal_transfer || '');
      const kontak = String(b.kontak || '').trim().slice(0, 40);
      if (opsiBukti) { if (!nama_pengirim) nama_pengirim = String(anak.nama || '').slice(0, 60); if (!TGLRE.test(tanggal_transfer)) tanggal_transfer = today; }
      if (club ? !kontak : (!kontak || !nama_pengirim || !TGLRE.test(tanggal_transfer))) return json(400, { error: (club || opsiBukti) ? 'Isi nomor kontak darurat.' : 'Lengkapi nama pengirim, tanggal transfer, dan kontak darurat.' });
      const kaos = k.tanya_kaos ? String(b.kaos || '').trim().slice(0, 20) : '';
      if (k.tanya_kaos && !kaos) return json(400, { error: 'Isi ukuran kaos.' });
      const bidang = k.tanya_bidang ? String(b.bidang || '').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
      if (k.tanya_bidang && !bidang) return json(400, { error: 'Isi bidang lomba.' });
      if (b.setuju !== true) return json(400, { error: 'Centang persetujuan orang tua terlebih dahulu.' });
      const jh0 = { ...c.h, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

      // Club: gratis, tanpa bukti transfer; masuk antrean seleksi pustakawan.
      if (club) {
        const motivasi = String(b.motivasi || '').trim().slice(0, 500);
        if (!motivasi) return json(400, { error: 'Tulis alasan anak ingin bergabung dengan club ini.' });
        const data = { kontak, motivasi };
        if (k.tanya_kesehatan) data.kesehatan = String(b.kesehatan || '').trim().slice(0, 200);
        const w = await fetch(`${c.REST}/ekskul_pendaftar`, { method: 'POST', headers: jh0, body: JSON.stringify({ kegiatan_id: kid, anak_key: anak.key, nama_anak: anak.nama, kelas: anak.kelas, status: 'menunggu', data }) });
        return w.ok ? json(200, { ok: true }) : json(w.status === 409 ? 409 : 500, { error: w.status === 409 ? 'Anak ini sudah terdaftar untuk kegiatan ini.' : 'Gagal menyimpan pendaftaran. Pastikan supabase-ekskul-club.sql sudah dijalankan.' });
      }

      // Bukti transfer: hanya gambar JPEG/PNG/WEBP, maksimal ~2 MB, dicek juga dari byte awal file.
      let path = null;
      if (b.bukti || !opsiBukti) {
      const s = String(b.bukti || ''), i = s.indexOf(','), head = s.slice(0, i), b64 = s.slice(i + 1);
      const mt = /^data:image\/(jpeg|png|webp);base64$/.exec(head);
      if (i < 0 || !mt) return json(400, { error: 'Bukti transfer harus berupa foto (JPG/PNG).' });
      if (b64.length > MAX_B64) return json(400, { error: 'Ukuran foto terlalu besar. Coba foto ulang.' });
      let bytes;
      try { bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)); } catch (e) { return json(400, { error: 'Foto tidak terbaca.' }); }
      const ok = (mt[1] === 'jpeg' && bytes[0] === 0xFF && bytes[1] === 0xD8) ||
                 (mt[1] === 'png' && bytes[0] === 0x89 && bytes[1] === 0x50) ||
                 (mt[1] === 'webp' && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57);
      if (!ok) return json(400, { error: 'Berkas bukan foto yang valid.' });

      path = `${ec ? 'ekskul/' : ''}${kid}/${crypto.randomUUID()}.${mt[1] === 'jpeg' ? 'jpg' : mt[1]}`;
      const up = await fetch(`${c.URL}/storage/v1/object/bukti/${path}`, { method: 'POST', headers: { ...c.h, 'Content-Type': `image/${mt[1]}` }, body: bytes });
      if (!up.ok) return json(500, { error: 'Gagal mengunggah bukti. Pastikan bucket "bukti" sudah dibuat (lihat SQL).' });
      }

      const data = { kontak };
      if (k.tanya_kaos) data.kaos = kaos;
      if (k.tanya_bidang) data.bidang = bidang;
      if (k.tanya_kesehatan) data.kesehatan = String(b.kesehatan || '').trim().slice(0, 200);
      const row = { nama_pengirim, tanggal_transfer, data, bukti_path: path, status: 'menunggu', verified_at: null, created_at: new Date().toISOString(), [ec ? 'catatan' : 'catatan_panitia']: null, ...(ec ? { nominal_diterima: null } : {}) };
      const jh = jh0;
      const w = old
        ? await fetch(`${c.REST}/${TB}?id=eq.${old.id}`, { method: 'PATCH', headers: jh, body: JSON.stringify(row) })
        : await fetch(`${c.REST}/${TB}`, { method: 'POST', headers: jh, body: JSON.stringify({ ...row, kegiatan_id: kid, anak_key: anak.key, nama_anak: anak.nama, kelas: anak.kelas }) });
      if (!w.ok) {
        if (path) await fetch(`${c.URL}/storage/v1/object/bukti/${path}`, { method: 'DELETE', headers: c.h }).catch(() => {});
        return json(w.status === 409 ? 409 : 500, { error: w.status === 409 ? 'Anak ini sudah terdaftar untuk kegiatan ini.' : 'Gagal menyimpan pendaftaran.' });
      }
      if (old && old.bukti_path) await fetch(`${c.URL}/storage/v1/object/bukti/${old.bukti_path}`, { method: 'DELETE', headers: c.h }).catch(() => {});
      return json(200, { ok: true });
    }
    return json(400, { error: 'Aksi tidak dikenal.' });
  } catch (e) {
    return json(500, { error: 'Terjadi kesalahan server.' });
  }
}
export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
