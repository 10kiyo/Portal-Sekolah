// Cloudflare Worker route: POST /api/murid-jurnal
// Murid (atau orang tua) mengirim jurnal/berita dari rumah memakai KODE AKSES murid (kode_akses_ortu).
//   { kode, action: 'list' }                                   -> jurnal milik anak ini + statusnya
//   { kode, action: 'kirim', judul, isi, foto?, setuju }       -> kirim baru (status: menunggu)
//   { kode, action: 'ubah', id, judul, isi, foto?, hapusFoto } -> perbaiki (status kembali: menunggu)
//   { kode, action: 'hapus', id }                              -> hapus jurnal sendiri yang belum disetujui
import { json, cfg, dbGet, cariAnak, bacaFoto, urlFoto } from '../_lib/util.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AKTIF = 5; // jumlah jurnal yang boleh menunggu/revisi bersamaan per anak

export async function onRequestPost({ request, env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });

  const get = dbGet(c);
  let b = {}; 
  try { b = await request.json(); } catch (e) {}

  try {
    const { anak, err } = await cariAnak(request, b.kode, c, env);
    if (err) return err;

    const muridId = encodeURIComponent(anak.id);
    const jh = { ...c.h, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    const hapusFile = p => p ? fetch(`${c.URL}/storage/v1/object/jurnal/${p}`, { method: 'DELETE', headers: c.h }).catch(() => {}) : null;
    const milik = async id => UUID.test(String(id || '')) ? (await get(`/jurnal_murid?id=eq.${id}&murid_id=eq.${muridId}&select=id,status,foto_url`))[0] : null;

    if (b.action === 'list') {
      const rows = await get(`/jurnal_murid?murid_id=eq.${muridId}&order=created_at.desc&limit=50&select=id,judul,isi,status,catatan_admin,foto_url,created_at`).catch(() => null);
      if (!rows) return json(500, { error: 'Tabel jurnal_murid belum siap di Supabase.' });
      
      const jurnal = await Promise.all(rows.map(async x => ({ 
        id: x.id, 
        judul: x.judul, 
        isi: x.isi, 
        status: x.status, 
        catatan_admin: x.catatan_admin, 
        created_at: x.created_at, 
        foto: await urlFoto(c, x.foto_url) 
      })));

      return json(200, { 
        anak: { 
          nama: anak.nama_lengkap || anak.nama, 
          kelas: anak.nama_kelas || anak.kelas 
        }, 
        jurnal 
      });
    }

    if (b.action === 'hapus') {
      const o = await milik(b.id);
      if (!o) return json(404, { error: 'Jurnal tidak ditemukan.' });
      if (o.status === 'disetujui') return json(400, { error: 'Jurnal yang sudah tayang hanya bisa dihapus oleh admin sekolah.' });
      
      const r = await fetch(`${c.REST}/jurnal_murid?id=eq.${o.id}`, { method: 'DELETE', headers: c.h });
      if (!r.ok) return json(500, { error: 'Gagal menghapus jurnal.' });
      await hapusFile(o.foto_url);
      return json(200, { ok: true });
    }

    if (b.action === 'kirim' || b.action === 'ubah') {
      const judul = String(b.judul || '').trim().replace(/\s+/g, ' ').slice(0, 120);
      const isi = String(b.isi || '').trim().slice(0, 5000);
      if (judul.length < 5) return json(400, { error: 'Judul minimal 5 huruf.' });
      if (isi.length < 100) return json(400, { error: 'Tulisan masih terlalu pendek. Minimal 100 huruf (sekitar 3–4 kalimat).' });
      if (b.setuju !== true) return json(400, { error: 'Centang izin orang tua untuk menayangkan karya di website sekolah.' });

      let foto = null;
      if (b.foto) { foto = bacaFoto(b.foto); if (foto.err) return json(400, { error: foto.err }); }
      
      const simpanFoto = async () => {
        const path = `${crypto.randomUUID()}.${foto.ext}`;
        const up = await fetch(`${c.URL}/storage/v1/object/jurnal/${path}`, { method: 'POST', headers: { ...c.h, 'Content-Type': foto.mime }, body: foto.bytes });
        return up.ok ? path : null;
      };

      if (b.action === 'kirim') {
        const aktif = await get(`/jurnal_murid?murid_id=eq.${muridId}&status=in.(menunggu,revisi)&select=id`);
        if (aktif.length >= MAX_AKTIF) return json(400, { error: `Masih ada ${aktif.length} jurnal yang menunggu verifikasi. Tunggu hasilnya dulu ya.` });
        
        let path = null;
        if (foto) { path = await simpanFoto(); if (!path) return json(500, { error: 'Gagal mengunggah foto jurnal.' }); }
        
        const r = await fetch(`${c.REST}/jurnal_murid`, { 
          method: 'POST', 
          headers: jh, 
          body: JSON.stringify({ 
            murid_id: anak.id, 
            judul, 
            isi, 
            foto_url: path,
            status: 'menunggu'
          }) 
        });

        if (!r.ok) { await hapusFile(path); return json(500, { error: 'Gagal menyimpan jurnal ke Supabase.' }); }
        return json(200, { ok: true });
      }

      const o = await milik(b.id);
      if (!o) return json(404, { error: 'Jurnal tidak ditemukan.' });
      if (o.status === 'disetujui') return json(400, { error: 'Jurnal yang sudah tayang tidak bisa diubah. Hubungi admin sekolah.' });
      
      let path = o.foto_url;
      if (foto) { path = await simpanFoto(); if (!path) return json(500, { error: 'Gagal mengunggah foto baru.' }); }
      else if (b.hapusFoto === true) path = null;

      const r = await fetch(`${c.REST}/jurnal_murid?id=eq.${o.id}`, { 
        method: 'PATCH', 
        headers: jh, 
        body: JSON.stringify({ 
          judul, 
          isi, 
          foto_url: path, 
          status: 'menunggu', 
          catatan_admin: null, 
          updated_at: new Date().toISOString() 
        }) 
      });

      if (!r.ok) { if (foto) await hapusFile(path); return json(500, { error: 'Gagal menyimpan perubahan jurnal.' }); }
      if (o.foto_url && o.foto_url !== path) await hapusFile(o.foto_url);
      return json(200, { ok: true });
    }

    return json(400, { error: 'Aksi tidak dikenal.' });
  } catch (e) {
    return json(500, { error: 'Terjadi kesalahan server.' });
  }
}

export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });