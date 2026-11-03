// Cloudflare Worker route: POST /api/spmb-bayar (PUBLIK, tanpa login).
// Menyimpan bukti pembayaran formulir TK Luar dan mengembalikan token untuk langkah pendaftaran.
import { json, cfg, dbGet, hariIni, headerTulis, terlaluSering } from '../_lib/util.js';
import { pengaturan, fase, bacaBerkas } from '../_lib/spmb.js';

const MAX_BUKTI = 2.5 * 1024 * 1024;
const tokenPalsu = () => crypto.randomUUID();

export async function onRequestPost({ request, env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'Layanan belum siap.' });
  if (!(request.headers.get('content-type') || '').includes('multipart/form-data'))
    return json(400, { error: 'Kirim formulir pembayaran dengan format yang benar.' });

  let f;
  try { f = await request.formData(); }
  catch (e) { return json(400, { error: 'Data pembayaran tidak terbaca. Coba kirim ulang.' }); }
  if (f.get('website')) return json(200, { ok: true, token: tokenPalsu() });
  if (await terlaluSering(env, request, 'spmb-bayar', 8))
    return json(429, { error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });

  if (f.get('jalur') !== 'luar')
    return json(400, { error: 'Pembayaran formulir hanya tersedia untuk jalur TK Luar.' });
  const nama = String(f.get('nama') || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const kontak = String(f.get('kontak') || '').trim().slice(0, 40);
  const hp = kontak.replace(/\D/g, '');
  if (!nama || hp.length < 9 || hp.length > 15)
    return json(400, { error: 'Isi nama calon murid dan nomor WhatsApp dengan benar.' });

  const p = await pengaturan(dbGet(c));
  if (fase(p.luar, 'luar', hariIni()) !== 'dibuka')
    return json(400, { error: 'Pendaftaran jalur TK Luar tidak sedang dibuka.' });

  const parsed = await bacaBerkas(f.get('bukti'), { pdf: true, maks: MAX_BUKTI });
  if (parsed.err) return json(400, { error: `Bukti transfer ${parsed.err}` });
  if (parsed.kosong) return json(400, { error: 'Unggah bukti transfer.' });

  const id = crypto.randomUUID();
  const path = `${id}/bukti.${parsed.ext}`;
  let uploaded = false;
  try {
    const upload = await fetch(`${c.URL}/storage/v1/object/bukti-bayar/${path}`, {
      method: 'POST',
      headers: { ...c.h, 'Content-Type': parsed.mime },
      body: parsed.file
    });
    if (!upload.ok) return json(500, { error: 'Gagal mengunggah bukti pembayaran. Coba lagi beberapa saat.' });
    uploaded = true;

    const saved = await fetch(`${c.REST}/spmb_bukti_bayar`, {
      method: 'POST',
      headers: { ...headerTulis(c), Prefer: 'return=representation' },
      body: JSON.stringify({ id, nama, kontak, file_path: path })
    });
    if (!saved.ok) {
      await fetch(`${c.URL}/storage/v1/object/bukti-bayar/${path}`, { method: 'DELETE', headers: c.h });
      uploaded = false;
      if (saved.status === 404 || saved.status === 400)
        return json(500, { error: 'Tabel pembayaran belum tersedia. Jalankan supabase/16-spmb-bukti-bayar.sql di Supabase SQL Editor.' });
      return json(500, { error: 'Gagal menyimpan data pembayaran. Coba lagi beberapa saat.' });
    }

    const rows = await saved.json();
    const token = rows[0]?.token;
    if (!token) throw new Error('Token pembayaran tidak dikembalikan database.');
    return json(200, { ok: true, token });
  } catch (e) {
    if (uploaded) await fetch(`${c.URL}/storage/v1/object/bukti-bayar/${path}`, { method: 'DELETE', headers: c.h });
    return json(500, { error: 'Terjadi kesalahan saat menyimpan pembayaran. Coba lagi beberapa saat.' });
  }
}

export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
