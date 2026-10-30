// Cloudflare Pages Function: POST /api/admin-auth
// Memeriksa PIN admin dan mengembalikan token bertanda tangan (berlaku 8 jam).
// Variabel (Settings > Variables and Secrets): ADMIN_PIN (wajib), ADMIN_SECRET (opsional, teks acak panjang).
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
// Perbandingan waktu-tetap: kedua nilai di-hash dulu agar panjangnya sama.
async function same(a, b) {
  const [x, y] = await Promise.all([hmac('cmp', a), hmac('cmp', b)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

export async function onRequestPost({ request, env }) {
  const pin = env.ADMIN_PIN;
  if (!pin) return json(500, { error: 'ADMIN_PIN belum diatur.' });
  let input = '';
  try { input = String((await request.json()).pin || ''); } catch (e) {}
  if (!(await same(input, pin))) {
    await new Promise(r => setTimeout(r, 800)); // memperlambat tebak-tebakan PIN
    return json(401, { error: 'PIN salah.' });
  }
  const exp = Date.now() + 8 * 60 * 60 * 1000;
  return json(200, { token: `${exp}.${await hmac(env.ADMIN_SECRET || pin, String(exp))}` });
}
export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
