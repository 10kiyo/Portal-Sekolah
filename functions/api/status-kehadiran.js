// Cloudflare Worker route: GET /api/status-kehadiran (publik)
// Status kehadiran MINIMAL untuk meja registrasi: siapa yang sudah mengonfirmasi, hadir/tidak, dan kapan.
// Sengaja TIDAK memuat tanda tangan, nama acara, atau kolom lain. Rekap lengkap ada di /api/get-attendance (admin).
import { json, cfg } from '../_lib/util.js';

export async function onRequestGet({ env }) {
  try {
    const c = cfg(env);
    if (!c) return json(500, { error: 'Kredensial Supabase belum diatur.' });

    const r = await fetch(
      `${c.REST}/kehadiran?select=guest_id,guest_name,jenis_undangan,status_hadir,confirmed_at&order=confirmed_at.desc.nullslast&limit=10000`, 
      { headers: c.h }
    );

    if (!r.ok) throw new Error('Gagal mengambil data kehadiran dari database Supabase.');
    
    const data = await r.json();
    return json(200, data);
  } catch (e) {
    return json(500, { error: 'Gagal memuat status kehadiran.' });
  }
}

export const onRequest = () => json(405, { error: 'Method Not Allowed' });