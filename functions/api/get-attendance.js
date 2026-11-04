// Cloudflare Worker route: GET /api/get-attendance (HANYA ADMIN)
// Rekap kehadiran lengkap, termasuk tanda tangan. Butuh token dari /api/admin-auth (header Authorization: Bearer ...).
// Halaman publik buku tamu memakai /api/status-kehadiran, yang tidak memuat tanda tangan.
import { json, cfg, adminOk } from '../_lib/util.js';

export async function onRequestGet({ request, env }) {
  if (!(await adminOk(request, env))) return json(401, { error: 'Sesi admin tidak valid. Silakan login ulang.' });
  try {
    const c = cfg(env);
    if (!c) return json(500, { error: 'Kredensial Supabase belum diatur.' });
    
    // Disesuaikan: order=created_at.desc menggantikan confirmed_at.desc
    const r = await fetch(`${c.REST}/kehadiran?select=*&order=created_at.desc`, { 
      headers: { ...c.h, 'Content-Type': 'application/json' } 
    });
    
    if (!r.ok) throw new Error('Gagal mengambil data presensi dari Supabase');
    return json(200, await r.json());
  } catch (e) {
    return json(500, { error: e.message });
  }
}

export const onRequest = () => json(405, { error: 'Method Not Allowed' });