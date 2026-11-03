// Cloudflare Pages Function: POST /api/admin-auth
// Memeriksa PIN admin dan mengembalikan token bertanda tangan (berlaku 8 jam).
// Variabel (Settings > Variables and Secrets): ADMIN_PIN (wajib), ADMIN_SECRET (opsional, teks acak panjang).
import { json, hmac, same } from '../_lib/util.js';

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
