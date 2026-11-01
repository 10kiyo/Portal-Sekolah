// Cloudflare Pages Function: POST /api/submit-attendance
// Perilaku sama seperti versi Netlify.
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  try {
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!env.SUPABASE_URL || !key) return json(500, { error: 'Kredensial Supabase belum diatur.' });
    const { guestId, guestName, statusHadir, signature, namaAcara, jenisUndangan } = await request.json();
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/kehadiran`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
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
