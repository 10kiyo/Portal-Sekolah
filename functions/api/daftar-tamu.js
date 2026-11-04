// Cloudflare Worker route: GET /api/daftar-tamu
// Daftar tamu untuk Buku Tamu (halaman tamu dan panel admin)
//   Publik : nomor WhatsApp disamarkan (4 angka terakhir saja).
//   Admin  : token dari /api/admin-auth -> nomor lengkap.
import { json, cfg, adminOk } from '../_lib/util.js';

const HALAMAN = 1000;      // batas baris per permintaan PostgREST (bawaan Supabase)
const MAKS_HALAMAN = 50;   // pengaman

const isi = v => { v = String(v ?? '').trim(); return v || null; };

// Nomor WhatsApp: sisakan 4 angka terakhir.
export function samarkanNomor(n) {
  const s = String(n ?? '').replace(/\s+/g, '');
  if (!s) return '';
  return s.length <= 4 ? '*'.repeat(s.length) : '*'.repeat(s.length - 4) + s.slice(-4);
}

// tamu  : baris daftar_tamu_gabungan / buku_tamu { guest_id, guest_name, jenis_undangan, instansi_kelas, nomor_whatsapp }
// profil: baris murid_profil                         { guest_id, nama, kelas, jenis, nonaktif, sumber }
export function gabungkanTamu(tamu, profil) {
  const lapisan = new Map(profil.map(p => [String(p.guest_id), p]));
  const dariTamu = new Set(), hasil = [];

  for (const t of tamu) {
    if (t.guest_id == null) continue;
    const id = String(t.guest_id);
    dariTamu.add(id);
    const p = lapisan.get(id);
    if (p && p.nonaktif) continue;

    hasil.push({
      guest_id: id,
      guest_name: (p && isi(p.nama)) || t.guest_name,
      jenis_undangan: t.jenis_undangan ?? (p && p.jenis) ?? null,
      instansi_kelas: (p && isi(p.kelas)) || t.instansi_kelas,
      nomor_whatsapp: t.nomor_whatsapp ?? null
    });
  }

  for (const p of profil) {
    const id = String(p.guest_id);
    if (p.sumber !== 'operator' || p.nonaktif || dariTamu.has(id)) continue;
    hasil.push({ guest_id: id, guest_name: isi(p.nama), jenis_undangan: p.jenis ?? null, instansi_kelas: isi(p.kelas), nomor_whatsapp: null });
  }

  return hasil.filter(x => isi(x.guest_name));
}

async function ambilSemua(c, jalur) {
  const out = [];
  for (let i = 0; i < MAKS_HALAMAN; i++) {
    const offset = i * HALAMAN;
    const r = await fetch(`${c.REST}${jalur}&limit=${HALAMAN}&offset=${offset}`, { headers: c.h });
    if (!r.ok) throw new Error('Gagal mengambil data dari Supabase');
    const d = await r.json();
    out.push(...d);
    if (d.length < HALAMAN) break;
  }
  return out;
}

export async function onRequestGet({ request, env }) {
  try {
    const c = cfg(env);
    if (!c) return json(500, { error: 'Kredensial Supabase belum diatur.' });

    const [tamu, profil, admin] = await Promise.all([
      ambilSemua(c, '/daftar_tamu_gabungan?select=guest_id,guest_name,jenis_undangan,instansi_kelas,nomor_whatsapp&order=guest_id').catch(async () => {
        // Fallback jika view lama digantikan oleh tabel operasional buku_tamu
        return await ambilSemua(c, '/buku_tamu?select=guest_id,guest_name,jenis_undangan,instansi_kelas,nomor_whatsapp&order=guest_id').catch(() => []);
      }),
      ambilSemua(c, '/murid_profil?select=guest_id,nama,kelas,jenis,nonaktif,sumber&order=guest_id').catch(e => {
        console.error('daftar-tamu: murid_profil tidak terbaca', e && e.message);
        return [];
      }),
      adminOk(request, env)
    ]);

    const daftar = gabungkanTamu(tamu, profil);
    return json(200, admin ? daftar : daftar.map(x => ({ ...x, nomor_whatsapp: samarkanNomor(x.nomor_whatsapp) })));
  } catch (e) {
    return json(500, { error: 'Gagal memuat daftar tamu.' });
  }
}

export const onRequest = () => json(405, { error: 'Method Not Allowed' });