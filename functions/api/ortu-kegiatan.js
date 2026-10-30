// Cloudflare Worker route: POST /api/ortu-kegiatan
// Orang tua (lewat kode akses anak): melihat kegiatan yang sedang relevan + mendaftar dengan bukti transfer.
//   { kode, action: 'list' }
//   { kode, action: 'daftar', kegiatanId, nama_pengirim, tanggal_transfer, kaos, kesehatan, kontak, setuju, bukti: 'data:image/jpeg;base64,...' }
import { json, cfg, dbGet, hariIni, fase, cariAnak } from '../_lib/util.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_B64 = 2_800_000; // ~2 MB setelah decode

async function terpakaiMap(get, ids) {
  if (!ids.length) return {};
  const rows = await get(`/pendaftaran_kegiatan?kegiatan_id=in.(${ids.join(',')})&status=neq.ditolak&select=kegiatan_id&limit=10000`);
  const m = {}; rows.forEach(r => m[r.kegiatan_id] = (m[r.kegiatan_id] || 0) + 1);
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
      const ks = await get(`/kegiatan?buka_daftar=lte.${today}&tanggal_kegiatan=gte.${today}&order=tanggal_kegiatan.asc&select=*`);
      const ids = ks.map(k => k.id);
      const [tp, mine] = await Promise.all([
        terpakaiMap(get, ids),
        ids.length ? get(`/pendaftaran_kegiatan?anak_key=eq.${encodeURIComponent(anak.key)}&kegiatan_id=in.(${ids.join(',')})&select=kegiatan_id,status,catatan_panitia,nama_pengirim,tanggal_transfer,created_at`) : []
      ]);
      const mm = Object.fromEntries(mine.map(x => [x.kegiatan_id, x]));
      return json(200, {
        kegiatan: ks.map(k => ({
          id: k.id, nama: k.nama, deskripsi: k.deskripsi, biaya: k.biaya, rekening: k.rekening,
          buka_daftar: k.buka_daftar, tutup_daftar: k.tutup_daftar, tanggal_kegiatan: k.tanggal_kegiatan,
          sisa: k.kuota != null ? Math.max(0, k.kuota - (tp[k.id] || 0)) : null,
          fase: fase(k, tp[k.id] || 0, today), daftar: mm[k.id] || null
        }))
      });
    }

    if (b.action === 'daftar') {
      const kid = String(b.kegiatanId || '');
      if (!UUID.test(kid)) return json(400, { error: 'Kegiatan tidak valid.' });
      const k = (await get(`/kegiatan?id=eq.${kid}&select=*`))[0];
      if (!k) return json(404, { error: 'Kegiatan tidak ditemukan.' });
      const [tp, ex] = await Promise.all([
        terpakaiMap(get, [kid]),
        get(`/pendaftaran_kegiatan?kegiatan_id=eq.${kid}&anak_key=eq.${encodeURIComponent(anak.key)}&select=id,status,bukti_path`)
      ]);
      const f = fase(k, tp[kid] || 0, today), old = ex[0] || null;
      if (old && old.status !== 'ditolak') return json(409, { error: 'Anak ini sudah terdaftar untuk kegiatan ini.' });
      if (!(f === 'dibuka' || (old && f === 'ditutup'))) return json(400, { error: f === 'penuh' ? 'Mohon maaf, kuota sudah penuh.' : 'Pendaftaran tidak sedang dibuka.' });

      const nama_pengirim = String(b.nama_pengirim || '').trim().slice(0, 60);
      const tanggal_transfer = String(b.tanggal_transfer || '');
      const kontak = String(b.kontak || '').trim().slice(0, 40);
      if (!nama_pengirim || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal_transfer) || !kontak) return json(400, { error: 'Lengkapi nama pengirim, tanggal transfer, dan kontak darurat.' });
      if (b.setuju !== true) return json(400, { error: 'Centang persetujuan orang tua terlebih dahulu.' });

      // Bukti transfer: hanya gambar JPEG/PNG/WEBP, maksimal ~2 MB, dicek juga dari byte awal file.
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

      const path = `${kid}/${crypto.randomUUID()}.${mt[1] === 'jpeg' ? 'jpg' : mt[1]}`;
      const up = await fetch(`${c.URL}/storage/v1/object/bukti/${path}`, { method: 'POST', headers: { ...c.h, 'Content-Type': `image/${mt[1]}` }, body: bytes });
      if (!up.ok) return json(500, { error: 'Gagal mengunggah bukti. Pastikan bucket "bukti" sudah dibuat (lihat SQL).' });

      const data = { kaos: String(b.kaos || '').trim().slice(0, 20), kesehatan: String(b.kesehatan || '').trim().slice(0, 200), kontak };
      const row = { nama_pengirim, tanggal_transfer, data, bukti_path: path, status: 'menunggu', catatan_panitia: null, verified_at: null, created_at: new Date().toISOString() };
      const jh = { ...c.h, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
      const w = old
        ? await fetch(`${c.REST}/pendaftaran_kegiatan?id=eq.${old.id}`, { method: 'PATCH', headers: jh, body: JSON.stringify(row) })
        : await fetch(`${c.REST}/pendaftaran_kegiatan`, { method: 'POST', headers: jh, body: JSON.stringify({ ...row, kegiatan_id: kid, anak_key: anak.key, nama_anak: anak.nama, kelas: anak.kelas }) });
      if (!w.ok) {
        await fetch(`${c.URL}/storage/v1/object/bukti/${path}`, { method: 'DELETE', headers: c.h }).catch(() => {});
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
