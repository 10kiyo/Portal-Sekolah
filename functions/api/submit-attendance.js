// Cloudflare Pages Function: POST /api/submit-attendance
// Perilaku sama seperti versi Netlify.
import { bacaBukuTamu } from './buku-tamu-pengaturan.js';
import { json, cfg } from '../_lib/util.js';

export async function onRequestPost({ request, env }) {
  try {
    const c = cfg(env);
    if (!c) return json(500, { error: 'Kredensial Supabase belum diatur.' });
    // Buku tamu ditutup oleh panitia (Atur buku tamu): tolak di server, bukan hanya disembunyikan di halaman.
    const bt = await bacaBukuTamu(env);
    if (!bt.aktif) return json(403, { error: 'Buku tamu sedang ditutup.' });
    const { guestId, guestName, statusHadir, signature, namaAcara, jenisUndangan } = await request.json();
    const r = await fetch(`${c.REST}/kehadiran`, {
      method: 'POST',
      headers: { ...c.h, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        guest_id: guestId, guest_name: guestName, status_hadir: statusHadir,
        tanda_tangandata: signature, nama_acara: namaAcara, jenis_undangan: jenisUndangan
      })
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || 'Gagal menyimpan data ke Supabase'); }
    return json(200, { message: 'Data berhasil disimpan online', data: await r.json() });
  } catch (e) {
    return json(500, { error: e.message });
  }
}
export const onRequest = () => json(405, { error: 'Method Not Allowed' });
