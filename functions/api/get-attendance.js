// Cloudflare Pages Function: GET /api/get-attendance
// Perilaku sama seperti versi Netlify (belum memakai token).
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestGet({ env }) {
  try {
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!env.SUPABASE_URL || !key) return json(500, { error: 'Kredensial Supabase belum diatur.' });
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/kehadiran?select=*&order=confirmed_at.desc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
    });
    if (!r.ok) throw new Error('Gagal mengambil data dari Supabase');
    return json(200, await r.json());
  } catch (e) {
    return json(500, { error: e.message });
  }
}
export const onRequest = () => json(405, { error: 'Method Not Allowed' });
