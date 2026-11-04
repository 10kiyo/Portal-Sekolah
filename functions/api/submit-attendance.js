// Cloudflare Pages Function: POST /api/submit-attendance
// Menangani submit presensi/kehadiran tamu atau acara
import { bacaBukuTamu } from './buku-tamu-pengaturan.js';
import { json, cfg } from '../_lib/util.js';

export async function onRequestPost({ request, env }) {
  try {
    const c = cfg(env);
    if (!c) return json(500, { error: 'Kredensial Supabase belum diatur.' });

    // Cek apakah fitur buku tamu sedang dibuka oleh pengurus/panitia
    const bt = await bacaBukuTamu(env);
    if (!bt.aktif) return json(403, { error: 'Buku tamu sedang ditutup.' });

    const { guestId, guestName, statusHadir, signature, namaAcara, jenisUndangan } = await request.json();

    const r = await fetch(`${c.REST}/kehadiran`, {
      method: 'POST',
      headers: { ...c.h, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        guest_id: guestId,
        guest_name: guestName,
        status_kehadiran: statusHadir || 'Hadir',
        tanda_tangan_data: signature,
        nama_acara: namaAcara,
        jenis_undangan: jenisUndangan
      })
    });

    if (!r.ok) { 
      const d = await r.json().catch(() => ({})); 
      throw new Error(d.message || 'Gagal menyimpan data presensi ke Supabase'); 
    }

    return json(200, { message: 'Data presensi berhasil disimpan online', data: await r.json() });
  } catch (e) {
    return json(500, { error: e.message });
  }
}

export const onRequest = () => json(405, { error: 'Method Not Allowed' });